from typing import List, Optional
from sqlalchemy import String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.backend.db.base import Base
from apps.backend.db.enums import Occupation, Shift
from apps.backend.models.execution import Intervention, Reinspection
from apps.backend.models.plans import Plan, PlanOperatorAssignment, Revision, Validation
from apps.backend.models.tasks import Task
from apps.backend.models.infrastructure import Authorization, LineAssignment


class User(Base):
    __tablename__ = "user"

    id_user: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    occupation: Mapped[Occupation] = mapped_column(Occupation, nullable=False)

    technician: Mapped[Optional["Technician"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    operator: Mapped[Optional["Operator"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    manager: Mapped[Optional["PlantManager"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    admin: Mapped[Optional["Administrator"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

class Technician(Base):
    __tablename__ = "technician"

    id_technician: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("user.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True, nullable=False,
    )
    specialty: Mapped[str] = mapped_column(String(150), nullable=False)

    user: Mapped["User"] = relationship(back_populates="technician")
    authorizations: Mapped[List["Authorization"]] = relationship(
        back_populates="technician", cascade="all, delete-orphan"
    )
    supervised_operators: Mapped[List["Operator"]] = relationship(
        back_populates="assigned_technician",
        foreign_keys="Operator.id_assigned_technician",
    )
    created_tasks: Mapped[List["Task"]] = relationship(back_populates="creator_technician")
    created_plans: Mapped[List["Plan"]] = relationship(
        back_populates="creator_technician", foreign_keys="Plan.id_creator_technician"
    )
    validations: Mapped[List["Validation"]] = relationship(back_populates="technician")
    additional_reinspections: Mapped[List["Reinspection"]] = relationship(
        back_populates="additional_technician",
        foreign_keys="Reinspection.id_additional_technician",
    )
    resolved_reinspections: Mapped[List["Reinspection"]] = relationship(
        back_populates="resolver_technician",
        foreign_keys="Reinspection.id_resolver_technician",
    )



class Operator(Base):
    __tablename__ = "operator"

    id_operator: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("user.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True, nullable=False,
    )
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    shift: Mapped[Shift] = mapped_column(Shift, nullable=False)

    id_assigned_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT"), nullable=False
    )

    __table_args__ = (CheckConstraint("age > 0", name="ck_operator_positive_age"),)

    user: Mapped["User"] = relationship(back_populates="operator")
    assigned_technician: Mapped["Technician"] = relationship(
        back_populates="supervised_operators",
        foreign_keys=[id_assigned_technician],
    )
    assigned_lines: Mapped[List["LineAssignment"]] = relationship(
        back_populates="operator", cascade="all, delete-orphan"
    )
    plan_assignments: Mapped[List["PlanOperatorAssignment"]] = relationship(
        back_populates="operator"
    )
    interventions: Mapped[List["Intervention"]] = relationship(back_populates="operator")




class PlantManager(Base):
    __tablename__ = "plant_manager"

    id_manager: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("user.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True, nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="manager")
    revisions: Mapped[List["Revision"]] = relationship(back_populates="manager")


class Administrator(Base):
    __tablename__ = "administrator"

    id_admin: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("user.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True, nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="admin")

