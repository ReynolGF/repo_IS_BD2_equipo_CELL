from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from app.db.enums import Occupation, Shift
from app.schemas.authorizations import AuthorizationUpsert
from app.schemas.users import UserCreate, UserRead, UserUpdate

BASE: dict[str, Any] = {"name": "Ana", "email": "Ana@Planta.com", "password": "clave-segura-1"}


def test_tecnico_valido_y_correo_en_minusculas() -> None:
    user = UserCreate(**BASE, occupation="technician", specialty="eléctrica")
    assert user.email == "ana@planta.com"
    assert user.specialty == "eléctrica"


def test_operario_valido() -> None:
    user = UserCreate(**BASE, occupation="operator", age=30, shift="night")
    assert user.shift is Shift.night


@pytest.mark.parametrize("occupation", ["plant_manager", "administrator"])
def test_jefe_y_administrador_no_llevan_perfil(occupation: str) -> None:
    assert UserCreate(**BASE, occupation=occupation).occupation == Occupation(occupation)


@pytest.mark.parametrize(
    ("occupation", "extra"),
    [
        ("technician", {}),  # falta specialty
        ("technician", {"specialty": "x", "age": 30}),  # sobra age
        ("operator", {"age": 30}),  # falta shift
        ("operator", {"shift": "night"}),  # falta age
        ("operator", {"age": 30, "shift": "night", "specialty": "x"}),  # sobra specialty
        ("administrator", {"specialty": "x"}),  # sobra specialty
        ("plant_manager", {"age": 30, "shift": "night"}),  # sobran age y shift
    ],
)
def test_campos_de_perfil_incorrectos_para_el_rol(occupation: str, extra: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        UserCreate(**BASE, occupation=occupation, **extra)


@pytest.mark.parametrize("password", ["corta", "x" * 129])
def test_contrasena_fuera_de_longitud_es_rechazada(password: str) -> None:
    with pytest.raises(ValidationError):
        UserCreate(**{**BASE, "password": password}, occupation="administrator")


def test_edad_invalida_es_rechazada() -> None:
    with pytest.raises(ValidationError):
        UserCreate(**BASE, occupation="operator", age=0, shift="night")


def test_correo_invalido_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        UserCreate(**{**BASE, "email": "no-es-un-correo"}, occupation="administrator")


def test_update_solo_incluye_los_campos_enviados() -> None:
    update = UserUpdate(is_active=False)
    assert update.model_dump(exclude_unset=True) == {"is_active": False}


def test_update_normaliza_el_correo() -> None:
    assert UserUpdate(email="Nuevo@Planta.com").email == "nuevo@planta.com"


def test_autorizacion_sin_permisos_es_rechazada() -> None:
    with pytest.raises(ValidationError):
        AuthorizationUpsert(can_generate=False, can_validate=False)
    assert AuthorizationUpsert(can_validate=True).can_validate


def test_user_read_nunca_expone_la_contrasena() -> None:
    user = SimpleNamespace(
        id_user=1,
        name="Ana",
        email="ana@planta.com",
        occupation=Occupation.technician,
        is_active=True,
        password_hash="secreto",
        technician=SimpleNamespace(id_technician=7, specialty="eléctrica"),
        operator=None,
        manager=None,
        admin=None,
    )
    data = UserRead.from_user(user).model_dump()  # type: ignore[arg-type]
    assert data["id_technician"] == 7
    assert data["specialty"] == "eléctrica"
    assert "password_hash" not in data
    assert "password" not in data
