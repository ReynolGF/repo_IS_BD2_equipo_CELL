from types import SimpleNamespace
from typing import Any

import pytest

from app.api.deps import (
    get_current_manager,
    get_current_operator,
    get_current_technician,
    require_role,
)
from app.core.exceptions import PermissionDeniedError
from app.db.enums import Occupation


def _user(occupation: Occupation, **profiles: Any) -> Any:
    base = {"technician": None, "operator": None, "manager": None, "admin": None}
    return SimpleNamespace(occupation=occupation, **{**base, **profiles})


def test_require_role_deja_pasar_al_rol_permitido() -> None:
    dependency = require_role(Occupation.administrator, Occupation.plant_manager)
    user = _user(Occupation.plant_manager)
    assert dependency(user) is user


def test_require_role_rechaza_otros_roles() -> None:
    dependency = require_role(Occupation.administrator)
    with pytest.raises(PermissionDeniedError):
        dependency(_user(Occupation.operator))


def test_get_current_technician_devuelve_el_perfil() -> None:
    profile = SimpleNamespace(id_technician=3)
    assert get_current_technician(_user(Occupation.technician, technician=profile)) is profile


@pytest.mark.parametrize(
    "dependency",
    [get_current_technician, get_current_operator, get_current_manager],
)
def test_usuario_sin_fila_de_perfil_es_rechazado(dependency: Any) -> None:
    with pytest.raises(PermissionDeniedError):
        dependency(_user(Occupation.technician))
