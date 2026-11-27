"""Acceso a datos de líneas, equipos y asignaciones de operarios."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import OperationalStatus
from app.models.infrastructure import (
    EquipmentLineMembership,
    EquipmentSystem,
    ProductionLine,
)


def _like_pattern(text: str) -> str:
    """Escapa los comodines de LIKE para que la búsqueda sea literal."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# --- Líneas ---------------------------------------------------------------------------------


def get_line(db: Session, id_line: int) -> ProductionLine | None:
    """Devuelve la línea con sus equipos, o ``None`` si no existe."""
    return db.scalar(
        select(ProductionLine)
        .where(ProductionLine.id_line == id_line)
        .options(
            selectinload(ProductionLine.equipment).selectinload(EquipmentLineMembership.equipment)
        )
        .execution_options(populate_existing=True)
    )


def get_line_by_name(db: Session, name: str) -> ProductionLine | None:
    """Devuelve la línea con ese nombre (sin distinguir mayúsculas), o ``None``."""
    return db.scalar(select(ProductionLine).where(func.lower(ProductionLine.name) == name.lower()))


def list_lines(db: Session, *, limit: int, offset: int) -> tuple[Sequence[ProductionLine], int]:
    """Lista líneas con sus equipos, ordenadas por nombre, y el total."""
    total = db.scalar(select(func.count()).select_from(ProductionLine)) or 0
    lines = db.scalars(
        select(ProductionLine)
        .options(
            selectinload(ProductionLine.equipment).selectinload(EquipmentLineMembership.equipment)
        )
        .order_by(ProductionLine.name, ProductionLine.id_line)
        .limit(limit)
        .offset(offset)
    ).all()
    return lines, total


# --- Equipos --------------------------------------------------------------------------------


def get_equipment(db: Session, id_equipment: int) -> EquipmentSystem | None:
    """Devuelve el equipo con sus líneas, o ``None`` si no existe."""
    return db.scalar(
        select(EquipmentSystem)
        .where(EquipmentSystem.id_equipment == id_equipment)
        .options(selectinload(EquipmentSystem.lines))
        .execution_options(populate_existing=True)
    )


def list_equipment(
    db: Session,
    *,
    id_line: int | None = None,
    operational_status: OperationalStatus | None = None,
    search: str | None = None,
    limit: int,
    offset: int,
) -> tuple[Sequence[EquipmentSystem], int]:
    """Lista equipos con filtros y paginación, ordenados por nombre.

    Args:
        db: Sesión de base de datos.
        id_line: Solo los equipos que cubre esa línea.
        operational_status: Solo los equipos en ese estado.
        search: Texto contenido en el nombre o la descripción.
        limit: Máximo de resultados.
        offset: Resultados a saltar.
    """
    conditions = []
    if id_line is not None:
        conditions.append(
            EquipmentSystem.id_equipment.in_(
                select(EquipmentLineMembership.id_equipment).where(
                    EquipmentLineMembership.id_line == id_line
                )
            )
        )
    if operational_status is not None:
        conditions.append(EquipmentSystem.operational_status == operational_status)
    if search:
        pattern = _like_pattern(search)
        conditions.append(
            EquipmentSystem.name.ilike(pattern, escape="\\")
            | EquipmentSystem.description.ilike(pattern, escape="\\")
        )
    total = db.scalar(select(func.count()).select_from(EquipmentSystem).where(*conditions)) or 0
    equipment = db.scalars(
        select(EquipmentSystem)
        .where(*conditions)
        .options(selectinload(EquipmentSystem.lines))
        .order_by(EquipmentSystem.name, EquipmentSystem.id_equipment)
        .limit(limit)
        .offset(offset)
    ).all()
    return equipment, total


def get_membership(db: Session, id_line: int, id_equipment: int) -> EquipmentLineMembership | None:
    """Devuelve la asociación línea-equipo, o ``None`` si no existe."""
    return db.get(EquipmentLineMembership, (id_line, id_equipment))
