from typing import List
from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.backend.db.base import Base
from apps.backend.db.enums import TaskType, Criticality
from apps.backend.models.infrastructure import EquipmentSystem
from apps.backend.models.plans import TaskPlanMembership
from apps.backend.models.users import Technician

class Task(Base):
    __tablename__ = "task"

    id_task: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[TaskType] = mapped_column(TaskType, nullable=False)
    criticality_level: Mapped[Criticality] = mapped_column(Criticality, nullable=False)
    id_equipment: Mapped[int] = mapped_column(
        ForeignKey("equipment_system.id_equipment", ondelete="RESTRICT"), nullable=False
    )
    id_creator_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("id_equipment", "type", "description", name="uq_task_equipment_type_desc"),
    )

    equipment: Mapped["EquipmentSystem"] = relationship(back_populates="tasks")
    creator_technician: Mapped["Technician"] = relationship(back_populates="created_tasks")
    plans: Mapped[List["TaskPlanMembership"]] = relationship(back_populates="task")