"""Esquemas de autenticación."""

from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator

Password = Annotated[str, Field(min_length=8, max_length=128)]


class LoginRequest(BaseModel):
    """Credenciales de inicio de sesión."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        """Normaliza el correo a minúsculas."""
        return value.lower()


class TokenResponse(BaseModel):
    """Token de acceso entregado tras un inicio de sesión correcto."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Duración del token en segundos")


class ChangePasswordRequest(BaseModel):
    """Cambio de la contraseña propia."""

    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password
