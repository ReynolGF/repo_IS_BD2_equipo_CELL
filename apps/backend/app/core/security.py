"""Hash de contraseñas (bcrypt) y tokens de acceso (JWT)."""

import base64
import hashlib
from functools import cache

import bcrypt


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
