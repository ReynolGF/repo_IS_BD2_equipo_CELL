"""Cada restricción del esquema se viola a propósito y la base de datos debe rechazarla."""

from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import delete, insert, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.enums import (
    Criticality,
    DecisionRevision,
    InterventionResult,
    ManualResult,
    Occupation,
    ReinspectionStatus,
    Shift,
    TaskType,
)
from app.models import (
    Administrator,
    EquipmentLineMembership,
    EquipmentSystem,
    Intervention,
    LineAuthorization,
    Operator,
    Plan,
    PlanOperatorAssignment,
    PlantManager,
    ProductionLine,
    Reinspection,
    Revision,
    Task,
    TaskPlanMembership,
    Technician,
    User,
    Validation,
)

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Ayudas para construir datos
# ---------------------------------------------------------------------------


def _make_user(session: Session, tag: str, occupation: Occupation) -> User:
    user = User(name=tag, email=f"{tag}@test.com", password_hash="hash", occupation=occupation)
    session.add(user)
    session.flush()
    return user


def _make_technician(session: Session, tag: str) -> Technician:
    user = _make_user(session, tag, Occupation.technician)
    technician = Technician(id_user=user.id_user, specialty="mecánica")
    session.add(technician)
    session.flush()
    return technician


def _plan_values(data: SimpleNamespace, **overrides: Any) -> dict[str, Any]:
    """Parámetros válidos de un plan; cada prueba sobrescribe solo lo que quiere romper."""
    values: dict[str, Any] = {
        "criticality_level": Criticality.high,
        "preventive_percentage": 50,
        "corrective_percentage": 30,
        "predictive_percentage": 20,
        "system_coverage": 1,
        "total_task_count": 1,
        "id_line": data.line.id_line,
        "id_creator_technician": data.tech.id_technician,
    }
    values.update(overrides)
    return values


def _make_intervention(session: Session, data: SimpleNamespace) -> Intervention:
    intervention = Intervention(
        result=InterventionResult.fulfilled,
        id_plan=data.plan.id_plan,
        id_task=data.task.id_task,
        id_operator=data.operator.id_operator,
    )
    session.add(intervention)
    session.flush()
    return intervention


def _make_manager(session: Session) -> PlantManager:
    user = _make_user(session, "manager", Occupation.plant_manager)
    manager = PlantManager(id_user=user.id_user)
    session.add(manager)
    session.flush()
    return manager


@pytest.fixture
def data(session: Session) -> SimpleNamespace:
    """Grafo mínimo válido: línea, equipo, técnico autorizado, plan con una tarea y operario."""
    line = ProductionLine(name="Línea 1", production_process="Embotellado")
    equipment = EquipmentSystem(name="Bomba")
    session.add_all([line, equipment])
    session.flush()
    session.add(EquipmentLineMembership(id_line=line.id_line, id_equipment=equipment.id_equipment))

    tech = _make_technician(session, "tech")
    outsider = _make_technician(session, "outsider")  # sin autorización en la línea
    session.add(
        LineAuthorization(
            id_technician=tech.id_technician,
            id_line=line.id_line,
            can_generate=True,
            can_validate=True,
        )
    )

    task = Task(
        description="Revisar rodamientos",
        type=TaskType.preventive,
        criticality_level=Criticality.high,
        id_equipment=equipment.id_equipment,
        id_creator_technician=tech.id_technician,
    )
    other_task = Task(
        description="Cambiar sello",
        type=TaskType.corrective,
        criticality_level=Criticality.low,
        id_equipment=equipment.id_equipment,
        id_creator_technician=tech.id_technician,
    )
    session.add_all([task, other_task])
    session.flush()

    namespace = SimpleNamespace(
        line=line, equipment=equipment, tech=tech, outsider=outsider, task=task,
        other_task=other_task,
    )  # fmt: skip
    plan = Plan(**_plan_values(namespace))
    session.add(plan)
    session.flush()
    session.add(TaskPlanMembership(id_plan=plan.id_plan, id_task=task.id_task))

    operator_user = _make_user(session, "operator", Occupation.operator)
    operator = Operator(id_user=operator_user.id_user, age=30, shift=Shift.morning)
    session.add(operator)
    session.flush()

    namespace.plan = plan
    namespace.operator = operator
    return namespace


