from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.exceptions import PermissionDeniedError
from app.db.enums import Criticality, Occupation
from app.models.infrastructure import LineAuthorization, ProductionLine
from app.models.plans import Plan
from app.models.users import User
from app.services.authorization_policy import AuthorizationPolicy

pytestmark = pytest.mark.integration

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _tech_id(user: User) -> int:
    return user.technician.id_technician  # type: ignore[union-attr]


def _authorize(
    session: Session, user: User, line: ProductionLine, *, generate: bool, validate: bool
) -> None:
    session.add(
        LineAuthorization(
            id_technician=_tech_id(user),
            id_line=line.id_line,
            can_generate=generate,
            can_validate=validate,
        )
    )
    session.flush()


# ---------------------------------------------------------------------------
# Política (servicio)
# ---------------------------------------------------------------------------


def test_politica_distingue_generar_de_validar(
    session: Session, make_user: MakeUser, line: ProductionLine
) -> None:
    generator = make_user(Occupation.technician)
    validator = make_user(Occupation.technician)
    outsider = make_user(Occupation.technician)
    _authorize(session, generator, line, generate=True, validate=False)
    _authorize(session, validator, line, generate=False, validate=True)
    policy = AuthorizationPolicy(session)

    assert policy.can_generate(_tech_id(generator), line.id_line)
    assert not policy.can_validate(_tech_id(generator), line.id_line)
    assert policy.can_validate(_tech_id(validator), line.id_line)
    assert not policy.can_generate(_tech_id(validator), line.id_line)
    assert not policy.can_generate(_tech_id(outsider), line.id_line)
    assert not policy.can_validate(_tech_id(outsider), line.id_line)


def test_politica_require_lanza_permiso_denegado(
    session: Session, make_user: MakeUser, line: ProductionLine
) -> None:
    outsider = make_user(Occupation.technician)
    policy = AuthorizationPolicy(session)
    with pytest.raises(PermissionDeniedError):
        policy.require_generate(_tech_id(outsider), line.id_line)
    with pytest.raises(PermissionDeniedError):
        policy.require_validate(_tech_id(outsider), line.id_line)


def test_politica_ignora_a_los_tecnicos_inactivos(
    session: Session, make_user: MakeUser, line: ProductionLine
) -> None:
    active = make_user(Occupation.technician)
    inactive = make_user(Occupation.technician, is_active=False)
    _authorize(session, active, line, generate=True, validate=True)
    _authorize(session, inactive, line, generate=True, validate=True)
    policy = AuthorizationPolicy(session)

    assert policy.can_generate(_tech_id(active), line.id_line)
    assert not policy.can_generate(_tech_id(inactive), line.id_line)
    assert not policy.can_validate(_tech_id(inactive), line.id_line)
    assert [t.id_technician for t in policy.technicians_who_can_generate(line.id_line)] == [
        _tech_id(active)
    ]
    assert [t.id_technician for t in policy.technicians_who_can_validate(line.id_line)] == [
        _tech_id(active)
    ]


