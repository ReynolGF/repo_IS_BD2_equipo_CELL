"""Fixtures de integración: bases de datos reales y desechables con testcontainers."""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401  (registra todas las tablas en Base.metadata)
from app.db.base import Base


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
