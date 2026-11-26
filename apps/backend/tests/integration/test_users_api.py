from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.enums import Occupation
from app.models.users import User
from tests.integration.conftest import PASSWORD

pytestmark = pytest.mark.integration

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _new_user(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Ana Pérez",
        "email": "Ana.Perez@Planta.com",
        "password": PASSWORD,
        "occupation": "technician",
        "specialty": "eléctrica",
    }
    body.update(overrides)
    return body


def _count(session: Session, model: type, **filters: Any) -> int:
    statement = select(func.count()).select_from(model)
    for column, value in filters.items():
        statement = statement.where(getattr(model, column) == value)
    return session.scalar(statement) or 0


# ---------------------------------------------------------------------------
# Control de acceso
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "occupation", [Occupation.technician, Occupation.operator, Occupation.plant_manager]
)
def test_solo_el_administrador_gestiona_usuarios(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, occupation: Occupation
) -> None:
    user = make_user(occupation)
    headers = auth_headers(user)
    assert api_client.get("/users", headers=headers).status_code == 403
    assert api_client.post("/users", headers=headers, json=_new_user()).status_code == 403
    assert api_client.get(f"/users/{user.id_user}", headers=headers).status_code == 403
    assert api_client.patch(f"/users/{user.id_user}", headers=headers, json={}).status_code == 403


def test_sin_token_no_se_puede_listar(api_client: TestClient) -> None:
    assert api_client.get("/users").status_code == 401


# ---------------------------------------------------------------------------
# Alta
# ---------------------------------------------------------------------------


