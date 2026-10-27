from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import (
    String, Integer, DateTime, Date, ForeignKey, ForeignKeyConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.backend.db.base import Base
from apps.backend.db.enums import DecisionRevision, PlanStatus, Criticality
from apps.backend.models.infrastructure import ProductionLine
from apps.backend.models.users import Technician, PlantManager, Operator
from apps.backend.models.tasks import Task
from apps.backend.models.execution import Intervention


class Plan(Base):
    __tablename__ = "plan"

    id_plan: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    creation_date: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    status: Mapped[PlanStatus] = mapped_column(
        PlanStatus,
        nullable=False,
        default=PlanStatus.generated,
        index=True,
    )
    criticality_level: Mapped[Criticality] = mapped_column(
    Criticality, nullable=False
    )
    preventive_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    corrective_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    predictive_percentage: Mapped[int] = mapped_column(Integer, nullable=False)
    system_coverage: Mapped[int] = mapped_column(Integer, nullable=False)
    total_task_count: Mapped[int] = mapped_column(Integer, nullable=False)

    # "Flat" columns for ORM relationships; FKs are declared in __table_args__
    id_line: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    id_creator_technician: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    id_origin_revision: Mapped[Optional[int]] = mapped_column(
        ForeignKey("revision.id_revision", use_alter=True, name="fk_plan_origin_revision"),
        unique=True, nullable=True,
    )

    __table_args__ = (
        # Simple FKs for ORM relationships
        ForeignKeyConstraint(
            ["id_line"], ["production_line.id_line"],
            name="fk_plan_line", ondelete="RESTRICT", onupdate="CASCADE",
        ),
        ForeignKeyConstraint(
            ["id_creator_technician"], ["technician.id_technician"],
            name="fk_plan_creator_technician", ondelete="RESTRICT", onupdate="CASCADE",
        ),
        # Business composite FK: only authorized technicians in the line
        ForeignKeyConstraint(
            ["id_creator_technician", "id_line"],
            ["authorization.id_technician", "authorization.id_line"],
            name="fk_plan_authorization", ondelete="RESTRICT", onupdate="CASCADE",
        ),
        # Domain rules
        CheckConstraint(
            "preventive_percentage >= 0 AND corrective_percentage >= 0 "
            "AND predictive_percentage >= 0",
            name="ck_plan_percentages_non_negative",
        ),
        CheckConstraint(
            "preventive_percentage + corrective_percentage + predictive_percentage = 100",
            name="ck_plan_percentages_sum_100",
        ),
        CheckConstraint(
            "system_coverage BETWEEN 0 AND 100",
            name="ck_plan_coverage_range",
        ),
        CheckConstraint(
            "total_task_count > 0",
            name="ck_plan_total_count_positive",
        ),
    )

    line: Mapped["ProductionLine"] = relationship(
        foreign_keys=[id_line], back_populates="plans"
    )
    creator_technician: Mapped["Technician"] = relationship(
        foreign_keys=[id_creator_technician], back_populates="created_plans"
    )
    origin_revision: Mapped[Optional["Revision"]] = relationship(
        foreign_keys=[id_origin_revision],
        back_populates="originated_plan",
        post_update=True,  # breaks the INSERT cycle
    )
    tasks: Mapped[List["TaskPlanMembership"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    assignments: Mapped[List["PlanOperatorAssignment"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )
    interventions: Mapped[List["Intervention"]] = relationship(
        primaryjoin="Plan.id_plan == foreign(Intervention.id_plan)",
        back_populates="plan",
        viewonly=True,
    )
    revisions: Mapped[List["Revision"]] = relationship(
        back_populates="plan", foreign_keys="Revision.id_plan"
    )
    validations: Mapped[List["Validation"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan"
    )


class Revision(Base):
    __tablename__ = "revision"

    id_revision: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    revision_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    decision: Mapped[DecisionRevision] = mapped_column(
        DecisionRevision, nullable=False
    )
    new_generation_criteria: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    id_manager: Mapped[int] = mapped_column(
        ForeignKey("plant_manager.id_manager", ondelete="RESTRICT"), nullable=False
    )
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), nullable=False
    )

    manager: Mapped["PlantManager"] = relationship(back_populates="revisions")
    plan: Mapped["Plan"] = relationship(
        back_populates="revisions", foreign_keys=[id_plan]
    )
    originated_plan: Mapped[Optional["Plan"]] = relationship(
        foreign_keys="Plan.id_origin_revision",
        back_populates="origin_revision",
        post_update=True,
    )


class Validation(Base):
    __tablename__ = "validation"

    id_validation: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    validation_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    observations: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="RESTRICT"), nullable=False
    )
    id_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=False
    )

    plan: Mapped["Plan"] = relationship(back_populates="validations")
    technician: Mapped["Technician"] = relationship(back_populates="validations")


class TaskPlanMembership(Base):
    __tablename__ = "task_plan_membership"

    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="CASCADE"), primary_key=True
    )
    id_task: Mapped[int] = mapped_column(
        ForeignKey("task.id_task", ondelete="RESTRICT"), primary_key=True
    )

    plan: Mapped["Plan"] = relationship(back_populates="tasks")
    task: Mapped["Task"] = relationship(back_populates="plans")


class PlanOperatorAssignment(Base):
    __tablename__ = "plan_operator_assignment"

    id_operator: Mapped[int] = mapped_column(
        ForeignKey("operator.id_operator", ondelete="RESTRICT"), primary_key=True
    )
    assignment_date: Mapped[date] = mapped_column(Date, primary_key=True)
    id_plan: Mapped[int] = mapped_column(
        ForeignKey("plan.id_plan", ondelete="CASCADE"), nullable=False
    )

    operator: Mapped["Operator"] = relationship(back_populates="plan_assignments")
    plan: Mapped["Plan"] = relationship(back_populates="assignments")