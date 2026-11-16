"""Líneas de producción, equipos, y sus asociaciones con técnicos y operarios."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import OperationalStatus
from app.db.types import enum_column

if TYPE_CHECKING:
    from app.models.plans import Plan
    from app.models.tasks import Task
    from app.models.users import Operator, Technician


class ProductionLine(Base):
    """Línea de producción con su proceso productivo."""

    __tablename__ = "production_line"

    id_line: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    production_process: Mapped[str] = mapped_column(String(255), nullable=False)

    equipment: Mapped[List["EquipmentLineMembership"]] = relationship(back_populates="line")
    authorizations: Mapped[List["LineAuthorization"]] = relationship(back_populates="line")
    assigned_operators: Mapped[List["LineAssignment"]] = relationship(back_populates="line")
    plans: Mapped[List["Plan"]] = relationship(back_populates="line")


class EquipmentSystem(Base):
    """Sistema o equipo, con su estado operativo vigente."""

    __tablename__ = "equipment_system"

    id_equipment: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    operational_status: Mapped[OperationalStatus] = mapped_column(
        enum_column(OperationalStatus, "operational_status"),
        nullable=False,
        default=OperationalStatus.operational,
        server_default=OperationalStatus.operational.value,
    )
    status_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    lines: Mapped[List["EquipmentLineMembership"]] = relationship(back_populates="equipment")
    tasks: Mapped[List["Task"]] = relationship(back_populates="equipment")


class EquipmentLineMembership(Base):
    """Asociación N:M entre líneas y equipos: qué equipos cubre cada línea."""

    __tablename__ = "equipment_line_membership"

    id_line: Mapped[int] = mapped_column(
        ForeignKey("production_line.id_line", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
    )
    id_equipment: Mapped[int] = mapped_column(
        ForeignKey("equipment_system.id_equipment", ondelete="RESTRICT", onupdate="CASCADE"),
        primary_key=True,
        index=True,
    )

    line: Mapped["ProductionLine"] = relationship(back_populates="equipment")
    equipment: Mapped["EquipmentSystem"] = relationship(back_populates="lines")


