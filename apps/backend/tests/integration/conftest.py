"""Fixtures de integración: bases de datos reales y desechables con testcontainers."""

import itertools
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401  (registra todas las tablas en Base.metadata)
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.enums import Occupation, Shift
from app.main import app
from app.models.infrastructure import ProductionLine
from app.models.users import Administrator, Operator, PlantManager, Technician, User

PASSWORD = "clave-segura-1"


@pytest.fixture(scope="session")
def pg_engine() -> Iterator[Engine]:
    """Levanta un PostgreSQL temporal con el esquema creado desde los modelos (requiere Docker)."""
    with PostgresContainer("postgres:16", driver="psycopg") as pg:
        engine = create_engine(pg.get_connection_url())
        Base.metadata.create_all(engine)
        yield engine
        engine.dispose()


@pytest.fixture
def session(pg_engine: Engine) -> Iterator[Session]:
    """Sesión aislada por prueba: todo lo que haga se deshace al terminar.

    Se abre una transacción externa y la sesión trabaja con puntos de guardado, así una
    ``IntegrityError`` dentro de una prueba no contamina a las demás.
    """
    connection = pg_engine.connect()
    transaction = connection.begin()
    db_session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield db_session
    finally:
        db_session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="session")
def password_hash() -> str:
    """Hash de ``PASSWORD``, calculado una sola vez porque bcrypt es deliberadamente lento."""
    return hash_password(PASSWORD)


@pytest.fixture
def api_client(session: Session) -> Iterator[TestClient]:
    """Cliente HTTP cuya aplicación usa la sesión de la prueba en lugar de una conexión propia."""
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(session: Session, password_hash: str) -> Callable[..., User]:
    """Fábrica de usuarios con su fila de subtipo, listos para iniciar sesión con ``PASSWORD``."""
    counter = itertools.count(1)

    def _make(
        occupation: Occupation = Occupation.administrator,
        *,
        email: str | None = None,
        is_active: bool = True,
    ) -> User:
        number = next(counter)
        user = User(
            name=f"{occupation.value} {number}",
            email=email or f"{occupation.value}{number}@planta.com",
            password_hash=password_hash,
            occupation=occupation,
            is_active=is_active,
        )
        if occupation is Occupation.technician:
            user.technician = Technician(specialty="mecánica")
        elif occupation is Occupation.operator:
            user.operator = Operator(age=30, shift=Shift.morning)
        elif occupation is Occupation.plant_manager:
            user.manager = PlantManager()
        else:
            user.admin = Administrator()
        session.add(user)
        session.flush()
        return user

    return _make


@pytest.fixture
def auth_headers() -> Callable[[User], dict[str, str]]:
    """Fábrica de cabeceras ``Authorization`` con un token válido para el usuario."""

    def _headers(user: User) -> dict[str, str]:
        token, _ = create_access_token(user.id_user, user.occupation.value)
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture
def line(session: Session) -> ProductionLine:
    """Línea de producción de prueba."""
    production_line = ProductionLine(name="Línea 1", production_process="Embotellado")
    session.add(production_line)
    session.flush()
    return production_line
