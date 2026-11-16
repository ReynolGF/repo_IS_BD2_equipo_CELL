from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api import health
from app.core.database import get_db
from app.main import app


def test_health_devuelve_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.fixture
def servicios_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sustituye Postgres, Mongo y Redis por dobles que siempre responden bien."""
    app.dependency_overrides[get_db] = lambda: MagicMock()
    monkeypatch.setattr(health, "mongo_client", MagicMock())
    monkeypatch.setattr(health, "redis_client", MagicMock())


def test_ready_con_todos_los_servicios_ok(client: TestClient, servicios_ok: None) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {"postgres": "ok", "mongo": "ok", "redis": "ok"}


def test_ready_devuelve_503_si_redis_falla(
    client: TestClient, servicios_ok: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    redis_roto = MagicMock()
    redis_roto.ping.side_effect = ConnectionError("sin conexión")
    monkeypatch.setattr(health, "redis_client", redis_roto)

    response = client.get("/health/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["redis"] == "error: ConnectionError"
    assert body["postgres"] == "ok"
    assert body["mongo"] == "ok"
