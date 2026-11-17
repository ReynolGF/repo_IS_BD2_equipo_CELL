"""Ejecución de los planes: intervenciones de los operarios y reinspecciones."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import InterventionResult, ManualResult, ReinspectionStatus
from app.db.types import enum_column

if TYPE_CHECKING:
    from app.models.plans import Plan
    from app.models.tasks import Task
    from app.models.users import Operator, Technician


class Intervention(Base):
    """Intervención de un operario sobre una tarea de un plan.

    La clave foránea compuesta ``(id_plan, id_task)`` hacia ``task_plan_membership`` impide
    registrar una intervención sobre una tarea que no pertenece al plan.
    """

    __tablename__ = "intervention"

    id_intervention: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    result: Mapped[InterventionResult] = mapped_column(
        enum_column(InterventionResult, "result"), nullable=False
    )
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Columnas planas: la FK compuesta se declara en __table_args__.
    id_plan: Mapped[int] = mapped_column(Integer, nullable=False)
    id_task: Mapped[int] = mapped_column(Integer, nullable=False)
    id_operator: Mapped[int] = mapped_column(
        ForeignKey("operator.id_operator", ondelete="RESTRICT"), nullable=False, index=True
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["id_plan", "id_task"],
            ["task_plan_membership.id_plan", "task_plan_membership.id_task"],
            name="fk_intervention_task_plan_membership",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        # Cubre las búsquedas por plan y por (plan, tarea) de los reportes.
        Index("ix_intervention_plan_task", "id_plan", "id_task"),
    )

    # Ambas son de solo lectura: se asignan id_plan e id_task directamente.
    plan: Mapped["Plan"] = relationship(
        primaryjoin="Plan.id_plan == foreign(Intervention.id_plan)",
        back_populates="interventions",
        viewonly=True,
    )
    task: Mapped["Task"] = relationship(
        primaryjoin="Task.id_task == foreign(Intervention.id_task)",
        viewonly=True,
    )
    operator: Mapped["Operator"] = relationship(back_populates="interventions")
    # Sin cascade de borrado: las reinspecciones son historial.
    reinspections: Mapped[List["Reinspection"]] = relationship(back_populates="intervention")


class Reinspection(Base):
    """Solicitud de reinspección de una intervención, con técnico de apoyo y resolutor."""

    __tablename__ = "reinspection"

    id_reinspection: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[ReinspectionStatus] = mapped_column(
        enum_column(ReinspectionStatus, "status"),
        nullable=False,
        default=ReinspectionStatus.pending,
        server_default=ReinspectionStatus.pending.value,
    )
    manual_result: Mapped[Optional[ManualResult]] = mapped_column(
        enum_column(ManualResult, "manual_result"), nullable=True
    )
    resolution_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    id_intervention: Mapped[int] = mapped_column(
        ForeignKey("intervention.id_intervention", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    id_additional_technician: Mapped[Optional[int]] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=True, index=True
    )
    id_resolver_technician: Mapped[Optional[int]] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=True, index=True
    )

    __table_args__ = (
        # Pendiente: sin resolutor, fecha ni resultado. Atendida: los tres son obligatorios.
        CheckConstraint(
            "(status = 'pending' AND id_resolver_technician IS NULL "
            "AND resolution_date IS NULL AND manual_result IS NULL) OR "
            "(status = 'attended' AND id_resolver_technician IS NOT NULL "
            "AND resolution_date IS NOT NULL AND manual_result IS NOT NULL)",
            name="state_consistency",
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
