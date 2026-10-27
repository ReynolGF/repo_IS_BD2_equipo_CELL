from datetime import datetime
from typing import List
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.backend.db.base import Base
from apps.backend.db.enums import OperationalStatus
from apps.backend.models.tasks import Task
from apps.backend.models.users import Technician, Operator

class ProductionLine(Base):
    __tablename__ = "production_line"

    id_line: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    production_process: Mapped[str] = mapped_column(String(255), nullable=False)

    equipment: Mapped[List["EquipmentLineMembership"]] = relationship(
        back_populates="line", cascade="all, delete-orphan"
    )
    authorizations: Mapped[List["Authorization"]] = relationship(
        back_populates="line", cascade="all, delete-orphan"
    )
    assigned_operators: Mapped[List["LineAssignment"]] = relationship(
        back_populates="line", cascade="all, delete-orphan"
    )
    plans: Mapped[List["Plan"]] = relationship(back_populates="line")



class EquipmentSystem(Base):
    __tablename__ = "equipment_system"

    id_equipment: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    operational_status: Mapped[OperationalStatus] = mapped_column(
        OperationalStatus,
        nullable=False,
        default=OperationalStatus.operational,
    )
    status_date: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    lines: Mapped[List["EquipmentLineMembership"]] = relationship(
        back_populates="equipment", cascade="all, delete-orphan"
    )
    tasks: Mapped[List["Task"]] = relationship(back_populates="equipment")


class EquipmentLineMembership(Base):
    __tablename__ = "equipment_line_membership"

    id_line: Mapped[int] = mapped_column(
        ForeignKey("production_line.id_line", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )
    id_equipment: Mapped[int] = mapped_column(
        ForeignKey("equipment_system.id_equipment", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )

    line: Mapped["ProductionLine"] = relationship(back_populates="equipment")
    equipment: Mapped["EquipmentSystem"] = relationship(back_populates="lines")



class Authorization(Base):
    __tablename__ = "authorization"

    id_technician: Mapped[int] = mapped_column(
        ForeignKey("technician.id_technician", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )
    id_line: Mapped[int] = mapped_column(
        ForeignKey("production_line.id_line", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )
    can_generate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_validate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "can_generate = TRUE OR can_validate = TRUE",
            name="ck_authorization_at_least_one",
        ),
    )

    technician: Mapped["Technician"] = relationship(back_populates="authorizations")
    line: Mapped["ProductionLine"] = relationship(back_populates="authorizations")


class LineAssignment(Base):
    __tablename__ = "line_assignment"

    id_operator: Mapped[int] = mapped_column(
        ForeignKey("operator.id_operator", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )
    id_line: Mapped[int] = mapped_column(
        ForeignKey("production_line.id_line", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )

    operator: Mapped["Operator"] = relationship(back_populates="assigned_lines")
    line: Mapped["ProductionLine"] = relationship(back_populates="assigned_operators")
