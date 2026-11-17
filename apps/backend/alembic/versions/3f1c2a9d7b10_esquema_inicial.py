"""Esquema inicial.

Crea todas las tablas del modelo: usuarios y subtipos, líneas, equipos, autorizaciones,
tareas, planes, revisiones, validaciones, asignaciones, intervenciones y reinspecciones.

Los valores de las enumeraciones se escriben literalmente (no se importan de ``app``) para que
la migración no cambie si luego se modifican los modelos. Todos los nombres de restricciones e
índices están ya expandidos con ``op.f`` y coinciden con la convención de ``app/db/base.py``.

Revision ID: 3f1c2a9d7b10
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3f1c2a9d7b10"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _one_of(column: str, *values: str) -> str:
    """Devuelve la expresión ``column IN ('a', 'b', ...)`` de un CHECK de enumeración."""
    quoted = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({quoted})"


def _fk(
    columns: list[str],
    refs: list[str],
    name: str,
    *,
    cascade_update: bool = False,
) -> sa.ForeignKeyConstraint:
    """Crea una clave foránea ``ON DELETE RESTRICT`` (y ``ON UPDATE CASCADE`` si se pide)."""
    return sa.ForeignKeyConstraint(
        columns,
        refs,
        name=op.f(name),
        ondelete="RESTRICT",
        onupdate="CASCADE" if cascade_update else None,
    )


def _user_fk(table: str) -> sa.ForeignKeyConstraint:
    """Clave foránea ``id_user`` de las tablas de subtipo hacia ``users``."""
    return _fk(["id_user"], ["users.id_user"], f"fk_{table}_id_user_users", cascade_update=True)


def upgrade() -> None:
    """Crea el esquema completo."""
    # --- Usuarios y subtipos ----------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id_user", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("occupation", sa.String(length=13), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.CheckConstraint(
            _one_of("occupation", "technician", "operator", "plant_manager", "administrator"),
            name=op.f("ck_users_occupation"),
        ),
        sa.PrimaryKeyConstraint("id_user", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )

    op.create_table(
        "technician",
        sa.Column("id_technician", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("specialty", sa.String(length=150), nullable=False),
        _user_fk("technician"),
        sa.PrimaryKeyConstraint("id_technician", name=op.f("pk_technician")),
        sa.UniqueConstraint("id_user", name=op.f("uq_technician_id_user")),
    )

    op.create_table(
        "operator",
        sa.Column("id_operator", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("shift", sa.String(length=9), nullable=False),
        sa.CheckConstraint("age > 0", name=op.f("ck_operator_positive_age")),
        sa.CheckConstraint(
            _one_of("shift", "morning", "afternoon", "night"), name=op.f("ck_operator_shift")
        ),
        _user_fk("operator"),
        sa.PrimaryKeyConstraint("id_operator", name=op.f("pk_operator")),
        sa.UniqueConstraint("id_user", name=op.f("uq_operator_id_user")),
    )

    op.create_table(
        "plant_manager",
        sa.Column("id_manager", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        _user_fk("plant_manager"),
        sa.PrimaryKeyConstraint("id_manager", name=op.f("pk_plant_manager")),
        sa.UniqueConstraint("id_user", name=op.f("uq_plant_manager_id_user")),
    )

    op.create_table(
        "administrator",
        sa.Column("id_admin", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_user", sa.Integer(), nullable=False),
        _user_fk("administrator"),
        sa.PrimaryKeyConstraint("id_admin", name=op.f("pk_administrator")),
        sa.UniqueConstraint("id_user", name=op.f("uq_administrator_id_user")),
    )

    # --- Líneas y equipos -------------------------------------------------------------------
    op.create_table(
        "production_line",
        sa.Column("id_line", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("production_process", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id_line", name=op.f("pk_production_line")),
        sa.UniqueConstraint("name", name=op.f("uq_production_line_name")),
    )

    op.create_table(
        "equipment_system",
        sa.Column("id_equipment", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "operational_status",
            sa.String(length=17),
            server_default="operational",
            nullable=False,
        ),
        sa.Column(
            "status_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            _one_of("operational_status", "operational", "under_maintenance", "faulty", "stopped"),
            name=op.f("ck_equipment_system_operational_status"),
        ),
        sa.PrimaryKeyConstraint("id_equipment", name=op.f("pk_equipment_system")),
    )

    op.create_table(
        "equipment_line_membership",
        sa.Column("id_line", sa.Integer(), nullable=False),
        sa.Column("id_equipment", sa.Integer(), nullable=False),
        _fk(
            ["id_line"],
            ["production_line.id_line"],
            "fk_equipment_line_membership_id_line_production_line",
            cascade_update=True,
        ),
        _fk(
            ["id_equipment"],
            ["equipment_system.id_equipment"],
            "fk_equipment_line_membership_id_equipment_equipment_system",
            cascade_update=True,
        ),
        sa.PrimaryKeyConstraint("id_line", "id_equipment", name=op.f("pk_equipment_line_membership")),
    )
    op.create_index(
        op.f("ix_equipment_line_membership_id_equipment"),
        "equipment_line_membership",
        ["id_equipment"],
    )

    op.create_table(
        "line_authorization",
        sa.Column("id_technician", sa.Integer(), nullable=False),
        sa.Column("id_line", sa.Integer(), nullable=False),
        sa.Column("can_generate", sa.Boolean(), nullable=False),
        sa.Column("can_validate", sa.Boolean(), nullable=False),
        sa.CheckConstraint(
            "can_generate = TRUE OR can_validate = TRUE", name=op.f("ck_line_authorization_at_least_one")
        ),
        _fk(
            ["id_technician"],
            ["technician.id_technician"],
            "fk_line_authorization_id_technician_technician",
            cascade_update=True,
        ),
        _fk(
            ["id_line"],
            ["production_line.id_line"],
            "fk_line_authorization_id_line_production_line",
            cascade_update=True,
        ),
        sa.PrimaryKeyConstraint("id_technician", "id_line", name=op.f("pk_line_authorization")),
    )
    op.create_index(op.f("ix_line_authorization_id_line"), "line_authorization", ["id_line"])

    op.create_table(
        "line_assignment",
        sa.Column("id_operator", sa.Integer(), nullable=False),
        sa.Column("id_line", sa.Integer(), nullable=False),
        _fk(
            ["id_operator"],
            ["operator.id_operator"],
            "fk_line_assignment_id_operator_operator",
            cascade_update=True,
        ),
        _fk(
            ["id_line"],
            ["production_line.id_line"],
            "fk_line_assignment_id_line_production_line",
            cascade_update=True,
        ),
        sa.PrimaryKeyConstraint("id_operator", "id_line", name=op.f("pk_line_assignment")),
    )
    op.create_index(op.f("ix_line_assignment_id_line"), "line_assignment", ["id_line"])

    # --- Tareas -----------------------------------------------------------------------------
    op.create_table(
        "task",
        sa.Column("id_task", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("criticality_level", sa.String(length=6), nullable=False),
        sa.Column("id_equipment", sa.Integer(), nullable=False),
        sa.Column("id_creator_technician", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            _one_of("type", "preventive", "corrective", "predictive"), name=op.f("ck_task_type")
        ),
        sa.CheckConstraint(
            _one_of("criticality_level", "low", "medium", "high"),
            name=op.f("ck_task_criticality_level"),
        ),
        _fk(["id_equipment"], ["equipment_system.id_equipment"], "fk_task_id_equipment_equipment_system"),
        _fk(
            ["id_creator_technician"],
            ["technician.id_technician"],
            "fk_task_id_creator_technician_technician",
        ),
        sa.PrimaryKeyConstraint("id_task", name=op.f("pk_task")),
        sa.UniqueConstraint(
            "id_equipment", "type", "description", name=op.f("uq_task_equipment_type_desc")
        ),
    )
    op.create_index(op.f("ix_task_id_equipment"), "task", ["id_equipment"])
    op.create_index(op.f("ix_task_id_creator_technician"), "task", ["id_creator_technician"])

    # --- Planes y revisiones ----------------------------------------------------------------
    # plan y revision se referencian entre sí: plan se crea sin la FK id_origin_revision y esta
    # se añade al final, cuando revision ya existe.
    op.create_table(
        "plan",
        sa.Column("id_plan", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "creation_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("status", sa.String(length=12), server_default="generated", nullable=False),
        sa.Column("criticality_level", sa.String(length=6), nullable=False),
        sa.Column("preventive_percentage", sa.Integer(), nullable=False),
        sa.Column("corrective_percentage", sa.Integer(), nullable=False),
        sa.Column("predictive_percentage", sa.Integer(), nullable=False),
        sa.Column("system_coverage", sa.Integer(), nullable=False),
        sa.Column("total_task_count", sa.Integer(), nullable=False),
        sa.Column("id_line", sa.Integer(), nullable=False),
        sa.Column("id_creator_technician", sa.Integer(), nullable=False),
        sa.Column("id_origin_revision", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            _one_of(
                "status",
                "generated",
                "validated",
                "approved",
                "rejected",
                "in_execution",
                "completed",
            ),
            name=op.f("ck_plan_status"),
        ),
        sa.CheckConstraint(
            _one_of("criticality_level", "low", "medium", "high"),
            name=op.f("ck_plan_criticality_level"),
        ),
        sa.CheckConstraint(
            "preventive_percentage >= 0 AND corrective_percentage >= 0 "
            "AND predictive_percentage >= 0",
            name=op.f("ck_plan_percentages_non_negative"),
        ),
        sa.CheckConstraint(
            "preventive_percentage + corrective_percentage + predictive_percentage "
            "BETWEEN 99 AND 101",
            name=op.f("ck_plan_percentages_sum_tolerance"),
        ),
        sa.CheckConstraint(
            "system_coverage >= 1 AND system_coverage <= total_task_count",
            name=op.f("ck_plan_coverage_valid"),
        ),
        sa.CheckConstraint("total_task_count > 0", name=op.f("ck_plan_total_count_positive")),
        _fk(["id_line"], ["production_line.id_line"], "fk_plan_line", cascade_update=True),
        _fk(
            ["id_creator_technician"],
            ["technician.id_technician"],
            "fk_plan_creator_technician",
            cascade_update=True,
        ),
        _fk(
            ["id_creator_technician", "id_line"],
            ["line_authorization.id_technician", "line_authorization.id_line"],
            "fk_plan_authorization",
            cascade_update=True,
        ),
        sa.PrimaryKeyConstraint("id_plan", name=op.f("pk_plan")),
        sa.UniqueConstraint("id_origin_revision", name=op.f("uq_plan_id_origin_revision")),
    )
    op.create_index(op.f("ix_plan_creation_date"), "plan", ["creation_date"])
    op.create_index(op.f("ix_plan_status"), "plan", ["status"])
    op.create_index(op.f("ix_plan_id_line"), "plan", ["id_line"])
    op.create_index(op.f("ix_plan_id_creator_technician"), "plan", ["id_creator_technician"])

    op.create_table(
        "revision",
        sa.Column("id_revision", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "revision_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("observations", sa.String(length=1000), nullable=True),
        sa.Column("decision", sa.String(length=16), nullable=False),
        sa.Column("new_generation_criteria", sa.String(length=2000), nullable=True),
        sa.Column("id_manager", sa.Integer(), nullable=False),
        sa.Column("id_plan", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "(decision = 'approve' AND new_generation_criteria IS NULL) OR "
            "(decision = 'request_new_plan' AND new_generation_criteria IS NOT NULL)",
            name=op.f("ck_revision_criteria_match_decision"),
        ),
        sa.CheckConstraint(
            _one_of("decision", "approve", "request_new_plan"), name=op.f("ck_revision_decision")
        ),
        _fk(["id_manager"], ["plant_manager.id_manager"], "fk_revision_id_manager_plant_manager"),
        _fk(["id_plan"], ["plan.id_plan"], "fk_revision_id_plan_plan"),
        sa.PrimaryKeyConstraint("id_revision", name=op.f("pk_revision")),
    )
    op.create_index(op.f("ix_revision_id_manager"), "revision", ["id_manager"])
    op.create_index(op.f("ix_revision_id_plan"), "revision", ["id_plan"])

    op.create_foreign_key(
        op.f("fk_plan_origin_revision"),
        "plan",
        "revision",
        ["id_origin_revision"],
        ["id_revision"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "validation",
        sa.Column("id_validation", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "validation_date",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("observations", sa.String(length=1000), nullable=True),
        sa.Column("id_plan", sa.Integer(), nullable=False),
        sa.Column("id_technician", sa.Integer(), nullable=False),
        _fk(["id_plan"], ["plan.id_plan"], "fk_validation_id_plan_plan"),
        _fk(
            ["id_technician"], ["technician.id_technician"], "fk_validation_id_technician_technician"
        ),
        sa.PrimaryKeyConstraint("id_validation", name=op.f("pk_validation")),
    )
    op.create_index(op.f("ix_validation_id_plan"), "validation", ["id_plan"])
    op.create_index(op.f("ix_validation_id_technician"), "validation", ["id_technician"])

    op.create_table(
        "task_plan_membership",
        sa.Column("id_plan", sa.Integer(), nullable=False),
        sa.Column("id_task", sa.Integer(), nullable=False),
        _fk(["id_plan"], ["plan.id_plan"], "fk_task_plan_membership_id_plan_plan"),
        _fk(["id_task"], ["task.id_task"], "fk_task_plan_membership_id_task_task"),
        sa.PrimaryKeyConstraint("id_plan", "id_task", name=op.f("pk_task_plan_membership")),
    )
    op.create_index(op.f("ix_task_plan_membership_id_task"), "task_plan_membership", ["id_task"])

    op.create_table(
        "plan_operator_assignment",
        sa.Column("id_operator", sa.Integer(), nullable=False),
        sa.Column("assignment_date", sa.Date(), nullable=False),
        sa.Column("id_plan", sa.Integer(), nullable=False),
        _fk(
            ["id_operator"],
            ["operator.id_operator"],
            "fk_plan_operator_assignment_id_operator_operator",
        ),
        _fk(["id_plan"], ["plan.id_plan"], "fk_plan_operator_assignment_id_plan_plan"),
        sa.PrimaryKeyConstraint(
            "id_operator", "assignment_date", name=op.f("pk_plan_operator_assignment")
        ),
    )
    op.create_index(
        op.f("ix_plan_operator_assignment_id_plan"), "plan_operator_assignment", ["id_plan"]
    )

    # --- Ejecución --------------------------------------------------------------------------
    op.create_table(
        "intervention",
        sa.Column("id_intervention", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("result", sa.String(length=11), nullable=False),
        sa.Column("observations", sa.String(length=1000), nullable=True),
        sa.Column("id_plan", sa.Integer(), nullable=False),
        sa.Column("id_task", sa.Integer(), nullable=False),
        sa.Column("id_operator", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            _one_of("result", "fulfilled", "partial", "unfulfilled"),
            name=op.f("ck_intervention_result"),
        ),
        _fk(
            ["id_plan", "id_task"],
            ["task_plan_membership.id_plan", "task_plan_membership.id_task"],
            "fk_intervention_task_plan_membership",
            cascade_update=True,
        ),
        _fk(["id_operator"], ["operator.id_operator"], "fk_intervention_id_operator_operator"),
        sa.PrimaryKeyConstraint("id_intervention", name=op.f("pk_intervention")),
    )
    op.create_index(op.f("ix_intervention_occurred_at"), "intervention", ["occurred_at"])
    op.create_index(op.f("ix_intervention_id_operator"), "intervention", ["id_operator"])
    op.create_index("ix_intervention_plan_task", "intervention", ["id_plan", "id_task"])

    op.create_table(
        "reinspection",
        sa.Column("id_reinspection", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "request_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("reason", sa.String(length=1000), nullable=False),
        sa.Column("status", sa.String(length=8), server_default="pending", nullable=False),
        sa.Column("manual_result", sa.String(length=9), nullable=True),
        sa.Column("resolution_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id_intervention", sa.Integer(), nullable=False),
        sa.Column("id_additional_technician", sa.Integer(), nullable=True),
        sa.Column("id_resolver_technician", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(status = 'pending' AND id_resolver_technician IS NULL "
            "AND resolution_date IS NULL AND manual_result IS NULL) OR "
            "(status = 'attended' AND id_resolver_technician IS NOT NULL "
            "AND resolution_date IS NOT NULL AND manual_result IS NOT NULL)",
            name=op.f("ck_reinspection_state_consistency"),
        ),
        sa.CheckConstraint(
            _one_of("status", "pending", "attended"), name=op.f("ck_reinspection_status")
        ),
        sa.CheckConstraint(
            _one_of("manual_result", "confirmed", "corrected", "discarded"),
            name=op.f("ck_reinspection_manual_result"),
        ),
        _fk(
            ["id_intervention"],
            ["intervention.id_intervention"],
            "fk_reinspection_id_intervention_intervention",
        ),
        _fk(
            ["id_additional_technician"],
            ["technician.id_technician"],
            "fk_reinspection_id_additional_technician_technician",
        ),
        _fk(
            ["id_resolver_technician"],
            ["technician.id_technician"],
            "fk_reinspection_id_resolver_technician_technician",
        ),
        sa.PrimaryKeyConstraint("id_reinspection", name=op.f("pk_reinspection")),
    )
    op.create_index(op.f("ix_reinspection_id_intervention"), "reinspection", ["id_intervention"])
    op.create_index(
        op.f("ix_reinspection_id_additional_technician"),
        "reinspection",
        ["id_additional_technician"],
    )
    op.create_index(
        op.f("ix_reinspection_id_resolver_technician"), "reinspection", ["id_resolver_technician"]
    )


def downgrade() -> None:
    """Elimina todo el esquema, en orden inverso a las dependencias."""
    op.drop_table("reinspection")
    op.drop_table("intervention")
    op.drop_table("plan_operator_assignment")
    op.drop_table("task_plan_membership")
    op.drop_table("validation")
    op.drop_constraint(op.f("fk_plan_origin_revision"), "plan", type_="foreignkey")
    op.drop_table("revision")
    op.drop_table("plan")
    op.drop_table("task")
    op.drop_table("line_assignment")
    op.drop_table("line_authorization")
    op.drop_table("equipment_line_membership")
    op.drop_table("equipment_system")
    op.drop_table("production_line")
    op.drop_table("administrator")
    op.drop_table("plant_manager")
    op.drop_table("operator")
    op.drop_table("technician")
    op.drop_table("users")
