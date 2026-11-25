"""Dependencias de FastAPI: usuario autenticado y control de acceso por rol."""

from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db.enums import Occupation
from app.models.users import Operator, PlantManager, Technician, User
from app.repositories import users as users_repo

# auto_error=False: la falta de cabecera la gestiona get_current_user, así siempre se responde
# 401 con el mismo formato (según la versión de FastAPI, el valor por defecto daría 403).
bearer_scheme = HTTPBearer(auto_error=False, description="Token obtenido en POST /auth/login")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Devuelve el usuario autenticado por el token ``Authorization: Bearer``.

    El usuario se lee de la base de datos en cada petición, de modo que desactivar una cuenta
    invalida sus tokens al instante y el rol siempre es el vigente.

    Raises:
        AuthenticationError: Falta el token, es inválido o caducó, o la cuenta no existe o está
            desactivada.
    """
    if credentials is None:
        raise AuthenticationError("Falta el token de acceso")
    payload = decode_access_token(credentials.credentials)
    try:
        id_user = int(payload["sub"])
    except (KeyError, ValueError):
        raise AuthenticationError("Token inválido") from None
    user = users_repo.get_by_id(db, id_user)
    if user is None or not user.is_active:
        raise AuthenticationError("La sesión ya no es válida")
    return user


def require_role(*roles: Occupation) -> Callable[[User], User]:
    """Crea una dependencia que solo deja pasar a usuarios con alguno de los roles indicados."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        """Devuelve el usuario si su rol está permitido."""
        if user.occupation not in roles:
            raise PermissionDeniedError("No tienes permiso para realizar esta acción")
        return user

    return dependency


require_admin = require_role(Occupation.administrator)
require_technician = require_role(Occupation.technician)
require_operator = require_role(Occupation.operator)
require_manager = require_role(Occupation.plant_manager)


def get_current_technician(user: User = Depends(require_technician)) -> Technician:
    """Devuelve el perfil de técnico del usuario autenticado."""
    if user.technician is None:
        raise PermissionDeniedError("El usuario no tiene perfil de técnico")
    return user.technician


def get_current_operator(user: User = Depends(require_operator)) -> Operator:
    """Devuelve el perfil de operario del usuario autenticado."""
    if user.operator is None:
        raise PermissionDeniedError("El usuario no tiene perfil de operario")
    return user.operator


def get_current_manager(user: User = Depends(require_manager)) -> PlantManager:
    """Devuelve el perfil de jefe de planta del usuario autenticado."""
    if user.manager is None:
        raise PermissionDeniedError("El usuario no tiene perfil de jefe de planta")
    return user.manager
