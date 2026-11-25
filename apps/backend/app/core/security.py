"""Hash de contraseñas (bcrypt) y tokens de acceso (JWT)."""

import base64
import hashlib
from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError


def _prepare(password: str) -> bytes:
    """Convierte la contraseña en una cadena de longitud fija apta para bcrypt.

    bcrypt solo admite 72 bytes y las versiones recientes de la librería lanzan error si se
    supera. Se aplica SHA-256 y Base64 (44 bytes) para que cualquier contraseña funcione y no se
    trunque en silencio.
    """
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def hash_password(password: str) -> str:
    """Devuelve el hash bcrypt de una contraseña, con sal aleatoria incluida."""
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Indica si la contraseña corresponde al hash. Un hash mal formado devuelve ``False``."""
    try:
        return bcrypt.checkpw(_prepare(password), password_hash.encode("utf-8"))
    except ValueError:
        return False


@cache
def dummy_hash() -> str:
    """Hash de relleno para igualar el tiempo de respuesta cuando el correo no existe.

    Sin esto, un login con un correo inexistente respondería mucho más rápido que uno con un
    correo real y contraseña errónea, y permitiría descubrir qué correos están registrados.
    """
    return hash_password("contraseña-de-relleno")


def create_access_token(
    id_user: int, role: str, expires_delta: timedelta | None = None
) -> tuple[str, int]:
    """Crea un JWT firmado para un usuario.

    Args:
        id_user: Identificador del usuario; va en la reclamación estándar ``sub``.
        role: Rol del usuario. Es informativo: la autorización usa el rol guardado en la base
            de datos, no el del token.
        expires_delta: Duración del token. Por defecto, ``access_token_expire_minutes``.

    Returns:
        El token y su duración en segundos.
    """
    settings = get_settings()
    delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.now(UTC)
    payload = {"sub": str(id_user), "role": role, "iat": now, "exp": now + delta}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, int(delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    """Valida la firma y la caducidad de un JWT y devuelve su contenido.

    Raises:
        AuthenticationError: Si el token está mal formado, manipulado o caducado.
    """
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("El token ha expirado") from None
    except jwt.InvalidTokenError:
        raise AuthenticationError("Token inválido") from None
