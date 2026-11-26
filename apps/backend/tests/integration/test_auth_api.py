from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.core.security import create_access_token
from app.db.enums import Occupation
from app.models.users import User
from tests.integration.conftest import PASSWORD

pytestmark = pytest.mark.integration

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _login(client: TestClient, email: str, password: str = PASSWORD) -> Response:
    return client.post("/auth/login", json={"email": email, "password": password})


def test_login_correcto_devuelve_token_usable(api_client: TestClient, make_user: MakeUser) -> None:
    user = make_user(Occupation.technician)
    response = _login(api_client, user.email)
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0

    me = api_client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["id_user"] == user.id_user
    assert me.json()["id_technician"] == user.technician.id_technician  # type: ignore[union-attr]


def test_login_ignora_mayusculas_en_el_correo(api_client: TestClient, make_user: MakeUser) -> None:
    user = make_user(Occupation.operator)
    assert _login(api_client, user.email.upper()).status_code == 200


def test_login_con_contrasena_incorrecta_da_401(
    api_client: TestClient, make_user: MakeUser
) -> None:
    user = make_user()
    response = _login(api_client, user.email, "incorrecta")
    assert response.status_code == 401
    assert response.json() == {"detail": "Correo o contraseña incorrectos"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_login_con_correo_inexistente_da_el_mismo_mensaje(api_client: TestClient) -> None:
    response = _login(api_client, "nadie@planta.com")
    assert response.status_code == 401
    assert response.json() == {"detail": "Correo o contraseña incorrectos"}


def test_login_de_cuenta_desactivada_da_403(api_client: TestClient, make_user: MakeUser) -> None:
    user = make_user(is_active=False)
    response = _login(api_client, user.email)
    assert response.status_code == 403
    assert response.json() == {"detail": "La cuenta está desactivada"}


def test_la_respuesta_nunca_incluye_el_hash(api_client: TestClient, make_user: MakeUser) -> None:
    user = make_user()
    token = _login(api_client, user.email).json()["access_token"]
    body = api_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).text
    assert "password" not in body


def test_sin_token_da_401(api_client: TestClient) -> None:
    response = api_client.get("/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Falta el token de acceso"}


def test_token_invalido_da_401(api_client: TestClient) -> None:
    response = api_client.get("/auth/me", headers={"Authorization": "Bearer basura"})
    assert response.status_code == 401


def test_token_caducado_da_401(api_client: TestClient, make_user: MakeUser) -> None:
    user = make_user()
    token, _ = create_access_token(user.id_user, "administrator", timedelta(seconds=-1))
    response = api_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "expirado" in response.json()["detail"]


def test_token_de_usuario_inexistente_da_401(api_client: TestClient) -> None:
    token, _ = create_access_token(999_999, "administrator")
    response = api_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_desactivar_la_cuenta_invalida_sus_tokens(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user(Occupation.technician)
    headers = auth_headers(user)
    assert api_client.get("/auth/me", headers=headers).status_code == 200
    user.is_active = False
    assert api_client.get("/auth/me", headers=headers).status_code == 401


def test_el_rol_se_lee_de_la_base_de_datos_no_del_token(
    api_client: TestClient, make_user: MakeUser
) -> None:
    operator = make_user(Occupation.operator)
    # Un token que afirma ser administrador, emitido para un usuario que es operario.
    token, _ = create_access_token(operator.id_user, "administrator")
    response = api_client.get("/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403


def test_cambio_de_contrasena(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = api_client.post(
        "/auth/change-password",
        headers=auth_headers(user),
        json={"current_password": PASSWORD, "new_password": "nueva-clave-2"},
    )
    assert response.status_code == 204
    assert _login(api_client, user.email, PASSWORD).status_code == 401
    assert _login(api_client, user.email, "nueva-clave-2").status_code == 200


def test_cambio_de_contrasena_exige_la_actual(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = api_client.post(
        "/auth/change-password",
        headers=auth_headers(user),
        json={"current_password": "incorrecta", "new_password": "nueva-clave-2"},
    )
    assert response.status_code == 422
    assert _login(api_client, user.email, PASSWORD).status_code == 200


def test_nueva_contrasena_corta_da_422(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    user = make_user()
    response = api_client.post(
        "/auth/change-password",
        headers=auth_headers(user),
        json={"current_password": PASSWORD, "new_password": "corta"},
    )
    assert response.status_code == 422
