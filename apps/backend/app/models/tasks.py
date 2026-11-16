"""Banco de tareas de mantenimiento."""

from typing import TYPE_CHECKING, List

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import Criticality, TaskType
from app.db.types import enum_column

if TYPE_CHECKING:
    from app.models.infrastructure import EquipmentSystem
    from app.models.plans import TaskPlanMembership
    from app.models.users import Technician


class Task(Base):
    """Tarea de mantenimiento sobre un equipo, creada por un técnico.

    La restricción única impide duplicados literales (mismo equipo, tipo y descripción).
    """

    __tablename__ = "task"
    __table_args__ = (
        UniqueConstraint("id_equipment", "type", "description", name="uq_task_equipment_type_desc"),
    )

    id_task: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[TaskType] = mapped_column(enum_column(TaskType, "type"), nullable=False)
    criticality_level: Mapped[Criticality] = mapped_column(
        enum_column(Criticality, "criticality_level"), nullable=False
    )
    id_equipment: Mapped[int] = mapped_column(
        ForeignKey("equipment_system.id_equipment", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_creator_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    equipment: Mapped["EquipmentSystem"] = relationship(back_populates="tasks")
    creator_technician: Mapped["Technician"] = relationship(back_populates="created_tasks")
    plans: Mapped[List["TaskPlanMembership"]] = relationship(back_populates="task")
