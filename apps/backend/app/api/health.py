"""Endpoints de estado del servicio."""

from collections.abc import Callable

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db, mongo_client, redis_client

router = APIRouter(tags=["health"])


def _check(probe: Callable[[], object]) -> str:
    """Ejecuta una comprobación y devuelve ``"ok"`` o el tipo de error ocurrido."""
    try:
        probe()
    except Exception as exc:  # noqa: BLE001 - cualquier fallo significa servicio no disponible
        return f"error: {type(exc).__name__}"
    return "ok"


@router.get("/health")
def health() -> dict[str, str]:
    """Indica que el proceso de la API está vivo."""
    return {"status": "ok"}


@router.get("/health/ready")
def ready(response: Response, db: Session = Depends(get_db)) -> dict[str, str]:
    """Comprueba la conexión con PostgreSQL, MongoDB y Redis.

    Responde 200 si los tres servicios contestan y 503 si alguno falla, indicando cuál.
    """
    result = {
        "postgres": _check(lambda: db.execute(text("SELECT 1"))),
        "mongo": _check(lambda: mongo_client.admin.command("ping")),
        "redis": _check(redis_client.ping),
    }
    if any(value != "ok" for value in result.values()):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return result
