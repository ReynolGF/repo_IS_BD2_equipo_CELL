"""Gestión de tareas de mantenimiento (RF4 a RF8).

Reglas:

* Cualquier técnico activo registra tareas sobre cualquier equipo.
* Cada técnico modifica y elimina solo las tareas que él creó (RF7).
* No puede haber dos tareas con el mismo equipo, tipo y descripción (RF6). La base de datos
  impide la coincidencia literal; aquí se compara además el texto normalizado (minúsculas, sin
  tildes, espacios colapsados), de modo que «Revisar Rodamiento» y «revisar  rodamiento» son la
  misma tarea.
* Un técnico ve las tareas de otros técnicos solo de las líneas donde está autorizado (RF8). El
  administrador y el jefe de planta ven todas.
"""


from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.text import normalize_text
from app.db.enums import TaskType
from app.models.infrastructure import EquipmentSystem
from app.models.tasks import Task
from app.models.users import Technician
from app.repositories import tasks as repo
from app.schemas.tasks import TaskCreate

_DUPLICATE = "Ya existe una tarea equivalente para ese equipo y tipo"


def _require_equipment(db: Session, id_equipment: int) -> None:
    """Lanza ``NotFoundError`` si el equipo no existe."""
    if db.get(EquipmentSystem, id_equipment) is None:
        raise NotFoundError("Equipo no encontrado")


def _ensure_not_duplicate(
    db: Session,
    *,
    id_equipment: int,
    type_: TaskType,
    description: str,
    exclude_id: int | None = None,
) -> None:
    """Lanza ``ConflictError`` si ya hay una tarea equivalente (RF6).

    Raises:
        ConflictError: Existe otra tarea del mismo equipo y tipo con la misma descripción
            normalizada.
    """
    wanted = normalize_text(description)
    for id_task, existing in repo.descriptions_for(db, id_equipment, type_):
        if id_task != exclude_id and normalize_text(existing) == wanted:
            raise ConflictError(f"{_DUPLICATE} (tarea {id_task})")


def create_task(db: Session, technician: Technician, data: TaskCreate) -> Task:
    """Registra una tarea a nombre del técnico.

    Raises:
        NotFoundError: El equipo no existe.
        ConflictError: Ya existe una tarea equivalente.
    """
    _require_equipment(db, data.id_equipment)
    _ensure_not_duplicate(
        db, id_equipment=data.id_equipment, type_=data.type, description=data.description
    )
    task = Task(
        description=data.description,
        type=data.type,
        criticality_level=data.criticality_level,
        id_equipment=data.id_equipment,
        id_creator_technician=technician.id_technician,
    )
    db.add(task)
    try:
        db.commit()
    except IntegrityError:
        # Carrera entre dos peticiones idénticas: la restricción única de la base de datos gana.
        db.rollback()
        raise ConflictError(_DUPLICATE) from None
    return get_task_row(db, task.id_task)


def get_task_row(db: Session, id_task: int) -> Task:
    """Devuelve la tarea sin comprobar permisos de lectura.

    Raises:
        NotFoundError: La tarea no existe.
    """
    task = repo.get(db, id_task)
    if task is None:
        raise NotFoundError("Tarea no encontrada")
    return task