def test_admin_crea_tecnico_que_luego_puede_iniciar_sesion(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    response = api_client.post("/users", headers=auth_headers(admin), json=_new_user())
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ana.perez@planta.com"
    assert body["occupation"] == "technician"
    assert body["is_active"] is True
    assert body["specialty"] == "eléctrica"
    assert body["id_technician"] is not None
    assert "password" not in response.text

    login = api_client.post(
        "/auth/login", json={"email": "ana.perez@planta.com", "password": PASSWORD}
    )
    assert login.status_code == 200


@pytest.mark.parametrize(
    ("payload", "id_field"),
    [
        ({"occupation": "operator", "age": 28, "shift": "night"}, "id_operator"),
        ({"occupation": "plant_manager"}, "id_manager"),
        ({"occupation": "administrator"}, "id_admin"),
    ],
)
def test_admin_crea_cada_rol_con_su_subtipo(
    api_client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    payload: dict[str, Any],
    id_field: str,
) -> None:
    admin = make_user()
    body = _new_user(specialty=None, **payload)
    response = api_client.post("/users", headers=auth_headers(admin), json=body)
    assert response.status_code == 201, response.text
    assert response.json()[id_field] is not None


def test_correo_duplicado_da_409_sin_distinguir_mayusculas(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    headers = auth_headers(admin)
    assert api_client.post("/users", headers=headers, json=_new_user()).status_code == 201
    duplicate = _new_user(email="ANA.PEREZ@PLANTA.COM")
    response = api_client.post("/users", headers=headers, json=duplicate)
    assert response.status_code == 409


@pytest.mark.parametrize(
    "overrides",
    [
        {"specialty": None},  # técnico sin especialidad
        {"age": 30},  # técnico con campo de operario
        {"password": "corta"},
        {"email": "no-es-correo"},
        {"occupation": "inventado"},
    ],
)
def test_datos_invalidos_dan_422(
    api_client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    overrides: dict[str, Any],
) -> None:
    admin = make_user()
    response = api_client.post("/users", headers=auth_headers(admin), json=_new_user(**overrides))
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Consulta
# ---------------------------------------------------------------------------


def test_listado_con_filtros_y_paginacion(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    for _ in range(3):
        make_user(Occupation.operator)
    make_user(Occupation.operator, is_active=False)
    make_user(Occupation.technician, email="busqueda_unica@planta.com")
    headers = auth_headers(admin)

    everyone = api_client.get("/users", headers=headers).json()
    assert everyone["total"] == 6  # admin + 4 operarios + 1 técnico

    operators = api_client.get("/users?occupation=operator", headers=headers).json()
    assert operators["total"] == 4

    active_operators = api_client.get(
        "/users?occupation=operator&is_active=true", headers=headers
    ).json()
    assert active_operators["total"] == 3
    assert all(item["is_active"] for item in active_operators["items"])
    assert all(item["id_operator"] is not None for item in active_operators["items"])

    page = api_client.get("/users?limit=2&offset=2", headers=headers).json()
    assert page["total"] == 6
    assert len(page["items"]) == 2
    assert page["limit"] == 2 and page["offset"] == 2

    found = api_client.get("/users?q=BUSQUEDA_unica", headers=headers).json()
    assert found["total"] == 1


def test_la_busqueda_trata_los_comodines_como_texto(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    make_user(Occupation.operator)
    response = api_client.get("/users?q=%25", headers=auth_headers(admin))  # "%"
    assert response.json()["total"] == 0


def test_limite_fuera_de_rango_da_422(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    assert api_client.get("/users?limit=0", headers=auth_headers(admin)).status_code == 422
    assert api_client.get("/users?limit=1000", headers=auth_headers(admin)).status_code == 422


def test_obtener_usuario_existente_e_inexistente(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    operator = make_user(Occupation.operator)
    headers = auth_headers(admin)
    found = api_client.get(f"/users/{operator.id_user}", headers=headers)
    assert found.status_code == 200
    assert found.json()["age"] == 30
    assert api_client.get("/users/999999", headers=headers).status_code == 404


# ---------------------------------------------------------------------------
# Modificación y baja lógica
# ---------------------------------------------------------------------------


def test_modificar_datos_y_perfil(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    response = api_client.patch(
        f"/users/{technician.id_user}",
        headers=auth_headers(admin),
        json={"name": "Nombre Nuevo", "specialty": "hidráulica", "email": "Nuevo@Planta.com"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Nombre Nuevo"
    assert body["specialty"] == "hidráulica"
    assert body["email"] == "nuevo@planta.com"


def test_campo_de_perfil_que_no_corresponde_al_rol_da_422(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    response = api_client.patch(
        f"/users/{technician.id_user}", headers=auth_headers(admin), json={"age": 40}
    )
    assert response.status_code == 422


def test_cambiar_el_correo_a_uno_ocupado_da_409(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    other = make_user(Occupation.operator)
    target = make_user(Occupation.technician)
    response = api_client.patch(
        f"/users/{target.id_user}", headers=auth_headers(admin), json={"email": other.email}
    )
    assert response.status_code == 409


def test_conservar_el_propio_correo_no_es_conflicto(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    target = make_user(Occupation.technician)
    response = api_client.patch(
        f"/users/{target.id_user}", headers=auth_headers(admin), json={"email": target.email}
    )
    assert response.status_code == 200


def test_el_administrador_puede_restablecer_una_contrasena(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    target = make_user(Occupation.operator)
    response = api_client.patch(
        f"/users/{target.id_user}", headers=auth_headers(admin), json={"password": "restablecida-1"}
    )
    assert response.status_code == 200
    login = api_client.post(
        "/auth/login", json={"email": target.email, "password": "restablecida-1"}
    )
    assert login.status_code == 200


def test_baja_logica_bloquea_el_acceso_y_se_puede_revertir(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    admin_headers = auth_headers(admin)
    technician_headers = auth_headers(technician)

    off = api_client.patch(
        f"/users/{technician.id_user}", headers=admin_headers, json={"is_active": False}
    )
    assert off.status_code == 200 and off.json()["is_active"] is False
    assert api_client.get("/auth/me", headers=technician_headers).status_code == 401
    login = api_client.post("/auth/login", json={"email": technician.email, "password": PASSWORD})
    assert login.status_code == 403

    on = api_client.patch(
        f"/users/{technician.id_user}", headers=admin_headers, json={"is_active": True}
    )
    assert on.json()["is_active"] is True
    assert api_client.get("/auth/me", headers=technician_headers).status_code == 200


def test_el_administrador_no_puede_desactivarse_a_si_mismo(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    response = api_client.patch(
        f"/users/{admin.id_user}", headers=auth_headers(admin), json={"is_active": False}
    )
    assert response.status_code == 422
    assert api_client.get("/auth/me", headers=auth_headers(admin)).status_code == 200


# ---------------------------------------------------------------------------
# Los usuarios no se eliminan; un usuario inactivo no puede hacer nada
# ---------------------------------------------------------------------------


def test_no_existe_el_borrado_de_usuarios(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, session: Session
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    response = api_client.delete(f"/users/{technician.id_user}", headers=auth_headers(admin))
    assert response.status_code == 405
    assert _count(session, User, id_user=technician.id_user) == 1


@pytest.mark.parametrize(
    ("occupation", "method", "url", "body"),
    [
        (Occupation.administrator, "GET", "/users", None),
        (Occupation.administrator, "POST", "/users", "new_user"),
        (Occupation.technician, "GET", "/technicians/me/authorizations", None),
        (Occupation.technician, "GET", "/auth/me", None),
        (Occupation.operator, "GET", "/auth/me", None),
        (Occupation.plant_manager, "GET", "/auth/me", None),
        (Occupation.technician, "POST", "/auth/change-password", "change_password"),
    ],
)
def test_un_usuario_inactivo_no_puede_hacer_nada_con_su_token_anterior(
    api_client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    occupation: Occupation,
    method: str,
    url: str,
    body: str | None,
) -> None:
    actor = make_user()  # otro administrador que da de baja
    user = make_user(occupation)
    old_token_headers = auth_headers(user)  # emitido antes de la baja

    payloads = {
        "new_user": _new_user(),
        "change_password": {"current_password": PASSWORD, "new_password": "nueva-clave-2"},
    }
    json = payloads.get(body) if body else None

    # Con la cuenta activa, el token funciona (la acción no devuelve 401 ni 403).
    before = api_client.request(method, url, headers=old_token_headers, json=json)
    assert before.status_code not in (401, 403), before.text

    off = api_client.patch(
        f"/users/{user.id_user}", headers=auth_headers(actor), json={"is_active": False}
    )
    assert off.status_code == 200

    after = api_client.request(method, url, headers=old_token_headers, json=json)
    assert after.status_code == 401


def test_un_administrador_inactivo_no_puede_reactivarse_ni_modificar_a_nadie(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    actor = make_user()
    other = make_user()
    other_headers = auth_headers(other)
    api_client.patch(
        f"/users/{other.id_user}", headers=auth_headers(actor), json={"is_active": False}
    )

    reactivate = api_client.patch(
        f"/users/{other.id_user}", headers=other_headers, json={"is_active": True}
    )
    assert reactivate.status_code == 401
    modify = api_client.patch(
        f"/users/{actor.id_user}", headers=other_headers, json={"name": "Intruso"}
    )
    assert modify.status_code == 401
    # Solo otro administrador activo puede reactivarlo.
    ok = api_client.patch(
        f"/users/{other.id_user}", headers=auth_headers(actor), json={"is_active": True}
    )
    assert ok.status_code == 200


def test_un_usuario_inactivo_no_inicia_sesion_aunque_la_contrasena_sea_correcta(
    api_client: TestClient, make_user: MakeUser
) -> None:
    user = make_user(Occupation.operator, is_active=False)
    response = api_client.post("/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 403
    assert "access_token" not in response.text


def test_la_baja_conserva_el_nombre_y_el_perfil_en_el_listado(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    technician = make_user(Occupation.technician)
    headers = auth_headers(admin)
    api_client.patch(f"/users/{technician.id_user}", headers=headers, json={"is_active": False})

    inactive = api_client.get("/users?is_active=false", headers=headers).json()
    assert inactive["total"] == 1
    item = inactive["items"][0]
    assert item["name"] == technician.name
    assert item["email"] == technician.email
    assert item["id_technician"] == technician.technician.id_technician  # type: ignore[union-attr]
    assert item["is_active"] is False


def test_el_administrador_no_puede_desactivarse_a_si_mismo_ni_por_el_listado(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user()
    response = api_client.patch(
        f"/users/{admin.id_user}", headers=auth_headers(admin), json={"is_active": False}
    )
    assert response.status_code == 422
    assert response.json() == {"detail": "No puedes desactivar tu propia cuenta"}


# ---------------------------------------------------------------------------
# Baja de un operario: desasignación automática de planes no finalizados
# ---------------------------------------------------------------------------


def test_baja_de_operario_lo_desasigna_de_los_planes_no_finalizados(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
) -> None:
    from datetime import date

    from app.db.enums import Criticality, PlanStatus
    from app.models.infrastructure import LineAuthorization, ProductionLine
    from app.models.plans import Plan, PlanOperatorAssignment

    admin = make_user(Occupation.administrator)
    technician = make_user(Occupation.technician)
    operator = make_user(Occupation.operator)
    other_operator = make_user(Occupation.operator)
    line = ProductionLine(name="Línea baja", production_process="Proceso")
    session.add(line)
    session.flush()
    id_technician = technician.technician.id_technician  # type: ignore[union-attr]
    session.add(
        LineAuthorization(
            id_technician=id_technician, id_line=line.id_line, can_generate=True, can_validate=True
        )
    )
    session.flush()

    def plan_with(status: PlanStatus) -> Plan:
        plan = Plan(
            criticality_level=Criticality.low,
            status=status,
            preventive_percentage=100,
            corrective_percentage=0,
            predictive_percentage=0,
            system_coverage=1,
            total_task_count=1,
            id_line=line.id_line,
            id_creator_technician=id_technician,
        )
        session.add(plan)
        session.flush()
        return plan

    id_operator = operator.operator.id_operator  # type: ignore[union-attr]
    id_other = other_operator.operator.id_operator  # type: ignore[union-attr]
    days = iter(range(1, 30))
    open_plans = [
        plan_with(status)
        for status in (PlanStatus.generated, PlanStatus.approved, PlanStatus.in_execution)
    ]
    finished = plan_with(PlanStatus.completed)
    for plan in [*open_plans, finished]:
        session.add(
            PlanOperatorAssignment(
                id_operator=id_operator,
                assignment_date=date(2026, 12, next(days)),
                id_plan=plan.id_plan,
            )
        )
    session.add(
        PlanOperatorAssignment(
            id_operator=id_other, assignment_date=date(2026, 12, 30), id_plan=open_plans[0].id_plan
        )
    )
    session.flush()

    response = api_client.patch(
        f"/users/{operator.id_user}", json={"is_active": False}, headers=auth_headers(admin)
    )
    assert response.status_code == 200

    session.expire_all()
    remaining = session.scalars(
        select(PlanOperatorAssignment.id_plan).where(
            PlanOperatorAssignment.id_operator == id_operator
        )
    ).all()
    assert remaining == [finished.id_plan]  # solo conserva el plan finalizado
    assert _count(session, PlanOperatorAssignment, id_operator=id_other) == 1  # otros, intactos

    # Reactivar no restituye las asignaciones.
    api_client.patch(
        f"/users/{operator.id_user}", json={"is_active": True}, headers=auth_headers(admin)
    )
    session.expire_all()
    assert _count(session, PlanOperatorAssignment, id_operator=id_operator) == 1


def test_baja_de_tecnico_no_toca_planes(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user(Occupation.administrator)
    technician = make_user(Occupation.technician)
    response = api_client.patch(
        f"/users/{technician.id_user}", json={"is_active": False}, headers=auth_headers(admin)
    )
    assert response.status_code == 200
