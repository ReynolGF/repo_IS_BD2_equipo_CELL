from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.enums import Criticality, Occupation
from app.models.infrastructure import (
    EquipmentLineMembership,
    EquipmentSystem,
    LineAuthorization,
    ProductionLine,
)
from app.models.plans import Plan, TaskPlanMembership
from app.models.users import User

pytestmark = pytest.mark.integration

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _tech_id(user: User) -> int:
    return user.technician.id_technician  # type: ignore[union-attr]


def _equipment(session: Session, line: ProductionLine | None = None) -> EquipmentSystem:
    equipment = EquipmentSystem(name="Bomba")
    session.add(equipment)
    session.flush()
    if line is not None:
        session.add(
            EquipmentLineMembership(id_line=line.id_line, id_equipment=equipment.id_equipment)
        )
        session.flush()
    return equipment


def _authorize(session: Session, user: User, line: ProductionLine) -> None:
    session.add(
        LineAuthorization(
            id_technician=_tech_id(user),
            id_line=line.id_line,
            can_generate=True,
            can_validate=False,
        )
    )
    session.flush()


def _body(equipment: EquipmentSystem, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "description": "Revisar rodamiento",
        "type": "preventive",
        "criticality_level": "high",
        "id_equipment": equipment.id_equipment,
    }
    body.update(overrides)
    return body


