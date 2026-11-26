"""Acceso a datos de usuarios."""

from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import Occupation
from app.models.users import User


def get_by_id(db: Session, id_user: int) -> User | None:
    """Devuelve el usuario con ese identificador, o ``None`` si no existe."""
    return db.get(User, id_user)


def get_by_email(db: Session, email: str) -> User | None:
    """Devuelve el usuario con ese correo (comparación sin distinguir mayúsculas)."""
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


def _like_pattern(text: str) -> str:
    """Escapa los comodines de LIKE para que la búsqueda sea literal."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def list_users(
    db: Session,
    *,
    occupation: Occupation | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[User], int]:
    """Lista usuarios con filtros y paginación.

    Args:
        db: Sesión de base de datos.
        occupation: Si se indica, solo usuarios con ese rol.
        is_active: Si se indica, solo activos o solo inactivos.
        search: Texto a buscar en el nombre o el correo, sin distinguir mayúsculas.
        limit: Máximo de filas a devolver.
        offset: Filas a saltar.

    Returns:
        La página de usuarios, ordenada por identificador, y el total sin paginar.
    """
    conditions = []
    if occupation is not None:
        conditions.append(User.occupation == occupation)
    if is_active is not None:
        conditions.append(User.is_active.is_(is_active))
    if search:
        pattern = _like_pattern(search)
        conditions.append(
            or_(User.name.ilike(pattern, escape="\\"), User.email.ilike(pattern, escape="\\"))
        )

    total = db.scalar(select(func.count()).select_from(User).where(*conditions)) or 0
    users = db.scalars(
        select(User)
        .where(*conditions)
        .options(
            selectinload(User.technician),
            selectinload(User.operator),
            selectinload(User.manager),
            selectinload(User.admin),
        )
        .order_by(User.id_user)
        .limit(limit)
        .offset(offset)
    ).all()
    return users, total
