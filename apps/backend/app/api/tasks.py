"""Tareas de mantenimiento (RF4 a RF8)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_technician, require_role
from app.core.database import get_db
from app.db.enums import Occupation
from app.models.users import Technician
from app.schemas.tasks import TaskCreate, TaskRead
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
