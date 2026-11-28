from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.enums import Criticality, Occupation, TaskType
from app.models.infrastructure import EquipmentSystem, ProductionLine
from app.models.tasks import Task
from app.models.users import User

pytestmark = pytest.mark.integration

MakeUser = Callable[..., User]
Headers = Callable[[User], dict[str, str]]


def _equipment(session: Session, name: str = "Bomba") -> EquipmentSystem:
    equipment = EquipmentSystem(name=name)
    session.add(equipment)
    session.flush()
    return equipment


def _line_body(**overrides: Any) -> dict[str, Any]:
    body = {"name": "Línea 7", "production_process": "Envasado"}
    body.update(overrides)
    return body


# ---------------------------------------------------------------------------
# Líneas (RF1, RF3)
# ---------------------------------------------------------------------------


def test_admin_crea_linea_y_se_consulta_con_sus_equipos(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user(Occupation.administrator)
    technician = make_user(Occupation.technician)
    created = api_client.post("/lines", json=_line_body(), headers=auth_headers(admin))
    assert created.status_code == 201
    id_line = created.json()["id_line"]
    assert created.json()["equipment"] == []
    equipment = _equipment(session)

    link = api_client.put(
        f"/lines/{id_line}/equipment/{equipment.id_equipment}", headers=auth_headers(admin)
    )
    assert link.status_code == 200

    # Cualquier usuario autenticado puede consultar.
    detail = api_client.get(f"/lines/{id_line}", headers=auth_headers(technician))
    assert detail.status_code == 200
    assert [e["id_equipment"] for e in detail.json()["equipment"]] == [equipment.id_equipment]
    listing = api_client.get("/lines", headers=auth_headers(technician))
    assert listing.status_code == 200
    assert any(item["id_line"] == id_line for item in listing.json()["items"])


def test_crear_linea_exige_ser_administrador(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    assert api_client.post("/lines", json=_line_body()).status_code == 401
    technician = make_user(Occupation.technician)
    response = api_client.post("/lines", json=_line_body(), headers=auth_headers(technician))
    assert response.status_code == 403


def test_nombre_de_linea_duplicado_sin_distinguir_mayusculas(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    admin = make_user(Occupation.administrator)
    headers = auth_headers(admin)
    assert api_client.post("/lines", json=_line_body(), headers=headers).status_code == 201
    duplicate = api_client.post("/lines", json=_line_body(name="LÍNEA 7"), headers=headers)
    assert duplicate.status_code == 409


def test_modificar_linea(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    admin = make_user(Occupation.administrator)
    headers = auth_headers(admin)
    ok = api_client.patch(
        f"/lines/{line.id_line}", json={"production_process": "Etiquetado"}, headers=headers
    )
    assert ok.status_code == 200
    assert ok.json()["production_process"] == "Etiquetado"
    assert api_client.patch(f"/lines/{line.id_line}", json={}, headers=headers).status_code == 422
    nulled = api_client.patch(f"/lines/{line.id_line}", json={"name": None}, headers=headers)
    assert nulled.status_code == 422
    assert api_client.get("/lines/999999", headers=headers).status_code == 404


def test_renombrar_a_nombre_de_otra_linea_da_409(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user(Occupation.administrator)
    other = ProductionLine(name="Línea 2", production_process="Otro")
    session.add(other)
    session.flush()
    response = api_client.patch(
        f"/lines/{other.id_line}", json={"name": line.name}, headers=auth_headers(admin)
    )
    assert response.status_code == 409


def test_eliminar_linea_vacia_si_y_con_equipos_no(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user(Occupation.administrator)
    headers = auth_headers(admin)
    equipment = _equipment(session)
    api_client.put(f"/lines/{line.id_line}/equipment/{equipment.id_equipment}", headers=headers)

    blocked = api_client.delete(f"/lines/{line.id_line}", headers=headers)
    assert blocked.status_code == 409

    api_client.delete(f"/lines/{line.id_line}/equipment/{equipment.id_equipment}", headers=headers)
    assert api_client.delete(f"/lines/{line.id_line}", headers=headers).status_code == 204
    assert api_client.get(f"/lines/{line.id_line}", headers=headers).status_code == 404


# ---------------------------------------------------------------------------
# Equipos y estado operativo (RF2, RF41)
# ---------------------------------------------------------------------------


def test_crear_equipo_asociarlo_y_filtrar_por_linea(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user(Occupation.administrator)
    headers = auth_headers(admin)
    created = api_client.post(
        "/equipment", json={"name": "  Compresor ", "description": "Principal"}, headers=headers
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Compresor"
    assert body["operational_status"] == "operational"
    assert body["line_ids"] == []
    _equipment(session, "Suelto")  # no asociado a la línea

    api_client.put(f"/lines/{line.id_line}/equipment/{body['id_equipment']}", headers=headers)
    listing = api_client.get(f"/equipment?id_line={line.id_line}", headers=headers)
    assert [item["id_equipment"] for item in listing.json()["items"]] == [body["id_equipment"]]
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["line_ids"] == [line.id_line]
    assert api_client.get("/equipment?id_line=999999", headers=headers).status_code == 404


def test_asociar_equipo_es_idempotente_y_quitarlo_dos_veces_da_404(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    headers = auth_headers(make_user(Occupation.administrator))
    equipment = _equipment(session)
    url = f"/lines/{line.id_line}/equipment/{equipment.id_equipment}"
    assert api_client.put(url, headers=headers).status_code == 200
    assert api_client.put(url, headers=headers).status_code == 200
    assert api_client.delete(url, headers=headers).status_code == 204
    assert api_client.delete(url, headers=headers).status_code == 404
    missing = api_client.put(f"/lines/{line.id_line}/equipment/999999", headers=headers)
    assert missing.status_code == 404


def test_tecnico_cambia_el_estado_operativo_y_la_fecha_solo_si_cambia(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    technician = make_user(Occupation.technician)
    headers = auth_headers(technician)
    equipment = _equipment(session)
    url = f"/equipment/{equipment.id_equipment}/status"

    first = api_client.put(url, json={"operational_status": "faulty"}, headers=headers)
    assert first.status_code == 200
    assert first.json()["operational_status"] == "faulty"
    again = api_client.put(url, json={"operational_status": "faulty"}, headers=headers)
    assert again.json()["status_date"] == first.json()["status_date"]
    back = api_client.put(url, json={"operational_status": "operational"}, headers=headers)
    assert back.json()["status_date"] >= first.json()["status_date"]
    invalid = api_client.put(url, json={"operational_status": "roto"}, headers=headers)
    assert invalid.status_code == 422


def test_operario_y_jefe_no_cambian_el_estado_pero_si_lo_consultan(
    api_client: TestClient, session: Session, make_user: MakeUser, auth_headers: Headers
) -> None:
    equipment = _equipment(session)
    url = f"/equipment/{equipment.id_equipment}"
    for occupation in (Occupation.operator, Occupation.plant_manager):
        user = make_user(occupation)
        changed = api_client.put(
            f"{url}/status", json={"operational_status": "stopped"}, headers=auth_headers(user)
        )
        assert changed.status_code == 403
        assert api_client.get(url, headers=auth_headers(user)).status_code == 200


def test_modificar_y_borrar_equipo(
    api_client: TestClient,
    session: Session,
    make_user: MakeUser,
    auth_headers: Headers,
) -> None:
    admin = make_user(Occupation.administrator)
    technician = make_user(Occupation.technician)
    headers = auth_headers(admin)
    equipment = _equipment(session)
    url = f"/equipment/{equipment.id_equipment}"

    renamed = api_client.patch(url, json={"name": "Bomba 2", "description": "x"}, headers=headers)
    assert renamed.json()["name"] == "Bomba 2"
    cleared = api_client.patch(url, json={"description": None}, headers=headers)
    assert cleared.json()["description"] is None

    session.add(
        Task(
            description="Revisar",
            type=TaskType.preventive,
            criticality_level=Criticality.low,
            id_equipment=equipment.id_equipment,
            id_creator_technician=technician.technician.id_technician,  # type: ignore[union-attr]
        )
    )
    session.flush()
    assert api_client.delete(url, headers=headers).status_code == 409

    free = _equipment(session, "Libre")
    assert api_client.delete(f"/equipment/{free.id_equipment}", headers=headers).status_code == 204


# ---------------------------------------------------------------------------
# Operarios asignados a líneas (RF37)
# ---------------------------------------------------------------------------


def test_asignar_operario_a_linea_y_consultarlo(
    api_client: TestClient,
    make_user: MakeUser,
    auth_headers: Headers,
    line: ProductionLine,
) -> None:
    admin = make_user(Occupation.administrator)
    manager = make_user(Occupation.plant_manager)
    operator = make_user(Occupation.operator)
    id_operator = operator.operator.id_operator  # type: ignore[union-attr]
    url = f"/lines/{line.id_line}/operators/{id_operator}"

    assert api_client.put(url, headers=auth_headers(admin)).status_code == 200
    assert api_client.put(url, headers=auth_headers(admin)).status_code == 200  # idempotente

    operators = api_client.get(f"/lines/{line.id_line}/operators", headers=auth_headers(manager))
    assert operators.status_code == 200
    assert [o["id_operator"] for o in operators.json()] == [id_operator]
    assert operators.json()[0]["shift"] == "morning"

    mine = api_client.get("/operators/me/lines", headers=auth_headers(operator))
    assert [item["id_line"] for item in mine.json()] == [line.id_line]
    theirs = api_client.get(f"/operators/{id_operator}/lines", headers=auth_headers(admin))
    assert [item["id_line"] for item in theirs.json()] == [line.id_line]

    assert api_client.delete(url, headers=auth_headers(admin)).status_code == 204
    assert api_client.delete(url, headers=auth_headers(admin)).status_code == 404
    after = api_client.get("/operators/me/lines", headers=auth_headers(operator))
    assert after.json() == []


def test_solo_el_administrador_asigna_operarios(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    operator = make_user(Occupation.operator)
    url = f"/lines/{line.id_line}/operators/{operator.operator.id_operator}"  # type: ignore[union-attr]
    for occupation in (Occupation.operator, Occupation.technician, Occupation.plant_manager):
        user = make_user(occupation)
        assert api_client.put(url, headers=auth_headers(user)).status_code == 403


def test_no_se_asigna_un_operario_desactivado_ni_inexistente(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers, line: ProductionLine
) -> None:
    admin = make_user(Occupation.administrator)
    inactive = make_user(Occupation.operator, is_active=False)
    id_operator = inactive.operator.id_operator  # type: ignore[union-attr]
    response = api_client.put(
        f"/lines/{line.id_line}/operators/{id_operator}", headers=auth_headers(admin)
    )
    assert response.status_code == 422
    missing = api_client.put(f"/lines/{line.id_line}/operators/999999", headers=auth_headers(admin))
    assert missing.status_code == 404


def test_un_usuario_desactivado_no_usa_los_endpoints_de_fase_3(
    api_client: TestClient, make_user: MakeUser, auth_headers: Headers
) -> None:
    inactive = make_user(Occupation.administrator, is_active=False)
    response = api_client.post("/lines", json=_line_body(), headers=auth_headers(inactive))
    assert response.status_code == 401
