"""Tareas de mantenimiento (RF4 a RF8)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_technician, require_role
from app.core.database import get_db
from app.db.enums import Criticality, Occupation, TaskType
from app.models.users import Technician, User
from app.schemas.common import Page
from app.schemas.tasks import TaskCreate, TaskRead, TaskUpdate
from app.services import tasks as service

router = APIRouter(tags=["tasks"])

_can_read_tasks = require_role(
    Occupation.technician, Occupation.plant_manager, Occupation.administrator
)


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreate,
    technician: Technician = Depends(get_current_technician),
    db: Session = Depends(get_db),
) -> TaskRead:
    """Registra una tarea a nombre del técnico (409 si ya existe una equivalente)."""
    return TaskRead.from_task(service.create_task(db, technician, body))


@router.get("/tasks", response_model=Page[TaskRead])
def list_my_tasks(
    id_equipment: int | None = Query(default=None),
    type: TaskType | None = Query(default=None),
    criticality_level: Criticality | None = Query(default=None),
    q: str | None = Query(default=None, max_length=100, description="Buscar en la descripción"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    technician: Technician = Depends(get_current_technician),
    db: Session = Depends(get_db),
) -> Page[TaskRead]:
    """Lista las tareas que creó el técnico autenticado."""
    tasks, total = service.list_own(
        db,
        technician,
        id_equipment=id_equipment,
        type_=type,
        criticality=criticality_level,
        search=q,
        limit=limit,
        offset=offset,
    )
    return Page[TaskRead](
        items=[TaskRead.from_task(task) for task in tasks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/tasks/{id_task}", response_model=TaskRead)
def get_task(
    id_task: int,
    user: User = Depends(_can_read_tasks),
    db: Session = Depends(get_db),
) -> TaskRead:
    """Devuelve una tarea.

    Un técnico ve las suyas y las de las líneas donde está autorizado; el administrador y el
    jefe de planta ven cualquiera.
    """
    return TaskRead.from_task(service.get_task(db, user, id_task))


@router.patch("/tasks/{id_task}", response_model=TaskRead)
def update_task(
    id_task: int,
    body: TaskUpdate,
    technician: Technician = Depends(get_current_technician),
    db: Session = Depends(get_db),
) -> TaskRead:
    """Modifica una tarea propia (403 si la creó otro técnico)."""
    return TaskRead.from_task(service.update_task(db, technician, id_task, body))


@router.delete("/tasks/{id_task}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    id_task: int,
    technician: Technician = Depends(get_current_technician),
    db: Session = Depends(get_db),
) -> None:
    """Elimina una tarea propia que no esté en ningún plan (409 si lo está)."""
    service.delete_task(db, technician, id_task)
