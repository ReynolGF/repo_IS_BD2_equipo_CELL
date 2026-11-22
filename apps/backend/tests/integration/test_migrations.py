"""Comprueba que las migraciones de Alembic reproducen exactamente el esquema de los modelos.

Cada prueba usa su propio PostgreSQL vacío (no el de ``pg_engine``, que se crea con
``Base.metadata.create_all``), así se verifica el camino real: ``alembic upgrade head``.
"""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, Engine, create_engine, inspect, text
from testcontainers.postgres import PostgresContainer

import app.models  # noqa: F401  (registra todas las tablas en Base.metadata)
from alembic import command
from app.core.config import get_settings
from app.db.base import Base

pytestmark = pytest.mark.integration

BACKEND_DIR = Path(__file__).resolve().parents[2]
EXPECTED_TABLES = set(Base.metadata.tables)


@pytest.fixture
def migrated_url(monkeypatch: pytest.MonkeyPatch) -> Iterator[str]:
    """PostgreSQL vacío; ``env.py`` de Alembic apunta a él mediante ``POSTGRES_DATABASE_URL``."""
    with PostgresContainer("postgres:16", driver="psycopg") as pg:
        url = pg.get_connection_url()
        monkeypatch.setenv("POSTGRES_DATABASE_URL", url)
        get_settings.cache_clear()
        yield url
    get_settings.cache_clear()


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return config


def _user_tables(engine: Engine) -> set[str]:
    return set(inspect(engine).get_table_names()) - {"alembic_version"}


def test_upgrade_head_crea_el_esquema_de_los_modelos(migrated_url: str) -> None:
    command.upgrade(_alembic_config(), "head")
    engine = create_engine(migrated_url)
    try:
        assert _user_tables(engine) == EXPECTED_TABLES
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            differences = [
                diff
                for diff in compare_metadata(context, Base.metadata)
                # La tabla de versiones de Alembic no forma parte de los modelos.
                if not (diff[0] == "remove_table" and diff[1].name == "alembic_version")
            ]
        assert differences == [], f"La migración difiere de los modelos: {differences}"
    finally:
        engine.dispose()


def test_las_restricciones_check_de_la_migracion_coinciden_con_las_de_los_modelos(
    migrated_url: str,
) -> None:
    """``compare_metadata`` no compara los CHECK, así que se comparan sus nombres aparte."""
    command.upgrade(_alembic_config(), "head")
    engine = create_engine(migrated_url)
    try:
        inspector = inspect(engine)
        for table in Base.metadata.sorted_tables:
            expected = {
                str(constraint.name)
                for constraint in table.constraints
                if isinstance(constraint, CheckConstraint)
            }
            actual = {check["name"] for check in inspector.get_check_constraints(table.name)}
            assert actual == expected, f"CHECK distintos en {table.name}"
    finally:
        engine.dispose()


def test_las_claves_foraneas_son_restrict(migrated_url: str) -> None:
    command.upgrade(_alembic_config(), "head")
    engine = create_engine(migrated_url)
    try:
        with engine.connect() as connection:
            rules = (
                connection.execute(
                    text(
                        "SELECT DISTINCT delete_rule "
                        "FROM information_schema.referential_constraints "
                        "WHERE constraint_schema = 'public'"
                    )
                )
                .scalars()
                .all()
            )
        assert rules == ["RESTRICT"]
    finally:
        engine.dispose()


def test_downgrade_base_deja_la_base_vacia_y_se_puede_volver_a_subir(migrated_url: str) -> None:
    config = _alembic_config()
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    engine = create_engine(migrated_url)
    try:
        assert _user_tables(engine) == set()
        command.upgrade(config, "head")
        assert _user_tables(engine) == EXPECTED_TABLES
    finally:
        engine.dispose()
