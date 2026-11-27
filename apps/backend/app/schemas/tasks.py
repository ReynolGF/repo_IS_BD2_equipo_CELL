"""Esquemas de las tareas de mantenimiento (RF4, RF5, RF7)."""

from typing import Self

from pydantic import BaseModel, field_validator

from app.core.text import clean_text
from app.db.enums import Criticality, TaskType
from app.models.tasks import Task

DESCRIPTION_MIN = 3
DESCRIPTION_MAX = 500


def _clean_description(value: str | None) -> str | None:
    """Limpia la descripción y valida su longitud ya sin espacios sobrantes."""
    if value is None:
        return None
    cleaned = clean_text(value)
    if not DESCRIPTION_MIN <= len(cleaned) <= DESCRIPTION_MAX:
        raise ValueError(
            f"La descripción debe tener entre {DESCRIPTION_MIN} y {DESCRIPTION_MAX} caracteres"
        )
    return cleaned


class TaskCreate(BaseModel):
    """Datos para registrar una tarea."""

    description: str
    type: TaskType
    criticality_level: Criticality
    id_equipment: int

    _clean = field_validator("description")(_clean_description)


class TaskRead(BaseModel):
    """Tarea con el nombre de su equipo y de su creador."""

    id_task: int
    description: str
    type: TaskType
    criticality_level: Criticality
    id_equipment: int
    equipment_name: str
    id_creator_technician: int
    creator_name: str

    @classmethod
    def from_task(cls, task: Task) -> Self:
        """Construye la respuesta a partir del modelo (con equipo y creador ya cargados)."""
        return cls(
            id_task=task.id_task,
            description=task.description,
            type=task.type,
            criticality_level=task.criticality_level,
            id_equipment=task.id_equipment,
            equipment_name=task.equipment.name,
            id_creator_technician=task.id_creator_technician,
            creator_name=task.creator_technician.user.name,
        )
