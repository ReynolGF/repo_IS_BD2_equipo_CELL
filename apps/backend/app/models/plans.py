"""Planes de mantenimiento, sus revisiones, validaciones, tareas y asignaciones."""

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import Criticality, DecisionRevision, PlanStatus
from app.db.types import enum_column

if TYPE_CHECKING:
    from app.models.execution import Intervention
    from app.models.infrastructure import ProductionLine
    from app.models.tasks import Task
    from app.models.users import Operator, PlantManager, Technician


class Plan(Base):
    """Plan de mantenimiento generado para una línea, con sus parámetros de generación."""

    __tablename__ = "plan"

    id_plan: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    creation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    status: Mapped[PlanStatus] = mapped_column(
        enum_column(PlanStatus, "status"),
        nullable=False,
        default=PlanStatus.generated,
        server_default=PlanStatus.generated.value,
        index=True,
    )
    criticality_level: Mapped[Criticality] = mapped_column(
        enum_column(Criticality, "criticality_level"), nullable=False
    )
    preventive_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    corrective_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    predictive_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    system_coverage: Mapped[int] = mapped_column(Integer, nullable=False)
    total_task_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # Columnas "planas": sus claves foráneas se declaran en __table_args__ porque id_line e
    # id_creator_technician participan además en la FK compuesta hacia line_authorization.
    id_line: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    id_creator_technician: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    id_origin_revision: Mapped[Optional[int]] = mapped_column(
        # use_alter rompe el ciclo plan <-> revision al crear las tablas. UNIQUE admite varios
        # NULL en PostgreSQL: solo limita a un plan por revisión de origen.
        ForeignKey(
            "revision.id_revision",
            use_alter=True,
            name="fk_plan_origin_revision",
            ondelete="RESTRICT",
        ),
        unique=True,
        nullable=True,
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["id_line"],
            ["production_line.id_line"],
            name="fk_plan_line",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        ForeignKeyConstraint(
            ["id_creator_technician"],
            ["technician.id_technician"],
            name="fk_plan_creator_technician",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        # Regla de negocio en la base de datos: el creador debe tener autorización en la línea.
        ForeignKeyConstraint(
            ["id_creator_technician", "id_line"],
            ["line_authorization.id_technician", "line_authorization.id_line"],
            name="fk_plan_authorization",
            ondelete="RESTRICT",
            onupdate="CASCADE",
        ),
        CheckConstraint(
            "preventive_percentage >= 0 AND corrective_percentage >= 0 "
            "AND predictive_percentage >= 0",
            name="percentages_non_negative",
        ),
        # Los porcentajes se redondean al entero más cercano, así que la suma admite ±1 de
        # tolerancia (por ejemplo 33 + 33 + 33 = 99 al pedir un tercio de cada tipo).
        CheckConstraint(
            "preventive_percentage + corrective_percentage + predictive_percentage "
            "BETWEEN 99 AND 101",
            name="percentages_sum_tolerance",
        ),
        # system_coverage es el número de sistemas (equipos) distintos que cubre el plan: al menos
        # uno y nunca más que tareas, porque cada sistema cubierto aporta al menos una tarea.
        CheckConstraint(
            "system_coverage >= 1 AND system_coverage <= total_task_count",
            name="coverage_valid",
        ),
        CheckConstraint("total_task_count > 0", name="total_count_positive"),
    )

    line: Mapped["ProductionLine"] = relationship(foreign_keys=[id_line], back_populates="plans")
    creator_technician: Mapped["Technician"] = relationship(
        foreign_keys=[id_creator_technician], back_populates="created_plans"
    )
    origin_revision: Mapped[Optional["Revision"]] = relationship(
        foreign_keys=[id_origin_revision],
        back_populates="originated_plan",
        post_update=True,
    )
    # Ninguna relación borra en cascada: todas las claves foráneas son ON DELETE RESTRICT. Para
    # quitar una tarea de un plan se borra explícitamente su TaskPlanMembership.
    tasks: Mapped[List["TaskPlanMembership"]] = relationship(back_populates="plan")
    assignments: Mapped[List["PlanOperatorAssignment"]] = relationship(back_populates="plan")
    interventions: Mapped[List["Intervention"]] = relationship(
        primaryjoin="Plan.id_plan == foreign(Intervention.id_plan)",
        back_populates="plan",
        viewonly=True,
    )
    revisions: Mapped[List["Revision"]] = relationship(
        back_populates="plan", foreign_keys="Revision.id_plan"
    )
    validations: Mapped[List["Validation"]] = relationship(back_populates="plan")


class Revision(Base):
    """Revisión de un plan por el jefe de planta: aprobarlo o pedir uno nuevo."""

    __tablename__ = "revision"

    id_revision: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    decision: Mapped[DecisionRevision] = mapped_column(
        enum_column(DecisionRevision, "decision"), nullable=False
    )
    new_generation_criteria: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    id_manager: Mapped[int] = mapped_column(
        ForeignKey("plant_manager.id_manager", ondelete="RESTRICT"), nullable=False, index=True
    )
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), nullable=False, index=True
    )

    __table_args__ = (
        # Los criterios son obligatorios al pedir otro plan y solo existen en ese caso.
        CheckConstraint(
            "(decision = 'approve' AND new_generation_criteria IS NULL) OR "
            "(decision = 'request_new_plan' AND new_generation_criteria IS NOT NULL)",
            name="criteria_match_decision",
        ),
    )

    manager: Mapped["PlantManager"] = relationship(back_populates="revisions")
    plan: Mapped["Plan"] = relationship(back_populates="revisions", foreign_keys=[id_plan])
    originated_plan: Mapped[Optional["Plan"]] = relationship(
        foreign_keys="Plan.id_origin_revision",
        back_populates="origin_revision",
        post_update=True,
    )


class Validation(Base):
    """Validación de un plan por un técnico habilitado en la línea."""

    __tablename__ = "validation"

    id_validation: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    validation_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), nullable=False, index=True
    )
    id_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=False, index=True
    )

    plan: Mapped["Plan"] = relationship(back_populates="validations")
    technician: Mapped["Technician"] = relationship(back_populates="validations")


class TaskPlanMembership(Base):
    """Asociación N:M entre planes y tareas: qué tareas incluye cada plan."""

    __tablename__ = "task_plan_membership"

    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), primary_key=True
    )
    id_task: Mapped[int] = mapped_column(
        ForeignKey("task.id_task", ondelete="RESTRICT"), primary_key=True, index=True
    )

    plan: Mapped["Plan"] = relationship(back_populates="tasks")
    task: Mapped["Task"] = relationship(back_populates="plans")


class PlanOperatorAssignment(Base):
    """Plan asignado a un operario en una fecha. La clave impide dos planes el mismo día."""

    __tablename__ = "plan_operator_assignment"

    id_operator: Mapped[int] = mapped_column(
        ForeignKey("operator.id_operator", ondelete="RESTRICT"), primary_key=True
    )
    assignment_date: Mapped[date] = mapped_column(Date, primary_key=True)
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), nullable=False, index=True
    )

    operator: Mapped["Operator"] = relationship(back_populates="plan_assignments")
    plan: Mapped["Plan"] = relationship(back_populates="assignments")
