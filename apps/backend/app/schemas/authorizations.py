"""Esquemas de las autorizaciones de técnicos por línea."""

from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator


class AuthorizationUpsert(BaseModel):
    """Permisos que se conceden a un técnico en una línea."""

    can_generate: bool = False
    can_validate: bool = False

    @model_validator(mode="after")
    def _at_least_one(self) -> Self:
        """Exige al menos un permiso; la base de datos lo impone también con un CHECK."""
        if not (self.can_generate or self.can_validate):
            raise ValueError(
                "Debe concederse al menos un permiso; para quitar la autorización use DELETE"
            )
        return self


class AuthorizationRead(BaseModel):
    """Autorización de un técnico en una línea."""

    model_config = ConfigDict(from_attributes=True)

    id_technician: int
    id_line: int
    can_generate: bool
    can_validate: bool
