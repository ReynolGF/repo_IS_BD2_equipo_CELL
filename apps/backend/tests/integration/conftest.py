"""Fixtures de integración: bases de datos reales y desechables con testcontainers."""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, create_engine
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def pg_engine() -> Iterator[Engine]:
    """Levanta un PostgreSQL temporal para toda la sesión de pruebas (requiere Docker)."""
    with PostgresContainer("postgres:16", driver="psycopg") as pg:
        engine = create_engine(pg.get_connection_url())
        yield engine
        engine.dispose()
