"""Acceso a datos de las tareas de mantenimiento."""

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.enums import Criticality, TaskType
from app.models.infrastructure import EquipmentLineMembership
from app.models.tasks import Task
from app.models.users import Technician

_EAGER = (
    joinedload(Task.equipment),
    joinedload(Task.creator_technician).joinedload(Technician.user),
)


def _like_pattern(text: str) -> str:
    """Escapa los comodines de LIKE para que la búsqueda sea literal."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def get(db: Session, id_task: int) -> Task | None:
    """Devuelve la tarea con su equipo y su creador, o ``None`` si no existe."""
    return db.scalar(
        select(Task)
        .where(Task.id_task == id_task)
        .options(*_EAGER)
        .execution_options(populate_existing=True)
    )


def list_tasks(
    db: Session,
    *,
    id_line: int | None = None,
    id_equipment: int | None = None,
    id_creator: int | None = None,
    type_: TaskType | None = None,
    criticality: Criticality | None = None,
    search: str | None = None,
    limit: int,
    offset: int,
) -> tuple[Sequence[Task], int]:
    """Lista tareas con filtros y paginación, ordenadas por id.

    Args:
        db: Sesión de base de datos.
        id_line: Solo las tareas de equipos que cubre esa línea.
        id_equipment: Solo las tareas de ese equipo.
        id_creator: Solo las creadas por ese técnico.
        type_: Solo las de ese tipo de mantenimiento.
        criticality: Solo las de ese nivel de criticidad.
        search: Texto contenido en la descripción.
        limit: Máximo de resultados.
        offset: Resultados a saltar.
    """
    conditions = []
    if id_line is not None:
        conditions.append(
            Task.id_equipment.in_(
                select(EquipmentLineMembership.id_equipment).where(
                    EquipmentLineMembership.id_line == id_line
                )
            )
        )
    if id_equipment is not None:
        conditions.append(Task.id_equipment == id_equipment)
    if id_creator is not None:
        conditions.append(Task.id_creator_technician == id_creator)
    if type_ is not None:
        conditions.append(Task.type == type_)
    if criticality is not None:
        conditions.append(Task.criticality_level == criticality)
    if search:
        conditions.append(Task.description.ilike(_like_pattern(search), escape="\\"))

    total = db.scalar(select(func.count()).select_from(Task).where(*conditions)) or 0
    tasks = db.scalars(
        select(Task)
        .where(*conditions)
        .options(*_EAGER)
        .order_by(Task.id_task)
        .limit(limit)
        .offset(offset)
    ).all()
    return tasks, total


def descriptions_for(db: Session, id_equipment: int, type_: TaskType) -> Sequence[tuple[int, str]]:
    """Devuelve ``(id, descripción)`` de las tareas de un equipo y tipo, para buscar duplicados."""
    rows = db.execute(
        select(Task.id_task, Task.description).where(
            Task.id_equipment == id_equipment, Task.type == type_
        )
    ).all()
    return [(row[0], row[1]) for row in rows]


def equipment_in_line(db: Session, id_equipment: int, id_line: int) -> bool:
    """Indica si la línea cubre ese equipo."""
    return db.get(EquipmentLineMembership, (id_line, id_equipment)) is not None


def lines_of_equipment(db: Session, id_equipment: int) -> Sequence[int]:
    """Devuelve los identificadores de las líneas que cubren un equipo."""
    return db.scalars(
        select(EquipmentLineMembership.id_line).where(
            EquipmentLineMembership.id_equipment == id_equipment
        )
    ).all()
