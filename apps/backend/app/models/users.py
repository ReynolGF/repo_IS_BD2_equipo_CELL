"""Usuarios del sistema y sus subtipos (técnico, operario, jefe de planta, administrador)."""

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import Occupation, Shift
from app.db.types import enum_column

if TYPE_CHECKING:
    from app.models.execution import Intervention, Reinspection
    from app.models.infrastructure import LineAssignment, LineAuthorization
    from app.models.plans import Plan, PlanOperatorAssignment, Revision, Validation
    from app.models.tasks import Task


class User(Base):
    """Cuenta de acceso. Los datos propios de cada rol viven en su tabla de subtipo.

    **Los usuarios no se eliminan.** Un trabajador que deja la empresa se da de baja con
    ``is_active = FALSE``, que conserva su nombre, su correo y todo su historial (tareas, planes,
    validaciones, intervenciones...). Las claves foráneas de los subtipos hacia ``users`` son
    ``ON DELETE RESTRICT``, así que la base de datos rechaza borrar una cuenta que tenga perfil.
    Un usuario inactivo no puede iniciar sesión ni usar tokens ya emitidos.
    """

    __tablename__ = "users"

    id_user: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    occupation: Mapped[Occupation] = mapped_column(
        enum_column(Occupation, "occupation"), nullable=False
    )
    # Baja lógica. Los servicios impiden el inicio de sesión y el uso de tokens de un usuario
    # inactivo, y lo excluyen de nuevas asignaciones, autorizaciones y planes. Los reportes
    # históricos no filtran por este campo.
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )

    technician: Mapped[Optional["Technician"]] = relationship(back_populates="user", uselist=False)
    operator: Mapped[Optional["Operator"]] = relationship(back_populates="user", uselist=False)
    manager: Mapped[Optional["PlantManager"]] = relationship(back_populates="user", uselist=False)
    admin: Mapped[Optional["Administrator"]] = relationship(back_populates="user", uselist=False)


class Technician(Base):
    """Subtipo de usuario: técnico que crea tareas, genera y valida planes."""

    __tablename__ = "technician"

    id_technician: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("users.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True,
        nullable=False,
    )
    specialty: Mapped[str] = mapped_column(String(150), nullable=False)

    user: Mapped["User"] = relationship(back_populates="technician")
    authorizations: Mapped[List["LineAuthorization"]] = relationship(back_populates="technician")
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
    """Subtipo de usuario: operario que ejecuta planes y registra intervenciones."""

    __tablename__ = "operator"

    id_operator: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("users.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True,
        nullable=False,
    )
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    shift: Mapped[Shift] = mapped_column(enum_column(Shift, "shift"), nullable=False)

    __table_args__ = (CheckConstraint("age > 0", name="positive_age"),)

    user: Mapped["User"] = relationship(back_populates="operator")
    assigned_lines: Mapped[List["LineAssignment"]] = relationship(back_populates="operator")
    plan_assignments: Mapped[List["PlanOperatorAssignment"]] = relationship(
        back_populates="operator"
    )
    interventions: Mapped[List["Intervention"]] = relationship(back_populates="operator")


class PlantManager(Base):
    """Subtipo de usuario: jefe de planta que revisa y aprueba los planes."""

    __tablename__ = "plant_manager"

    id_manager: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("users.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="manager")
    revisions: Mapped[List["Revision"]] = relationship(back_populates="manager")


class Administrator(Base):
    """Subtipo de usuario: administrador del sistema."""

    __tablename__ = "administrator"

    id_admin: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_user: Mapped[int] = mapped_column(
        ForeignKey("users.id_user", ondelete="RESTRICT", onupdate="CASCADE"),
        unique=True,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="admin")
