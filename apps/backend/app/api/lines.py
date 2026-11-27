"""Líneas de producción, sus equipos y los operarios asignados (RF1, RF2, RF3, RF37)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_role
from app.core.database import get_db
from app.db.enums import Occupation
from app.models.users import User
from app.schemas.common import Page
from app.schemas.infrastructure import (
    LineCreate,
    LineDetail,
    LineUpdate,
)
from app.services import lines as service

router = APIRouter(tags=["lines"])

_can_see_operators = require_role(Occupation.administrator, Occupation.plant_manager)


# --- Líneas ---------------------------------------------------------------------------------


@router.post("/lines", response_model=LineDetail, status_code=status.HTTP_201_CREATED)
def create_line(
    body: LineCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LineDetail:
    """Registra una línea de producción (solo administrador)."""
    return LineDetail.from_line(service.create_line(db, body))


@router.get("/lines", response_model=Page[LineDetail])
def list_lines(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[LineDetail]:
    """Lista las líneas junto con los equipos que tienen asociados."""
    lines, total = service.list_lines(db, limit=limit, offset=offset)
    return Page[LineDetail](
        items=[LineDetail.from_line(line) for line in lines],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/lines/{id_line}", response_model=LineDetail)
def get_line(
    id_line: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LineDetail:
    """Devuelve una línea con sus equipos."""
    return LineDetail.from_line(service.get_line(db, id_line))


@router.patch("/lines/{id_line}", response_model=LineDetail)
def update_line(
    id_line: int,
    body: LineUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LineDetail:
    """Modifica una línea (solo administrador)."""
    return LineDetail.from_line(service.update_line(db, id_line, body))


@router.delete("/lines/{id_line}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line(
    id_line: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Elimina una línea sin equipos, autorizaciones, operarios ni planes (409 si los tiene)."""
    service.delete_line(db, id_line)
