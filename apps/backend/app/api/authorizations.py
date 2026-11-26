"""Autorizaciones de técnicos por línea de producción."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_technician, require_admin
from app.core.database import get_db
from app.models.users import Technician, User
from app.schemas.authorizations import AuthorizationRead, AuthorizationUpsert
from app.services import line_authorizations as service

router = APIRouter(tags=["authorizations"])


# "me" va antes que "{id_technician}" para que no se interprete como un identificador.
@router.get("/technicians/me/authorizations", response_model=list[AuthorizationRead])
def my_authorizations(
    technician: Technician = Depends(get_current_technician),
    db: Session = Depends(get_db),
) -> list[AuthorizationRead]:
    """Lista las líneas en las que el técnico autenticado puede generar o validar planes."""
    return [
        AuthorizationRead.model_validate(item)
        for item in service.list_for_technician(db, technician.id_technician)
    ]


@router.get("/technicians/{id_technician}/authorizations", response_model=list[AuthorizationRead])
def technician_authorizations(
    id_technician: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AuthorizationRead]:
    """Lista las autorizaciones de un técnico."""
    return [
        AuthorizationRead.model_validate(item)
        for item in service.list_for_technician(db, id_technician)
    ]


@router.get("/lines/{id_line}/authorizations", response_model=list[AuthorizationRead])
def line_authorizations(
    id_line: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AuthorizationRead]:
    """Lista los técnicos autorizados en una línea."""
    return [AuthorizationRead.model_validate(item) for item in service.list_for_line(db, id_line)]


@router.put("/lines/{id_line}/authorizations/{id_technician}", response_model=AuthorizationRead)
def grant_authorization(
    id_line: int,
    id_technician: int,
    body: AuthorizationUpsert,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuthorizationRead:
    """Concede o actualiza los permisos de un técnico en una línea."""
    authorization = service.grant(
        db,
        id_line,
        id_technician,
        can_generate=body.can_generate,
        can_validate=body.can_validate,
    )
    return AuthorizationRead.model_validate(authorization)


@router.delete(
    "/lines/{id_line}/authorizations/{id_technician}", status_code=status.HTTP_204_NO_CONTENT
)
def revoke_authorization(
    id_line: int,
    id_technician: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Quita la autorización de un técnico en una línea (409 si ya creó planes en ella)."""
    service.revoke(db, id_line, id_technician)
