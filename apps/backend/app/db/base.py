"""Base declarativa de SQLAlchemy y convención de nombres de restricciones."""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Toda restricción e índice recibe un nombre predecible. Sin esto, PostgreSQL inventa nombres y
# Alembic no puede modificar ni borrar restricciones de forma fiable en migraciones futuras.
# Los CHECK se nombran con ``name="..."`` sin prefijo: la convención añade ``ck_<tabla>_``.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Clase base de todos los modelos ORM."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