def test_politica_lista_solo_a_quien_tiene_el_permiso_pedido(
    session: Session, make_user: MakeUser, line: ProductionLine
) -> None:
    generator = make_user(Occupation.technician)
    validator = make_user(Occupation.technician)
    _authorize(session, generator, line, generate=True, validate=False)
    _authorize(session, validator, line, generate=False, validate=True)
    policy = AuthorizationPolicy(session)
    assert [t.id_technician for t in policy.technicians_who_can_generate(line.id_line)] == [
        _tech_id(generator)
    ]
    assert [t.id_technician for t in policy.technicians_who_can_validate(line.id_line)] == [
        _tech_id(validator)
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def test_admin_concede_y_actualiza_permisos(
    api_client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    url = f"/lines/{line.id_line}/authorizations/{_tech_id(technician)}"
    headers = auth_headers(admin)

    created = api_client.put(url, headers=headers, json={"can_generate": True})
    assert created.status_code == 200
    assert created.json() == {
        "id_technician": _tech_id(technician),
        "id_line": line.id_line,
        "can_generate": True,
        "can_validate": False,
    }

    updated = api_client.put(url, headers=headers, json={"can_validate": True})
    assert updated.json()["can_generate"] is False
    assert updated.json()["can_validate"] is True

    listing = api_client.get(f"/lines/{line.id_line}/authorizations", headers=headers).json()
    assert len(listing) == 1


def test_conceder_sin_ningun_permiso_da_422(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    response = api_client.put(
        f"/lines/{line.id_line}/authorizations/{_tech_id(technician)}",
        headers=auth_headers(admin),
        json={"can_generate": False, "can_validate": False},
    )
    assert response.status_code == 422


def test_conceder_con_linea_o_tecnico_inexistente_da_404(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    headers = auth_headers(admin)
    body = {"can_generate": True}
    assert (
        api_client.put(
            f"/lines/999999/authorizations/{_tech_id(technician)}", headers=headers, json=body
        ).status_code
        == 404
    )
    assert (
        api_client.put(
            f"/lines/{line.id_line}/authorizations/999999", headers=headers, json=body
        ).status_code
        == 404
    )


def test_no_se_autoriza_a_un_tecnico_desactivado(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    admin = make_user()
    inactive = make_user(Occupation.technician, is_active=False)
    response = api_client.put(
        f"/lines/{line.id_line}/authorizations/{_tech_id(inactive)}",
        headers=auth_headers(admin),
        json={"can_generate": True},
    )
    assert response.status_code == 422


def test_solo_el_administrador_administra_autorizaciones(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    technician = make_user(Occupation.technician)
    url = f"/lines/{line.id_line}/authorizations/{_tech_id(technician)}"
    headers = auth_headers(technician)
    assert api_client.put(url, headers=headers, json={"can_generate": True}).status_code == 403
    assert api_client.delete(url, headers=headers).status_code == 403
    assert (
        api_client.get(f"/lines/{line.id_line}/authorizations", headers=headers).status_code == 403
    )


def test_el_tecnico_consulta_sus_propias_autorizaciones(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    technician = make_user(Occupation.technician)
    other = make_user(Occupation.technician)
    _authorize(session, technician, line, generate=True, validate=False)
    _authorize(session, other, line, generate=False, validate=True)

    response = api_client.get("/technicians/me/authorizations", headers=auth_headers(technician))
    assert response.status_code == 200
    assert [item["id_technician"] for item in response.json()] == [_tech_id(technician)]


def test_un_operario_no_accede_a_las_autorizaciones_de_tecnico(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    operator = make_user(Occupation.operator)
    response = api_client.get("/technicians/me/authorizations", headers=auth_headers(operator))
    assert response.status_code == 403


def test_admin_consulta_las_autorizaciones_de_un_tecnico(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    _authorize(session, technician, line, generate=True, validate=True)
    response = api_client.get(
        f"/technicians/{_tech_id(technician)}/authorizations", headers=auth_headers(admin)
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    missing = api_client.get("/technicians/999999/authorizations", headers=auth_headers(admin))
    assert missing.status_code == 404


def test_quitar_una_autorizacion(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    _authorize(session, technician, line, generate=True, validate=False)
    url = f"/lines/{line.id_line}/authorizations/{_tech_id(technician)}"
    headers = auth_headers(admin)

    assert api_client.delete(url, headers=headers).status_code == 204
    assert api_client.get(f"/lines/{line.id_line}/authorizations", headers=headers).json() == []
    assert api_client.delete(url, headers=headers).status_code == 404


def test_no_se_quita_la_autorizacion_a_quien_ya_creo_planes_en_la_linea(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    _authorize(session, technician, line, generate=True, validate=False)
    session.add(
        Plan(
            criticality_level=Criticality.high,
            preventive_percentage=50,
            corrective_percentage=30,
            predictive_percentage=20,
            system_coverage=1,
            total_task_count=1,
            id_line=line.id_line,
            id_creator_technician=_tech_id(technician),
        )
    )
    session.flush()
    url = f"/lines/{line.id_line}/authorizations/{_tech_id(technician)}"

    response = api_client.delete(url, headers=auth_headers(admin))
    assert response.status_code == 409
    still = api_client.get(f"/lines/{line.id_line}/authorizations", headers=auth_headers(admin))
    assert len(still.json()) == 1
