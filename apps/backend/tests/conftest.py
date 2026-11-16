"""Fixtures compartidas por las pruebas unitarias y de integración."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Cliente HTTP de pruebas; limpia los overrides de dependencias al terminar."""
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
