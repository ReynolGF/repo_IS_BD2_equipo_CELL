"""Líneas de producción, sus equipos y los operarios asignados (RF1, RF2, RF3, RF37)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_operator, get_current_user, require_admin, require_role
from app.core.database import get_db
from app.db.enums import Occupation
from app.models.users import Operator, User
from app.schemas.common import Page
from app.schemas.infrastructure import (
    AssignedOperatorRead,
    EquipmentSummary,
    LineAssignmentRead,
    LineCreate,
    LineDetail,
    LineRead,
    LineUpdate,
)
from app.services import line_assignments as assignments
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


# "me" va antes que "{id_operator}" para que no se interprete como un identificador.
@router.get("/operators/me/lines", response_model=list[LineRead])
def my_lines(
    operator: Operator = Depends(get_current_operator),
    db: Session = Depends(get_db),
) -> list[LineRead]:
    """Lista las líneas en las que está asignado el operario autenticado."""
    return [
        LineRead.model_validate(line) for line in assignments.list_lines(db, operator.id_operator)
    ]


@router.get("/operators/{id_operator}/lines", response_model=list[LineRead])
def operator_lines(
    id_operator: int,
    _user: User = Depends(_can_see_operators),
    db: Session = Depends(get_db),
) -> list[LineRead]:
    """Lista las líneas de un operario (administrador o jefe de planta)."""
    return [LineRead.model_validate(line) for line in assignments.list_lines(db, id_operator)]


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


# --- Equipos de la línea --------------------------------------------------------------------


@router.put("/lines/{id_line}/equipment/{id_equipment}", response_model=EquipmentSummary)
def add_equipment(
    id_line: int,
    id_equipment: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EquipmentSummary:
    """Asocia un equipo a la línea (idempotente)."""
    return EquipmentSummary.model_validate(service.add_equipment_to_line(db, id_line, id_equipment))


@router.delete("/lines/{id_line}/equipment/{id_equipment}", status_code=status.HTTP_204_NO_CONTENT)
def remove_equipment(
    id_line: int,
    id_equipment: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Quita un equipo de la línea."""
    service.remove_equipment_from_line(db, id_line, id_equipment)


# --- Operarios de la línea ------------------------------------------------------------------


@router.get("/lines/{id_line}/operators", response_model=list[AssignedOperatorRead])
def line_operators(
    id_line: int,
    _user: User = Depends(_can_see_operators),
    db: Session = Depends(get_db),
) -> list[AssignedOperatorRead]:
    """Lista los operarios asignados a la línea (administrador o jefe de planta)."""
    return [
        AssignedOperatorRead(
            id_operator=operator.id_operator,
            id_user=user.id_user,
            name=user.name,
            shift=operator.shift,
            is_active=user.is_active,
        )
        for operator, user in assignments.list_operators(db, id_line)
    ]


@router.put("/lines/{id_line}/operators/{id_operator}", response_model=LineAssignmentRead)
def assign_operator(
    id_line: int,
    id_operator: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LineAssignmentRead:
    """Asigna un operario activo a la línea (idempotente)."""
    return LineAssignmentRead.model_validate(assignments.assign(db, id_line, id_operator))


@router.delete("/lines/{id_line}/operators/{id_operator}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_operator(
    id_line: int,
    id_operator: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Quita a un operario de la línea."""
    assignments.unassign(db, id_line, id_operator)
