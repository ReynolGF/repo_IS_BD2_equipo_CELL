"""Configuración de la aplicación leída desde variables de entorno."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_files() -> tuple[str, ...]:
    """Devuelve las rutas de los archivos ``.env`` a leer; el último tiene prioridad.

    Se calculan a partir de la ubicación de este archivo y no del directorio actual, así que
    funcionan igual al ejecutar desde la raíz, desde ``apps/backend`` o desde Alembic.

    - ``<raíz del monorepo>/.env``: el que usa Docker Compose.
    - ``apps/backend/.env``: opcional, para ajustes propios del backend.

    Dentro del contenedor el código vive en ``/code`` y no existe raíz del monorepo; allí las
    variables llegan desde ``docker-compose.yml``.
    """
    parents = Path(__file__).resolve().parents
    backend_dir = parents[2]  # .../apps/backend
    files: list[Path] = []
    if len(parents) > 4:
        files.append(parents[4] / ".env")  # raíz del monorepo
    files.append(backend_dir / ".env")
    return tuple(str(path) for path in files)


class Settings(BaseSettings):
    """Ajustes globales; cada campo se puede sobrescribir con una variable de entorno.

    Las variables de entorno reales ganan a los archivos ``.env``.
    """

    app_name: str = "Sistema de Mantenimiento Industrial"
    # URL de la base de datos SQL(PostgreSQl)
    sql_database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/sistema_mantenimiento",
        alias="POSTGRES_DATABASE_URL",
    )
    # URL de la base de datos no SQL(Mongo DB)
    mongo_db_url: str = Field(default="mongodb://localhost:27017", alias="MONGO_DB_URL")
    mongo_db_name: str = Field(default="mantenimiento", alias="MONGO_DB_NAME")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    # Clave secreta para encriptación de los tokens de acceso
    secret_key: str = Field(default="change_this_secret_key", alias="SECRET_KEY")
    # Algoritmo de encriptación de los tokens
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    # Tiempo que tarda en caducar un token de acceso de usuario
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Orígenes del frontend permitidos por CORS, separados por comas.
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173", alias="CORS_ORIGINS"
    )

    model_config = SettingsConfigDict(
        env_file=_env_files(),
        extra="ignore",
        populate_by_name=True,
    )

    @field_validator("sql_database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Fuerza el driver ``psycopg`` (v3) en la URL de PostgreSQL.

        Con una URL ``postgresql://`` SQLAlchemy intenta usar ``psycopg2``, que este proyecto no
        instala, y la conexión falla. Así sirve cualquier forma de escribir la URL.
        """
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        """Devuelve los orígenes CORS permitidos como lista, sin espacios ni vacíos."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Devuelve la configuración, creada una sola vez por proceso."""
    return Settings()
