"""Acceso a datos de líneas, equipos y asignaciones de operarios."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import OperationalStatus
from app.models.infrastructure import (
    EquipmentLineMembership,
    EquipmentSystem,
    LineAssignment,
    ProductionLine,
)
from app.models.users import Operator, User


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
