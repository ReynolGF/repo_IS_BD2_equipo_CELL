"""Equipos o sistemas y su estado operativo (RF2, RF41)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_role
from app.core.database import get_db
from app.db.enums import Occupation, OperationalStatus
from app.models.users import User
from app.schemas.common import Page
from app.schemas.infrastructure import (
    EquipmentCreate,
    EquipmentRead,
    EquipmentStatusUpdate,
    EquipmentUpdate,
)
from app.services import lines as service

router = APIRouter(prefix="/equipment", tags=["equipment"])

_can_change_status = require_role(Occupation.technician, Occupation.administrator)


@router.post("", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
def create_equipment(
    body: EquipmentCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EquipmentRead:
    """Registra un equipo (solo administrador). Se asocia a líneas con ``PUT /lines/...``."""
    return EquipmentRead.from_equipment(service.create_equipment(db, body))


@router.get("", response_model=Page[EquipmentRead])
def list_equipment(
    id_line: int | None = Query(default=None, description="Solo los equipos de esta línea"),
    operational_status: OperationalStatus | None = Query(default=None),
    q: str | None = Query(
        default=None, max_length=100, description="Buscar en nombre o descripción"
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Page[EquipmentRead]:
    """Lista equipos con filtros y paginación."""
    equipment, total = service.list_equipment(
        db,
        id_line=id_line,
        operational_status=operational_status,
        search=q,
        limit=limit,
        offset=offset,
    )
    return Page[EquipmentRead](
        items=[EquipmentRead.from_equipment(item) for item in equipment],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_equipment}", response_model=EquipmentRead)
def get_equipment(
    id_equipment: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EquipmentRead:
    """Devuelve un equipo con su estado operativo y las líneas que lo cubren."""
    return EquipmentRead.from_equipment(service.get_equipment(db, id_equipment))


@router.patch("/{id_equipment}", response_model=EquipmentRead)
def update_equipment(
    id_equipment: int,
    body: EquipmentUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> EquipmentRead:
    """Modifica el nombre o la descripción de un equipo (solo administrador)."""
    return EquipmentRead.from_equipment(service.update_equipment(db, id_equipment, body))


@router.put("/{id_equipment}/status", response_model=EquipmentRead)
def update_status(
    id_equipment: int,
    body: EquipmentStatusUpdate,
    _user: User = Depends(_can_change_status),
    db: Session = Depends(get_db),
) -> EquipmentRead:
    """Actualiza el estado operativo vigente del equipo (técnico o administrador)."""
    return EquipmentRead.from_equipment(
        service.update_status(db, id_equipment, body.operational_status)
    )


@router.delete("/{id_equipment}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    id_equipment: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Elimina un equipo sin líneas ni tareas (409 si las tiene)."""
    service.delete_equipment(db, id_equipment)
