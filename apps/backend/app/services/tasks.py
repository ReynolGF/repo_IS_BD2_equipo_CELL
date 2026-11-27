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

from collections.abc import Sequence

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.core.text import normalize_text
from app.db.enums import Criticality, Occupation, TaskType
from app.models.infrastructure import EquipmentSystem
from app.models.tasks import Task
from app.models.users import Technician, User
from app.repositories import authorizations as auth_repo
from app.repositories import tasks as repo
from app.schemas.tasks import TaskCreate, TaskUpdate

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
    """Lanza ``ConflictError``  si ya hay una tarea equivalente (RF6).

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


def _technician_covers_equipment(db: Session, id_technician: int, id_equipment: int) -> bool:
    """Indica si el técnico está autorizado en alguna línea que cubre el equipo."""
    return any(
        auth_repo.find_active(db, id_technician, id_line) is not None
        for id_line in repo.lines_of_equipment(db, id_equipment)
    )


def get_task(db: Session, user: User, id_task: int) -> Task:
    """Devuelve una tarea si el usuario puede verla.

    Raises:
        NotFoundError: La tarea no existe.
        PermissionDeniedError: Un técnico pide una tarea ajena de una línea donde no está
            autorizado.
    """
    task = get_task_row(db, id_task)
    if user.occupation in (Occupation.administrator, Occupation.plant_manager):
        return task
    technician = user.technician
    if (
        technician is not None
        and user.occupation is Occupation.technician
        and (
            task.id_creator_technician == technician.id_technician
            or _technician_covers_equipment(db, technician.id_technician, task.id_equipment)
        )
    ):
        return task
    raise PermissionDeniedError("No tienes permiso para ver esta tarea")


def list_own(
    db: Session,
    technician: Technician,
    *,
    id_equipment: int | None,
    type_: TaskType | None,
    criticality: Criticality | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[Sequence[Task], int]:
    """Lista las tareas creadas por el técnico (RF7)."""
    return repo.list_tasks(
        db,
        id_creator=technician.id_technician,
        id_equipment=id_equipment,
        type_=type_,
        criticality=criticality,
        search=search,
        limit=limit,
        offset=offset,
    )


def _require_owner(technician: Technician, task: Task) -> None:
    """Lanza ``PermissionDeniedError`` si la tarea no la creó el técnico (RF7)."""
    if task.id_creator_technician != technician.id_technician:
        raise PermissionDeniedError("Solo el técnico que creó la tarea puede modificarla")


def update_task(db: Session, technician: Technician, id_task: int, data: TaskUpdate) -> Task:
    """Modifica una tarea propia, comprobando de nuevo que no quede duplicada.

    Raises:
        NotFoundError: La tarea o el nuevo equipo no existen.
        PermissionDeniedError: La tarea es de otro técnico.
        ConflictError: El resultado coincidiría con otra tarea.
    """
    task = get_task_row(db, id_task)
    _require_owner(technician, task)
    changes = data.model_dump(exclude_unset=True)
    if "id_equipment" in changes:
        _require_equipment(db, changes["id_equipment"])
    _ensure_not_duplicate(
        db,
        id_equipment=changes.get("id_equipment", task.id_equipment),
        type_=changes.get("type", task.type),
        description=changes.get("description", task.description),
        exclude_id=task.id_task,
    )
    for field, value in changes.items():
        setattr(task, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(_DUPLICATE) from None
    return get_task_row(db, id_task)


def delete_task(db: Session, technician: Technician, id_task: int) -> None:
    """Elimina una tarea propia que todavía no esté en ningún plan.

    Raises:
        NotFoundError: La tarea no existe.
        PermissionDeniedError: La tarea es de otro técnico.
        ConflictError: La tarea ya forma parte de algún plan.
    """
    task = get_task_row(db, id_task)
    _require_owner(technician, task)
    try:
        with db.begin_nested():
            db.execute(delete(Task).where(Task.id_task == id_task))
    except IntegrityError:
        raise ConflictError("No se puede eliminar la tarea: forma parte de algún plan") from None
    db.commit()
