"""Conexiones a PostgreSQL, MongoDB y Redis.

Los tres clientes se crean de forma perezosa: importar este módulo no falla si los servicios
están caídos; el error aparece al hacer la primera operación.
"""

from collections.abc import Iterator
from typing import Any

from pymongo import MongoClient
from redis import Redis
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.sql_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

mongo_client: MongoClient[dict[str, Any]] = MongoClient(
    settings.mongo_db_url, serverSelectionTimeoutMS=2000
)
mongo_db = mongo_client[settings.mongo_db_name]
redis_client: Redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2)


def get_db() -> Iterator[Session]:
    """Dependencia de FastAPI: entrega una sesión SQL y la cierra al terminar."""
    with SessionLocal() as session:
        yield session
