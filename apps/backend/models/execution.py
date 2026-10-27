from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    String, Integer, DateTime, ForeignKey, ForeignKeyConstraint, CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.backend.db.base import Base
from apps.backend.db.enums import InterventionResult, ManualResult, ReinspectionStatus
from apps.backend.models.users import Technician, PlantManager, Operator
from apps.backend.models.tasks import Task
from apps.backend.models.plans import Plan

class Intervention(Base):
    __tablename__ = "intervention"

    id_intervention: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    datetime: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    result: Mapped[InterventionResult] = mapped_column(
        InterventionResult, nullable=False
    )
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Flat columns
    id_plan: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    id_task: Mapped[int] = mapped_column(Integer, nullable=False)
    id_operator: Mapped[int] = mapped_column(
        ForeignKey("operator.id_operator", ondelete="RESTRICT"), nullable=False, index=True
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["id_plan", "id_task"],
            ["task_plan_membership.id_plan", "task_plan_membership.id_task"],
            name="fk_intervention_task_plan_membership",
            ondelete="RESTRICT", onupdate="CASCADE",
        ),
    )

    plan: Mapped["Plan"] = relationship(
        primaryjoin="Plan.id_plan == foreign(Intervention.id_plan)",
        back_populates="interventions",
        viewonly=True,
    )
    task: Mapped["Task"] = relationship(
        primaryjoin="Task.id_task == foreign(Intervention.id_task)",
    )
    operator: Mapped["Operator"] = relationship(back_populates="interventions")
    reinspections: Mapped[List["Reinspection"]] = relationship(
        back_populates="intervention", cascade="all, delete-orphan"
    )



class Reinspection(Base):
    __tablename__ = "reinspection"

    id_reinspection: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_date: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[ReinspectionStatus] = mapped_column(
        ReinspectionStatus,
        nullable=False,
        default=ReinspectionStatus.pending,
    )
    manual_result: Mapped[Optional[ManualResult]] = mapped_column(
        ManualResult, nullable=True
    )
    resolution_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    id_intervention: Mapped[int] = mapped_column(
        ForeignKey("intervention.id_intervention", ondelete="CASCADE"), nullable=False
    )
    id_additional_technician: Mapped[Optional[int]] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=True
    )
    id_resolver_technician: Mapped[Optional[int]] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "(status = 'pending') OR "
            "(id_resolver_technician IS NOT NULL AND resolution_date IS NOT NULL "
            "AND manual_result IS NOT NULL)",
            name="ck_reinspection_attended_complete",
        ),
    )

    intervention: Mapped["Intervention"] = relationship(back_populates="reinspections")
    additional_technician: Mapped[Optional["Technician"]] = relationship(
        back_populates="additional_reinspections",
        foreign_keys=[id_additional_technician],
    )
    resolver_technician: Mapped[Optional["Technician"]] = relationship(
        back_populates="resolved_reinspections",
        foreign_keys=[id_resolver_technician],
    )