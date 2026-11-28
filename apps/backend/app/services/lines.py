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


# --- Equipos --------------------------------------------------------------------------------


def create_equipment(db: Session, data: EquipmentCreate) -> EquipmentSystem:
    """Registra un equipo o sistema con su estado operativo inicial."""
    equipment = EquipmentSystem(
        name=data.name,
        description=data.description,
        operational_status=data.operational_status,
        status_date=datetime.now(UTC),
    )
    db.add(equipment)
    db.commit()
    return get_equipment(db, equipment.id_equipment)


def get_equipment(db: Session, id_equipment: int) -> EquipmentSystem:
    """Devuelve el equipo con las líneas que lo cubren.

    Raises:
        NotFoundError: El equipo no existe.
    """
    equipment = repo.get_equipment(db, id_equipment)
    if equipment is None:
        raise NotFoundError("Equipo no encontrado")
    return equipment


def list_equipment(
    db: Session,
    *,
    id_line: int | None,
    operational_status: OperationalStatus | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[EquipmentSystem], int]:
    """Lista equipos con filtros y paginación.

    Raises:
        NotFoundError: Se filtra por una línea que no existe.
    """
    if id_line is not None and repo.get_line(db, id_line) is None:
        raise NotFoundError("Línea no encontrada")
    return repo.list_equipment(
        db,
        id_line=id_line,
        operational_status=operational_status,
        search=search,
        limit=limit,
        offset=offset,
    )


def update_equipment(db: Session, id_equipment: int, data: EquipmentUpdate) -> EquipmentSystem:
    """Modifica el nombre o la descripción de un equipo.

    Raises:
        NotFoundError: El equipo no existe.
    """
    equipment = get_equipment(db, id_equipment)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(equipment, field, value)
    db.commit()
    return get_equipment(db, id_equipment)


def update_status(db: Session, id_equipment: int, status: OperationalStatus) -> EquipmentSystem:
    """Cambia el estado operativo vigente de un equipo (RF41).

    La fecha del estado solo se actualiza si el estado cambia de verdad.

    Raises:
        NotFoundError: El equipo no existe.
    """
    equipment = get_equipment(db, id_equipment)
    if equipment.operational_status != status:
        equipment.operational_status = status
        equipment.status_date = datetime.now(UTC)
        db.commit()
        # Fase 6: aquí se invalida o actualiza la caché de Redis del estado operativo (RF42).
    return get_equipment(db, id_equipment)


def delete_equipment(db: Session, id_equipment: int) -> None:
    """Elimina un equipo que no esté asociado a líneas ni tenga tareas.

    Raises:
        NotFoundError: El equipo no existe.
        ConflictError: Está asociado a líneas o tiene tareas.
    """
    get_equipment(db, id_equipment)
    _delete_or_conflict(
        db,
        delete(EquipmentSystem).where(EquipmentSystem.id_equipment == id_equipment),
        "No se puede eliminar el equipo: está asociado a líneas o tiene tareas",
    )


# --- Asociación línea-equipo ----------------------------------------------------------------


def add_equipment_to_line(db: Session, id_line: int, id_equipment: int) -> EquipmentSystem:
    """Asocia un equipo a una línea (idempotente).

    Raises:
        NotFoundError: La línea o el equipo no existen.
    """
    get_line(db, id_line)
    equipment = get_equipment(db, id_equipment)
    if repo.get_membership(db, id_line, id_equipment) is None:
        db.add(EquipmentLineMembership(id_line=id_line, id_equipment=id_equipment))
        db.commit()
    return equipment


def remove_equipment_from_line(db: Session, id_line: int, id_equipment: int) -> None:
    """Quita la asociación de un equipo con una línea.

    Raises:
        NotFoundError: La asociación no existe.
    """
    if repo.get_membership(db, id_line, id_equipment) is None:
        raise NotFoundError("El equipo no está asociado a esa línea")
    db.execute(
        delete(EquipmentLineMembership).where(
            EquipmentLineMembership.id_line == id_line,
            EquipmentLineMembership.id_equipment == id_equipment,
        )
    )
    db.commit()
