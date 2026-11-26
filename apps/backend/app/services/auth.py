"""Inicio de sesión y cambio de contraseña."""

from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, BusinessRuleError, PermissionDeniedError
from app.core.security import (
    create_access_token,
    dummy_hash,
    hash_password,
    verify_password,
)
from app.models.users import User
from app.repositories import users as users_repo
from app.schemas.auth import TokenResponse


def authenticate(db: Session, email: str, password: str) -> User:
    """Comprueba las credenciales y devuelve el usuario.

    El mensaje es el mismo si el correo no existe o la contraseña es incorrecta, para no revelar
    qué correos están registrados.

    Raises:
        AuthenticationError: Correo o contraseña incorrectos.
        PermissionDeniedError: Las credenciales son correctas pero la cuenta está desactivada.
    """
    user = users_repo.get_by_email(db, email)
    if user is None:
        verify_password(password, dummy_hash())  # iguala el tiempo de respuesta
        raise AuthenticationError("Correo o contraseña incorrectos")
    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Correo o contraseña incorrectos")
    if not user.is_active:
        raise PermissionDeniedError("La cuenta está desactivada")
    return user


def login(db: Session, email: str, password: str) -> TokenResponse:
    """Autentica al usuario y le entrega un token de acceso."""
    user = authenticate(db, email, password)
    token, expires_in = create_access_token(user.id_user, user.occupation.value)
    return TokenResponse(access_token=token, expires_in=expires_in)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Cambia la contraseña del propio usuario.

    Los tokens ya emitidos siguen siendo válidos hasta que caduquen.

    Raises:
        BusinessRuleError: La contraseña actual no es correcta o la nueva es igual a ella.
    """
    if not verify_password(current_password, user.password_hash):
        raise BusinessRuleError("La contraseña actual no es correcta")
    if current_password == new_password:
        raise BusinessRuleError("La nueva contraseña debe ser distinta de la actual")
    user.password_hash = hash_password(new_password)
    db.commit()
