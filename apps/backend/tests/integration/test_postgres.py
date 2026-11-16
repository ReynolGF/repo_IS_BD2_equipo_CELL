import pytest
from sqlalchemy import Engine, text

pytestmark = pytest.mark.integration


def test_postgres_responde(pg_engine: Engine) -> None:
    with pg_engine.connect() as conn:
        assert conn.execute(text("SELECT 1")).scalar() == 1
