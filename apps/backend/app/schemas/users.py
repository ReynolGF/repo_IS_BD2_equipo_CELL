"""Esquemas de usuarios y de los datos propios de cada rol."""

from typing import TYPE_CHECKING, Self

from pydantic import BaseModel

from app.db.enums import Occupation, Shift

if TYPE_CHECKING:
    from app.models.users import User


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
