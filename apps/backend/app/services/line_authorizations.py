"""Administración de las autorizaciones de técnicos por línea."""

from collections.abc import Sequence

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models.infrastructure import LineAuthorization, ProductionLine
from app.models.users import Technician
from app.repositories import authorizations as auth_repo


def _require_line(db: Session, id_line: int) -> None:
    """Lanza ``NotFoundError`` si la línea no existe."""
    if db.get(ProductionLine, id_line) is None:
        raise NotFoundError("Línea no encontrada")


def _require_technician(db: Session, id_technician: int) -> Technician:
    """Devuelve el técnico o lanza ``NotFoundError``."""
    technician = db.get(Technician, id_technician)
    if technician is None:
        raise NotFoundError("Técnico no encontrado")
    return technician


def list_for_line(db: Session, id_line: int) -> Sequence[LineAuthorization]:
    """Lista las autorizaciones concedidas en una línea."""
    _require_line(db, id_line)
    return auth_repo.list_for_line(db, id_line)


def list_for_technician(db: Session, id_technician: int) -> Sequence[LineAuthorization]:
    """Lista las líneas en las que un técnico tiene permisos."""
    _require_technician(db, id_technician)
    return auth_repo.list_for_technician(db, id_technician)


def grant(
    db: Session, id_line: int, id_technician: int, *, can_generate: bool, can_validate: bool
) -> LineAuthorization:
    """Concede o actualiza los permisos de un técnico en una línea.

    Raises:
        NotFoundError: La línea o el técnico no existen.
        BusinessRuleError: La cuenta del técnico está desactivada.
    """
    _require_line(db, id_line)
    technician = _require_technician(db, id_technician)
    if not technician.user.is_active:
        raise BusinessRuleError("No se puede autorizar a un técnico con la cuenta desactivada")

    authorization = auth_repo.get(db, id_technician, id_line)
    if authorization is None:
        authorization = LineAuthorization(
            id_technician=id_technician,
            id_line=id_line,
            can_generate=can_generate,
            can_validate=can_validate,
        )
        db.add(authorization)
    else:
        authorization.can_generate = can_generate
        authorization.can_validate = can_validate
    db.commit()
    return authorization


def revoke(db: Session, id_line: int, id_technician: int) -> None:
    """Quita la autorización de un técnico en una línea.

    Raises:
        NotFoundError: El técnico no tenía autorización en esa línea.
        ConflictError: El técnico ya creó planes en esa línea; la clave foránea compuesta de
            ``plan`` impide quitarle la autorización y conservar el historial a la vez. En ese
            caso se puede dejar sin permisos desactivando su cuenta.
    """
    if auth_repo.get(db, id_technician, id_line) is None:
        raise NotFoundError("El técnico no tiene autorización en esa línea")
    try:
        with db.begin_nested():
            db.execute(
                delete(LineAuthorization).where(
                    LineAuthorization.id_technician == id_technician,
                    LineAuthorization.id_line == id_line,
                )
            )
    except IntegrityError:
        raise ConflictError(
            "No se puede quitar la autorización: el técnico ya creó planes en esta línea"
        ) from None
    db.commit()
