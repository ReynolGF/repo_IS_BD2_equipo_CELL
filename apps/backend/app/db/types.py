"""Tipos de columna reutilizables."""

import enum

from sqlalchemy import Enum as SAEnum


def enum_column(enum_cls: type[enum.Enum], name: str) -> SAEnum:
    """Crea un tipo ``VARCHAR`` + ``CHECK`` a partir de una enumeración de Python.

    Se evita el tipo ``ENUM`` nativo de PostgreSQL a propósito: el mismo ``ENUM`` usado en varias
    tablas (por ejemplo ``Criticality``) hace fallar las migraciones de Alembic con "type already
    exists", y añadir un valor obliga a ``ALTER TYPE``. Con ``VARCHAR`` + ``CHECK`` la restricción
    de dominio sigue en la base de datos y es fácil de migrar.

    Args:
        enum_cls: Enumeración de Python cuyos valores se almacenan.
        name: Nombre corto de la restricción. La convención de nombres la convierte en
            ``ck_<tabla>_<name>``.

    Returns:
        Tipo de SQLAlchemy listo para pasar a ``mapped_column``.
    """
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda members: [member.value for member in members],
    )
