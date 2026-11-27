"""Gestión de líneas de producción, equipos y su asociación (RF1, RF2, RF3, RF41)."""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.db.enums import OperationalStatus
from app.models.infrastructure import EquipmentLineMembership, EquipmentSystem, ProductionLine
from app.repositories import infrastructure as repo
from app.schemas.infrastructure import (
    EquipmentCreate,
    EquipmentUpdate,
    LineCreate,
    LineUpdate,
)

_DUPLICATE_LINE = "Ya existe una línea con ese nombre"


def _delete_or_conflict(db: Session, statement: Any, message: str) -> None:
    """Ejecuta un ``DELETE`` y lo convierte en 409 si lo impide una clave foránea RESTRICT."""
    try:
        with db.begin_nested():
            db.execute(statement)
    except IntegrityError:
        raise ConflictError(message) from None
    db.commit()


# --- Líneas ---------------------------------------------------------------------------------


def create_line(db: Session, data: LineCreate) -> ProductionLine:
    """Registra una línea de producción.

    Raises:
        ConflictError: Ya existe una línea con ese nombre (sin distinguir mayúsculas).
    """
    if repo.get_line_by_name(db, data.name) is not None:
        raise ConflictError(_DUPLICATE_LINE)
    line = ProductionLine(name=data.name, production_process=data.production_process)
    db.add(line)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(_DUPLICATE_LINE) from None
    return get_line(db, line.id_line)


def get_line(db: Session, id_line: int) -> ProductionLine:
    """Devuelve la línea con sus equipos.

    Raises:
        NotFoundError: La línea no existe.
    """
    line = repo.get_line(db, id_line)
    if line is None:
        raise NotFoundError("Línea no encontrada")
    return line


def list_lines(db: Session, *, limit: int, offset: int) -> tuple[Sequence[ProductionLine], int]:
    """Lista las líneas con sus equipos y el total."""
    return repo.list_lines(db, limit=limit, offset=offset)


def update_line(db: Session, id_line: int, data: LineUpdate) -> ProductionLine:
    """Modifica el nombre o el proceso productivo de una línea.

    Raises:
        NotFoundError: La línea no existe.
        ConflictError: El nuevo nombre ya lo usa otra línea.
    """
    line = get_line(db, id_line)
    changes = data.model_dump(exclude_unset=True)
    if "name" in changes:
        other = repo.get_line_by_name(db, changes["name"])
        if other is not None and other.id_line != id_line:
            raise ConflictError(_DUPLICATE_LINE)
    for field, value in changes.items():
        setattr(line, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(_DUPLICATE_LINE) from None
    return get_line(db, id_line)


def delete_line(db: Session, id_line: int) -> None:
    """Elimina una línea que no tenga nada asociado.

    Raises:
        NotFoundError: La línea no existe.
        ConflictError: Tiene equipos, autorizaciones, operarios o planes asociados.
    """
    get_line(db, id_line)
    _delete_or_conflict(
        db,
        delete(ProductionLine).where(ProductionLine.id_line == id_line),
        "No se puede eliminar la línea: tiene equipos, autorizaciones, operarios o planes "
        "asociados",
    )
