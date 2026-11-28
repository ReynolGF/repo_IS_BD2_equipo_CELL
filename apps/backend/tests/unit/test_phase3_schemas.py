import pytest
from pydantic import ValidationError

from app.db.enums import Criticality, OperationalStatus, TaskType
from app.schemas.infrastructure import (
    EquipmentCreate,
    EquipmentUpdate,
    LineCreate,
    LineUpdate,
)
from app.schemas.tasks import TaskCreate, TaskUpdate


def test_linea_limpia_espacios() -> None:
    line = LineCreate(name="  Línea   1 ", production_process=" Embotellado ")
    assert line.name == "Línea 1"
    assert line.production_process == "Embotellado"


def test_linea_rechaza_nombre_vacio() -> None:
    with pytest.raises(ValidationError):
        LineCreate(name="   ", production_process="Embotellado")


def test_equipo_nuevo_empieza_operativo_y_descripcion_vacia_es_ausente() -> None:
    equipment = EquipmentCreate(name="Bomba", description="   ")
    assert equipment.operational_status is OperationalStatus.operational
    assert equipment.description is None


@pytest.mark.parametrize("schema", [LineUpdate, EquipmentUpdate, TaskUpdate])
def test_modificacion_vacia_se_rechaza(schema: type) -> None:
    with pytest.raises(ValidationError):
        schema()


def test_modificacion_rechaza_nulos_salvo_descripcion_de_equipo() -> None:
    with pytest.raises(ValidationError):
        LineUpdate(name=None)
    with pytest.raises(ValidationError):
        TaskUpdate(type=None)
    assert EquipmentUpdate(description=None).description is None
    assert EquipmentUpdate(description="").description is None


def test_tarea_valida_y_descripcion_limpia() -> None:
    task = TaskCreate(
        description="  Revisar   rodamiento ",
        type="preventive",
        criticality_level="high",
        id_equipment=1,
    )
    assert task.description == "Revisar rodamiento"
    assert task.type is TaskType.preventive
    assert task.criticality_level is Criticality.high


@pytest.mark.parametrize("description", ["ab", "  a  ", "x" * 501])
def test_tarea_rechaza_descripcion_fuera_de_rango(description: str) -> None:
    with pytest.raises(ValidationError):
        TaskCreate(
            description=description, type="corrective", criticality_level="low", id_equipment=1
        )


def test_tarea_rechaza_tipo_desconocido() -> None:
    with pytest.raises(ValidationError):
        TaskCreate(description="Revisar", type="otro", criticality_level="low", id_equipment=1)
