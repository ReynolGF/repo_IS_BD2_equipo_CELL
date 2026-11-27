"""Esquemas de líneas de producción, equipos y asignación de operarios."""

from datetime import datetime
from typing import Annotated, ClassVar, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.text import clean_text
from app.db.enums import OperationalStatus
from app.models.infrastructure import EquipmentSystem, ProductionLine

Name = Annotated[str, StringConstraints(min_length=1, max_length=150)]


def _clean_required(value: str | None) -> str | None:
    """Limpia un texto y exige que no quede vacío."""
    if value is None:
        return None
    cleaned = clean_text(value)
    if not cleaned:
        raise ValueError("No puede estar vacío")
    return cleaned


def _clean_optional(value: str | None) -> str | None:
    """Limpia un texto opcional; si queda vacío se guarda como ausente."""
    return (clean_text(value) or None) if value is not None else None


class _NoNulls(BaseModel):
    """Base de los esquemas de modificación parcial: un campo enviado no puede ser ``null``.

    Los campos de ``_nullable`` sí admiten ``null`` (sirve para borrar un dato opcional).
    """

    _nullable: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def _reject_nulls_and_empty(self) -> Self:
        """Rechaza campos enviados como ``null`` y peticiones sin ningún campo."""
        if not self.model_fields_set:
            raise ValueError("Indique al menos un campo para modificar")
        for field in self.model_fields_set:
            if field not in self._nullable and getattr(self, field) is None:
                raise ValueError(f"El campo '{field}' no puede ser nulo")
        return self


class LineCreate(BaseModel):
    """Datos para registrar una línea de producción (RF1)."""

    name: Name
    production_process: Annotated[str, StringConstraints(min_length=1, max_length=255)]

    _clean = field_validator("name", "production_process")(_clean_required)


class LineUpdate(_NoNulls):
    """Modificación parcial de una línea."""

    name: Name | None = None
    production_process: Annotated[str, StringConstraints(min_length=1, max_length=255)] | None = (
        None
    )

    _clean = field_validator("name", "production_process")(_clean_required)


class EquipmentCreate(BaseModel):
    """Datos para registrar un equipo o sistema."""

    name: Name
    description: Annotated[str, StringConstraints(max_length=500)] | None = None
    operational_status: OperationalStatus = OperationalStatus.operational

    _clean_name = field_validator("name")(_clean_required)

    _clean_description = field_validator("description")(_clean_optional)


class EquipmentUpdate(_NoNulls):
    """Modificación parcial de un equipo. El estado operativo tiene su propio endpoint.

    Enviar ``description`` vacía o ``null`` borra la descripción.
    """

    _nullable: ClassVar[frozenset[str]] = frozenset({"description"})

    name: Name | None = None
    description: Annotated[str, StringConstraints(max_length=500)] | None = None

    _clean_name = field_validator("name")(_clean_required)
    _clean_description = field_validator("description")(_clean_optional)


class EquipmentStatusUpdate(BaseModel):
    """Nuevo estado operativo de un equipo (RF41)."""

    operational_status: OperationalStatus


class EquipmentSummary(BaseModel):
    """Datos de un equipo."""

    model_config = ConfigDict(from_attributes=True)

    id_equipment: int
    name: str
    description: str | None
    operational_status: OperationalStatus
    status_date: datetime


class EquipmentRead(EquipmentSummary):
    """Equipo con las líneas que lo cubren."""

    line_ids: list[int]

    @classmethod
    def from_equipment(cls, equipment: EquipmentSystem) -> Self:
        """Construye la respuesta a partir del modelo, con las líneas ordenadas."""
        base = EquipmentSummary.model_validate(equipment)
        line_ids = sorted(membership.id_line for membership in equipment.lines)
        return cls(**base.model_dump(), line_ids=line_ids)


class LineRead(BaseModel):
    """Datos de una línea."""

    model_config = ConfigDict(from_attributes=True)

    id_line: int
    name: str
    production_process: str


class LineDetail(LineRead):
    """Línea junto con los equipos que tiene asociados (RF2 y RF3)."""

    equipment: list[EquipmentSummary] = Field(default_factory=list)

    @classmethod
    def from_line(cls, line: ProductionLine) -> Self:
        """Construye la respuesta a partir del modelo, con los equipos ordenados por id."""
        base = LineRead.model_validate(line)
        equipment = sorted(
            (EquipmentSummary.model_validate(m.equipment) for m in line.equipment),
            key=lambda item: item.id_equipment,
        )
        return cls(**base.model_dump(), equipment=equipment)
