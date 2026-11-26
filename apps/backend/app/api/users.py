"""Gestión de usuarios (solo administradores)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.db.enums import Occupation
from app.models.users import User
from app.schemas.users import UserCreate, UserPage, UserRead, UserUpdate
from app.services import users as users_service

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserRead:
    """Crea un usuario con su perfil según el rol."""
    return UserRead.from_user(users_service.create_user(db, body))


@router.get("", response_model=UserPage)
def list_users(
    occupation: Occupation | None = Query(default=None, description="Filtrar por rol"),
    is_active: bool | None = Query(default=None, description="Filtrar por activos o inactivos"),
    q: str | None = Query(default=None, max_length=100, description="Buscar en nombre o correo"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserPage:
    """Lista usuarios con filtros y paginación."""
    users, total = users_service.list_users(
        db, occupation=occupation, is_active=is_active, search=q, limit=limit, offset=offset
    )
    return UserPage(
        items=[UserRead.from_user(user) for user in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{id_user}", response_model=UserRead)
def get_user(
    id_user: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserRead:
    """Devuelve un usuario."""
    return UserRead.from_user(users_service.get_user(db, id_user))


@router.patch("/{id_user}", response_model=UserRead)
def update_user(
    id_user: int,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserRead:
    """Modifica un usuario.

    Los usuarios no se eliminan: con ``is_active: false`` se les da de baja conservando su nombre
    y su historial, y con ``is_active: true`` se reactivan. Un usuario inactivo no puede iniciar
    sesión ni usar los tokens que ya tenía.
    """
    user = users_service.get_user(db, id_user)
    return UserRead.from_user(users_service.update_user(db, user, body, admin))