# ---------------------------------------------------------------------------
# Unicidad
# ---------------------------------------------------------------------------


def test_email_duplicado_es_rechazado(session: Session, data: SimpleNamespace) -> None:
    session.add(
        User(
            name="otro",
            email="tech@test.com",
            password_hash="hash",
            occupation=Occupation.administrator,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_tarea_duplicada_es_rechazada(session: Session, data: SimpleNamespace) -> None:
    session.add(
        Task(
            description=data.task.description,
            type=data.task.type,
            criticality_level=Criticality.low,
            id_equipment=data.equipment.id_equipment,
            id_creator_technician=data.tech.id_technician,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_mismo_operario_no_recibe_dos_planes_en_una_fecha(
    session: Session, data: SimpleNamespace
) -> None:
    values = {
        "id_operator": data.operator.id_operator,
        "assignment_date": date(2026, 1, 15),
        "id_plan": data.plan.id_plan,
    }
    session.execute(insert(PlanOperatorAssignment).values(**values))
    with pytest.raises(IntegrityError):
        session.execute(insert(PlanOperatorAssignment).values(**values))


def test_una_revision_origina_como_maximo_un_plan(session: Session, data: SimpleNamespace) -> None:
    manager = _make_manager(session)
    revision = Revision(
        decision=DecisionRevision.request_new_plan,
        new_generation_criteria="Priorizar tareas de alta criticidad",
        id_manager=manager.id_manager,
        id_plan=data.plan.id_plan,
    )
    session.add(revision)
    session.flush()

    session.add(Plan(**_plan_values(data, id_origin_revision=revision.id_revision)))
    session.flush()  # el primer plan nuevo sí es válido

    session.add(Plan(**_plan_values(data, id_origin_revision=revision.id_revision)))
    with pytest.raises(IntegrityError):
        session.flush()


# ---------------------------------------------------------------------------
# Dominio (CHECK)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "overrides",
    [
        {"corrective_percentage": 40},  # suma 110
        {"corrective_percentage": 28},  # suma 98: fuera de la tolerancia
        {"corrective_percentage": 32},  # suma 102: fuera de la tolerancia
        {"preventive_percentage": -10, "corrective_percentage": 90},  # suma 100 pero negativo
        {"system_coverage": 0},  # un plan cubre al menos un sistema
        {"system_coverage": 2},  # más sistemas que tareas (total_task_count es 1)
        {"total_task_count": 0},
    ],
)
def test_plan_con_parametros_invalidos_es_rechazado(
    session: Session, data: SimpleNamespace, overrides: dict[str, int]
) -> None:
    session.add(Plan(**_plan_values(data, **overrides)))
    with pytest.raises(IntegrityError):
        session.flush()


@pytest.mark.parametrize("corrective", [29, 31])  # suma 99 y 101: dentro de la tolerancia
def test_plan_con_suma_de_porcentajes_dentro_de_la_tolerancia_es_aceptado(
    session: Session, data: SimpleNamespace, corrective: int
) -> None:
    session.add(Plan(**_plan_values(data, corrective_percentage=corrective)))
    session.flush()


def test_operario_con_edad_cero_es_rechazado(session: Session, data: SimpleNamespace) -> None:
    user = _make_user(session, "young", Occupation.operator)
    session.add(Operator(id_user=user.id_user, age=0, shift=Shift.night))
    with pytest.raises(IntegrityError):
        session.flush()


def test_valor_fuera_del_enum_es_rechazado(session: Session, data: SimpleNamespace) -> None:
    with pytest.raises(IntegrityError):
        session.execute(
            text("UPDATE plan SET status = 'inventado' WHERE id_plan = :id"),
            {"id": data.plan.id_plan},
        )


def test_autorizacion_sin_ningun_permiso_es_rechazada(
    session: Session, data: SimpleNamespace
) -> None:
    session.add(
        LineAuthorization(
            id_technician=data.outsider.id_technician,
            id_line=data.line.id_line,
            can_generate=False,
            can_validate=False,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


# ---------------------------------------------------------------------------
# Claves foráneas compuestas (reglas de negocio impuestas por la base de datos)
# ---------------------------------------------------------------------------


def test_tecnico_sin_autorizacion_no_puede_crear_plan_en_la_linea(
    session: Session, data: SimpleNamespace
) -> None:
    session.add(Plan(**_plan_values(data, id_creator_technician=data.outsider.id_technician)))
    with pytest.raises(IntegrityError):
        session.flush()


def test_intervencion_sobre_tarea_del_plan_es_valida(
    session: Session, data: SimpleNamespace
) -> None:
    _make_intervention(session, data)  # no debe lanzar


def test_intervencion_sobre_tarea_ajena_al_plan_es_rechazada(
    session: Session, data: SimpleNamespace
) -> None:
    session.add(
        Intervention(
            result=InterventionResult.partial,
            id_plan=data.plan.id_plan,
            id_task=data.other_task.id_task,  # existe, pero no está en el plan
            id_operator=data.operator.id_operator,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


# ---------------------------------------------------------------------------
# Revisión y reinspección: consistencia entre columnas
# ---------------------------------------------------------------------------


def test_revision_que_pide_nuevo_plan_exige_criterios(
    session: Session, data: SimpleNamespace
) -> None:
    manager = _make_manager(session)
    session.add(
        Revision(
            decision=DecisionRevision.request_new_plan,
            id_manager=manager.id_manager,
            id_plan=data.plan.id_plan,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_revision_que_aprueba_no_admite_criterios(session: Session, data: SimpleNamespace) -> None:
    manager = _make_manager(session)
    session.add(
        Revision(
            decision=DecisionRevision.approve,
            new_generation_criteria="no deberían estar aquí",
            id_manager=manager.id_manager,
            id_plan=data.plan.id_plan,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_reinspeccion_pendiente_es_valida(session: Session, data: SimpleNamespace) -> None:
    intervention = _make_intervention(session, data)
    session.add(Reinspection(reason="Lectura dudosa", id_intervention=intervention.id_intervention))
    session.flush()  # no debe lanzar


def test_reinspeccion_atendida_completa_es_valida(session: Session, data: SimpleNamespace) -> None:
    intervention = _make_intervention(session, data)
    session.add(
        Reinspection(
            reason="Lectura dudosa",
            status=ReinspectionStatus.attended,
            manual_result=ManualResult.confirmed,
            resolution_date=datetime.now(UTC),
            id_resolver_technician=data.tech.id_technician,
            id_intervention=intervention.id_intervention,
        )
    )
    session.flush()  # no debe lanzar


def test_reinspeccion_atendida_sin_resolutor_es_rechazada(
    session: Session, data: SimpleNamespace
) -> None:
    intervention = _make_intervention(session, data)
    session.add(
        Reinspection(
            reason="Lectura dudosa",
            status=ReinspectionStatus.attended,
            id_intervention=intervention.id_intervention,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


def test_reinspeccion_pendiente_con_resolutor_es_rechazada(
    session: Session, data: SimpleNamespace
) -> None:
    intervention = _make_intervention(session, data)
    session.add(
        Reinspection(
            reason="Lectura dudosa",
            id_resolver_technician=data.tech.id_technician,
            id_intervention=intervention.id_intervention,
        )
    )
    with pytest.raises(IntegrityError):
        session.flush()


# ---------------------------------------------------------------------------
# Borrados (ON DELETE RESTRICT)
# ---------------------------------------------------------------------------


def _technician_with_one_dependency(
    session: Session, data: SimpleNamespace, kind: str
) -> Technician:
    """Crea un técnico que solo tiene UNA dependencia, del tipo indicado."""
    technician = _make_technician(session, f"solo_{kind}")
    if kind == "task":
        session.add(
            Task(
                description="Tarea propia",
                type=TaskType.predictive,
                criticality_level=Criticality.medium,
                id_equipment=data.equipment.id_equipment,
                id_creator_technician=technician.id_technician,
            )
        )
    elif kind == "validation":
        session.add(Validation(id_plan=data.plan.id_plan, id_technician=technician.id_technician))
    elif kind == "authorization":
        session.add(
            LineAuthorization(
                id_technician=technician.id_technician,
                id_line=data.line.id_line,
                can_validate=True,
            )
        )
    elif kind == "reinspection_support":
        intervention = _make_intervention(session, data)
        session.add(
            Reinspection(
                reason="Apoyo",
                id_intervention=intervention.id_intervention,
                id_additional_technician=technician.id_technician,
            )
        )
    elif kind == "reinspection_resolver":
        intervention = _make_intervention(session, data)
        session.add(
            Reinspection(
                reason="Resuelta",
                status=ReinspectionStatus.attended,
                manual_result=ManualResult.confirmed,
                resolution_date=datetime.now(UTC),
                id_resolver_technician=technician.id_technician,
                id_intervention=intervention.id_intervention,
            )
        )
    session.flush()
    return technician


@pytest.mark.parametrize(
    "kind",
    ["task", "validation", "authorization", "reinspection_support", "reinspection_resolver"],
)
def test_no_se_puede_borrar_un_tecnico_con_una_sola_dependencia(
    session: Session, data: SimpleNamespace, kind: str
) -> None:
    technician = _technician_with_one_dependency(session, data, kind)
    with pytest.raises(IntegrityError):
        session.execute(
            delete(Technician).where(Technician.id_technician == technician.id_technician)
        )


def test_no_se_puede_borrar_el_tecnico_creador_de_un_plan(
    session: Session, data: SimpleNamespace
) -> None:
    with pytest.raises(IntegrityError):
        session.execute(
            delete(Technician).where(Technician.id_technician == data.tech.id_technician)
        )


def test_se_puede_borrar_un_tecnico_sin_dependencias(
    session: Session, data: SimpleNamespace
) -> None:
    technician = _make_technician(session, "libre")
    result = session.execute(
        delete(Technician).where(Technician.id_technician == technician.id_technician)
    )
    assert result.rowcount == 1  # type: ignore[attr-defined]


def test_un_usuario_nuevo_esta_activo_por_defecto(session: Session, data: SimpleNamespace) -> None:
    session.refresh(data.tech.user)
    assert data.tech.user.is_active is True


def test_desactivar_un_tecnico_con_historial_conserva_todo(
    session: Session, data: SimpleNamespace
) -> None:
    """La baja lógica no toca ninguna fila relacionada, a diferencia del borrado."""
    intervention = _make_intervention(session, data)
    session.add(Validation(id_plan=data.plan.id_plan, id_technician=data.tech.id_technician))
    session.flush()

    session.execute(update(User).where(User.id_user == data.tech.id_user).values(is_active=False))

    session.expire_all()
    technician = session.get(Technician, data.tech.id_technician)
    assert technician is not None
    assert technician.id_user == data.tech.id_user  # sigue identificado
    assert technician.user.is_active is False
    assert technician.user.name == "tech"  # los reportes siguen mostrando su nombre
    assert session.get(Plan, data.plan.id_plan) is not None
    assert session.get(Task, data.task.id_task) is not None
    assert session.get(Intervention, intervention.id_intervention) is not None


def test_is_active_no_admite_nulos(session: Session, data: SimpleNamespace) -> None:
    with pytest.raises(IntegrityError):
        session.execute(
            update(User).where(User.id_user == data.tech.id_user).values(is_active=None)
        )


def _user_with_profile(session: Session, data: SimpleNamespace, kind: str) -> User:
    """Devuelve un usuario que tiene fila de subtipo del tipo indicado."""
    if kind == "technician":
        return data.tech.user
    if kind == "operator":
        return data.operator.user
    if kind == "plant_manager":
        return _make_manager(session).user
    admin_user = _make_user(session, "admin", Occupation.administrator)
    session.add(Administrator(id_user=admin_user.id_user))
    session.flush()
    return admin_user


@pytest.mark.parametrize("kind", ["technician", "operator", "plant_manager", "administrator"])
def test_no_se_puede_borrar_un_usuario_que_tiene_perfil(
    session: Session, data: SimpleNamespace, kind: str
) -> None:
    """Los usuarios no se eliminan: se desactivan con is_active para conservar el historial."""
    user = _user_with_profile(session, data, kind)
    with pytest.raises(IntegrityError):
        session.execute(delete(User).where(User.id_user == user.id_user))


@pytest.mark.parametrize("subtype", [Technician, Operator, PlantManager, Administrator])
def test_el_subtipo_exige_un_usuario(
    session: Session, data: SimpleNamespace, subtype: type
) -> None:
    """``id_user`` es obligatorio: no hay perfiles (técnico, operario...) sin cuenta."""
    values: dict[str, object] = {}
    if subtype is Technician:
        values["specialty"] = "mecánica"
    if subtype is Operator:
        values.update(age=30, shift=Shift.morning)
    with pytest.raises(IntegrityError):
        session.execute(insert(subtype).values(**values))


def test_un_usuario_sigue_sin_poder_compartir_subtipo(
    session: Session, data: SimpleNamespace
) -> None:
    """Un mismo usuario no puede tener dos técnicos (UNIQUE de id_user)."""
    session.add(Technician(id_user=data.tech.id_user, specialty="eléctrica"))
    with pytest.raises(IntegrityError):
        session.flush()


def test_un_usuario_inactivo_conserva_su_perfil_y_su_nombre(
    session: Session, data: SimpleNamespace
) -> None:
    """Dar de baja es la forma de «eliminar» a alguien: no se pierde ningún dato."""
    session.execute(update(User).where(User.id_user == data.tech.id_user).values(is_active=False))
    session.expire_all()
    user = session.get(User, data.tech.id_user)
    assert user is not None
    assert user.is_active is False
    assert user.name == "tech"
    assert user.technician is not None
    assert user.technician.id_technician == data.tech.id_technician


def test_no_se_puede_borrar_una_linea_con_equipos_planes_o_autorizaciones(
    session: Session, data: SimpleNamespace
) -> None:
    with pytest.raises(IntegrityError):
        session.execute(delete(ProductionLine).where(ProductionLine.id_line == data.line.id_line))


def test_no_se_puede_borrar_un_plan_que_aun_tiene_tareas_asociadas(
    session: Session, data: SimpleNamespace
) -> None:
    with pytest.raises(IntegrityError):
        session.execute(delete(Plan).where(Plan.id_plan == data.plan.id_plan))


def test_un_plan_sin_historial_se_borra_tras_quitar_sus_asociaciones(
    session: Session, data: SimpleNamespace
) -> None:
    session.execute(
        delete(TaskPlanMembership).where(TaskPlanMembership.id_plan == data.plan.id_plan)
    )
    result = session.execute(delete(Plan).where(Plan.id_plan == data.plan.id_plan))
    assert result.rowcount == 1  # type: ignore[attr-defined]


def test_no_se_puede_borrar_un_plan_con_intervenciones(
    session: Session, data: SimpleNamespace
) -> None:
    _make_intervention(session, data)
    with pytest.raises(IntegrityError):
        session.execute(delete(Plan).where(Plan.id_plan == data.plan.id_plan))


def test_no_se_puede_borrar_una_intervencion_con_reinspecciones(
    session: Session, data: SimpleNamespace
) -> None:
    intervention = _make_intervention(session, data)
    session.add(Reinspection(reason="Lectura dudosa", id_intervention=intervention.id_intervention))
    session.flush()
    with pytest.raises(IntegrityError):
        session.execute(
            delete(Intervention).where(Intervention.id_intervention == intervention.id_intervention)
        )
