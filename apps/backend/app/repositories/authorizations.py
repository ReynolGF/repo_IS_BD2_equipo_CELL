"""Acceso a datos de las autorizaciones de técnicos por línea."""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.infrastructure import LineAuthorization
from app.models.users import Technician, User


def get(db: Session, id_technician: int, id_line: int) -> LineAuthorization | None:
    """Devuelve la autorización de un técnico en una línea, o ``None`` si no la tiene."""
    return db.get(LineAuthorization, (id_technician, id_line))


def list_for_line(db: Session, id_line: int) -> Sequence[LineAuthorization]:
    """Lista las autorizaciones concedidas en una línea."""
    return db.scalars(
        select(LineAuthorization)
        .where(LineAuthorization.id_line == id_line)
        .order_by(LineAuthorization.id_technician)
    ).all()


def list_for_technician(db: Session, id_technician: int) -> Sequence[LineAuthorization]:
    """Lista las autorizaciones de un técnico."""
    return db.scalars(
        select(LineAuthorization)
        .where(LineAuthorization.id_technician == id_technician)
        .order_by(LineAuthorization.id_line)
    ).all()


def find_active(db: Session, id_technician: int, id_line: int) -> LineAuthorization | None:
    """Devuelve la autorización solo si el usuario del técnico existe y está activo."""
    return db.scalar(
        select(LineAuthorization)
        .join(Technician, Technician.id_technician == LineAuthorization.id_technician)
        .join(User, User.id_user == Technician.id_user)
        .where(
            LineAuthorization.id_technician == id_technician,
            LineAuthorization.id_line == id_line,
            User.is_active.is_(True),
        )
    )


def list_eligible_technicians(
    db: Session, id_line: int, *, generate: bool = False, validate: bool = False
) -> Sequence[Technician]:
    """Lista los técnicos activos con permiso en una línea.

    Args:
        db: Sesión de base de datos.
        id_line: Línea consultada.
        generate: Exige ``can_generate``.
        validate: Exige ``can_validate``.
    """
    statement = (
        select(Technician)
        .join(LineAuthorization, LineAuthorization.id_technician == Technician.id_technician)
        .join(User, User.id_user == Technician.id_user)
        .where(LineAuthorization.id_line == id_line, User.is_active.is_(True))
        .order_by(Technician.id_technician)
    )
    if generate:
        statement = statement.where(LineAuthorization.can_generate.is_(True))
    if validate:
        statement = statement.where(LineAuthorization.can_validate.is_(True))
    return db.scalars(statement).all()
