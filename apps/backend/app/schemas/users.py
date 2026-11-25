"""Esquemas de usuarios y de los datos propios de cada rol."""

from typing import TYPE_CHECKING, Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.db.enums import Occupation, Shift
from app.schemas.auth import Password

if TYPE_CHECKING:
    from app.models.users import User


class UserCreate(BaseModel):
    """Datos para crear un usuario. Los campos del perfil dependen del rol.

    - ``technician``: exige ``specialty``.
    - ``operator``: exige ``age`` y ``shift``.
    - ``plant_manager`` y ``administrator``: no admiten campos de perfil.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: Password
    occupation: Occupation
    specialty: str | None = Field(default=None, min_length=1, max_length=150)
    age: int | None = Field(default=None, gt=0, le=120)
    shift: Shift | None = None

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str) -> str:
        """Normaliza el correo a minúsculas."""
        return value.lower()

    @model_validator(mode="after")
    def _check_profile_fields(self) -> Self:
        """Comprueba que estén exactamente los campos de perfil que corresponden al rol."""
        required: dict[Occupation, set[str]] = {
            Occupation.technician: {"specialty"},
            Occupation.operator: {"age", "shift"},
            Occupation.plant_manager: set(),
            Occupation.administrator: set(),
        }
        needed = required[self.occupation]
        for field in ("specialty", "age", "shift"):
            present = getattr(self, field) is not None
            if field in needed and not present:
                raise ValueError(f"El campo '{field}' es obligatorio para {self.occupation.value}")
            if field not in needed and present:
                raise ValueError(f"El campo '{field}' no aplica a {self.occupation.value}")
        return self


class UserUpdate(BaseModel):
    """Datos modificables de un usuario. Solo se cambian los campos enviados.

    El rol no se puede cambiar. Los campos de perfil deben corresponder al rol del usuario.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=150)
    email: EmailStr | None = None
    password: Password | None = None
    is_active: bool | None = None
    specialty: str | None = Field(default=None, min_length=1, max_length=150)
    age: int | None = Field(default=None, gt=0, le=120)
    shift: Shift | None = None

    @field_validator("email")
    @classmethod
    def _lowercase_email(cls, value: str | None) -> str | None:
        """Normaliza el correo a minúsculas."""
        return value.lower() if value is not None else None


class UserRead(BaseModel):
    """Usuario tal como lo devuelve la API: nunca incluye la contraseña ni su hash."""

    id_user: int
    name: str
    email: str
    occupation: Occupation
    is_active: bool
    id_technician: int | None = None
    specialty: str | None = None
    id_operator: int | None = None
    age: int | None = None
    shift: Shift | None = None
    id_manager: int | None = None
    id_admin: int | None = None

    @classmethod
    def from_user(cls, user: "User") -> Self:
        """Construye la respuesta a partir del usuario y su fila de subtipo."""
        data: dict[str, object] = {
            "id_user": user.id_user,
            "name": user.name,
            "email": user.email,
            "occupation": user.occupation,
            "is_active": user.is_active,
        }
        if user.technician is not None:
            data["id_technician"] = user.technician.id_technician
            data["specialty"] = user.technician.specialty
        if user.operator is not None:
            data["id_operator"] = user.operator.id_operator
            data["age"] = user.operator.age
            data["shift"] = user.operator.shift
        if user.manager is not None:
            data["id_manager"] = user.manager.id_manager
        if user.admin is not None:
            data["id_admin"] = user.admin.id_admin
        return cls.model_validate(data)


class UserPage(BaseModel):
    """Página de resultados de la lista de usuarios."""

    items: list[UserRead]
    total: int
    limit: int
    offset: int