def _create(
    client: TestClient, headers: dict[str, str], equipment: EquipmentSystem, **overrides: Any
) -> dict[str, Any]:
    response = client.post("/tasks", json=_body(equipment, **overrides), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# Crear (RF4, RF5, RF6)
# ---------------------------------------------------------------------------


def test_tecnico_crea_tarea_a_su_nombre(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    technician = make_user(Occupation.technician)
    equipment = _equipment(session)
    task = _create(
        api_client, auth_headers(technician), equipment, description="  Revisar   rodamiento "
    )
    assert task["description"] == "Revisar rodamiento"
    assert task["type"] == "preventive"
    assert task["criticality_level"] == "high"
    assert task["id_equipment"] == equipment.id_equipment
    assert task["equipment_name"] == "Bomba"
    assert task["id_creator_technician"] == _tech_id(technician)
    assert task["creator_name"] == technician.name


@pytest.mark.parametrize(
    "occupation", [Occupation.operator, Occupation.plant_manager, Occupation.administrator]
)
def test_solo_los_tecnicos_crean_tareas(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    occupation: Occupation,
) -> None:
    equipment = _equipment(session)
    response = api_client.post(
        "/tasks", json=_body(equipment), headers=auth_headers(make_user(occupation))
    )
    assert response.status_code == 403
    assert api_client.post("/tasks", json=_body(equipment)).status_code == 401


def test_tarea_con_equipo_inexistente_o_datos_invalidos(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    headers = auth_headers(make_user(Occupation.technician))
    equipment = _equipment(session)
    missing = api_client.post("/tasks", json=_body(equipment, id_equipment=999999), headers=headers)
    assert missing.status_code == 404
    for bad in ({"description": "ab"}, {"type": "otro"}, {"criticality_level": "extrema"}):
        response = api_client.post("/tasks", json=_body(equipment, **bad), headers=headers)
        assert response.status_code == 422


def test_duplicado_literal_y_semantico_da_409(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    first = make_user(Occupation.technician)
    second = make_user(Occupation.technician)
    equipment = _equipment(session)
    _create(api_client, auth_headers(first), equipment, description="Revisar rodamiento")

    for variant in ("Revisar rodamiento", "  REVISAR   rodamiento ", "Revisár rodamiento"):
        # Aunque lo cree otro técnico, es la misma tarea (mismo equipo, tipo y descripción).
        response = api_client.post(
            "/tasks",
            json=_body(equipment, description=variant),
            headers=auth_headers(second),
        )
        assert response.status_code == 409, variant


def test_misma_descripcion_en_otro_tipo_o_equipo_no_es_duplicado(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    headers = auth_headers(make_user(Occupation.technician))
    equipment = _equipment(session)
    other_equipment = _equipment(session)
    _create(api_client, headers, equipment)
    _create(api_client, headers, equipment, type="corrective")
    _create(api_client, headers, other_equipment)


# ---------------------------------------------------------------------------
# Gestionar las propias (RF7)
# ---------------------------------------------------------------------------


def test_listar_solo_las_propias_con_filtros(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    mine = make_user(Occupation.technician)
    other = make_user(Occupation.technician)
    equipment = _equipment(session)
    _create(api_client, auth_headers(mine), equipment, description="Tarea uno")
    _create(api_client, auth_headers(mine), equipment, description="Tarea dos", type="corrective")
    _create(api_client, auth_headers(other), equipment, description="Ajena")

    listing = api_client.get("/tasks", headers=auth_headers(mine)).json()
    assert listing["total"] == 2
    assert {t["description"] for t in listing["items"]} == {"Tarea uno", "Tarea dos"}
    corrective = api_client.get("/tasks?type=corrective", headers=auth_headers(mine)).json()
    assert [t["description"] for t in corrective["items"]] == ["Tarea dos"]
    searched = api_client.get("/tasks?q=uno", headers=auth_headers(mine)).json()
    assert searched["total"] == 1
    paged = api_client.get("/tasks?limit=1&offset=1", headers=auth_headers(mine)).json()
    assert paged["total"] == 2
    assert len(paged["items"]) == 1


def test_modificar_tarea_propia(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    headers = auth_headers(make_user(Occupation.technician))
    equipment = _equipment(session)
    task = _create(api_client, headers, equipment)
    url = f"/tasks/{task['id_task']}"

    changed = api_client.patch(
        url, json={"criticality_level": "low", "description": "Cambiar rodamiento"}, headers=headers
    )
    assert changed.status_code == 200
    assert changed.json()["criticality_level"] == "low"
    assert changed.json()["description"] == "Cambiar rodamiento"
    # Reenviar su propia descripción no cuenta como duplicado de sí misma.
    same = api_client.patch(url, json={"description": "cambiar rodamiento"}, headers=headers)
    assert same.status_code == 200
    assert api_client.patch(url, json={}, headers=headers).status_code == 422
    assert api_client.patch(url, json={"type": None}, headers=headers).status_code == 422
    missing = api_client.patch(url, json={"id_equipment": 999999}, headers=headers)
    assert missing.status_code == 404


def test_modificar_tarea_no_puede_crear_un_duplicado(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    headers = auth_headers(make_user(Occupation.technician))
    equipment = _equipment(session)
    _create(api_client, headers, equipment, description="Tarea A")
    second = _create(api_client, headers, equipment, description="Tarea B")
    response = api_client.patch(
        f"/tasks/{second['id_task']}", json={"description": "tarea a"}, headers=headers
    )
    assert response.status_code == 409


def test_no_se_modifica_ni_elimina_la_tarea_de_otro_tecnico(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    owner = make_user(Occupation.technician)
    other = make_user(Occupation.technician)
    admin = make_user(Occupation.administrator)
    equipment = _equipment(session)
    task = _create(api_client, auth_headers(owner), equipment)
    url = f"/tasks/{task['id_task']}"

    for headers in (auth_headers(other), auth_headers(admin)):
        patch = api_client.patch(url, json={"criticality_level": "low"}, headers=headers)
        assert patch.status_code == 403
        assert api_client.delete(url, headers=headers).status_code == 403
    still = api_client.get(url, headers=auth_headers(owner)).json()
    assert still["criticality_level"] == "high"


def test_eliminar_tarea_propia_y_conflicto_si_esta_en_un_plan(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    technician = make_user(Occupation.technician)
    headers = auth_headers(technician)
    equipment = _equipment(session, line)
    free = _create(api_client, headers, equipment, description="Libre")
    planned = _create(api_client, headers, equipment, description="En plan")

    _authorize(session, technician, line)
    plan = Plan(
        criticality_level=Criticality.high,
        preventive_percentage=100,
        corrective_percentage=0,
        predictive_percentage=0,
        system_coverage=1,
        total_task_count=1,
        id_line=line.id_line,
        id_creator_technician=_tech_id(technician),
    )
    session.add(plan)
    session.flush()
    session.add(TaskPlanMembership(id_plan=plan.id_plan, id_task=planned["id_task"]))
    session.flush()

    assert api_client.delete(f"/tasks/{free['id_task']}", headers=headers).status_code == 204
    assert api_client.get(f"/tasks/{free['id_task']}", headers=headers).status_code == 404
    blocked = api_client.delete(f"/tasks/{planned['id_task']}", headers=headers)
    assert blocked.status_code == 409
    assert api_client.get(f"/tasks/{planned['id_task']}", headers=headers).status_code == 200


# ---------------------------------------------------------------------------
# Tareas de otros técnicos por línea (RF8)
# ---------------------------------------------------------------------------


def test_tecnico_autorizado_ve_las_tareas_de_otros_en_su_linea(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    author = make_user(Occupation.technician)
    reader = make_user(Occupation.technician)
    equipment = _equipment(session, line)
    task = _create(api_client, auth_headers(author), equipment)
    _authorize(session, reader, line)

    listing = api_client.get(f"/lines/{line.id_line}/tasks", headers=auth_headers(reader))
    assert listing.status_code == 200
    assert [t["id_task"] for t in listing.json()["items"]] == [task["id_task"]]
    assert listing.json()["items"][0]["creator_name"] == author.name
    one = api_client.get(f"/tasks/{task['id_task']}", headers=auth_headers(reader))
    assert one.status_code == 200


def test_tecnico_sin_autorizacion_no_ve_tareas_de_otros(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    author = make_user(Occupation.technician)
    outsider = make_user(Occupation.technician)
    equipment = _equipment(session, line)
    task = _create(api_client, auth_headers(author), equipment)

    listing = api_client.get(f"/lines/{line.id_line}/tasks", headers=auth_headers(outsider))
    assert listing.status_code == 403
    one = api_client.get(f"/tasks/{task['id_task']}", headers=auth_headers(outsider))
    assert one.status_code == 403
    # Su propia lista de tareas sigue funcionando y no incluye las ajenas.
    assert api_client.get("/tasks", headers=auth_headers(outsider)).json()["total"] == 0


def test_tareas_de_una_linea_solo_incluyen_sus_equipos_y_admiten_filtros(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    technician = make_user(Occupation.technician)
    manager = make_user(Occupation.plant_manager)
    headers = auth_headers(technician)
    inside = _equipment(session, line)
    outside = _equipment(session)
    _authorize(session, technician, line)
    _create(api_client, headers, inside, description="Dentro preventiva")
    _create(api_client, headers, inside, description="Dentro correctiva", type="corrective")
    _create(api_client, headers, outside, description="Fuera")

    url = f"/lines/{line.id_line}/tasks"
    everything = api_client.get(url, headers=auth_headers(manager)).json()
    assert everything["total"] == 2
    only_corrective = api_client.get(f"{url}?type=corrective", headers=headers).json()
    assert [t["description"] for t in only_corrective["items"]] == ["Dentro correctiva"]
    by_creator = api_client.get(
        f"{url}?id_creator_technician={_tech_id(technician)}", headers=headers
    ).json()
    assert by_creator["total"] == 2
    assert api_client.get("/lines/999999/tasks", headers=auth_headers(manager)).status_code == 404


def test_administrador_y_jefe_ven_cualquier_tarea_y_el_operario_no(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    author = make_user(Occupation.technician)
    equipment = _equipment(session)
    task = _create(api_client, auth_headers(author), equipment)
    url = f"/tasks/{task['id_task']}"

    for occupation in (Occupation.administrator, Occupation.plant_manager):
        user = make_user(occupation)
        assert api_client.get(url, headers=auth_headers(user)).status_code == 200
    operator = make_user(Occupation.operator)
    assert api_client.get(url, headers=auth_headers(operator)).status_code == 403
    assert api_client.get("/tasks/999999", headers=auth_headers(author)).status_code == 404
