"""Modelos ORM.

Importar este paquete registra todas las tablas en ``Base.metadata``. Alembic y los tests lo
necesitan para ver el esquema completo.
"""

from app.models.execution import Intervention, Reinspection
from app.models.infrastructure import (
    EquipmentLineMembership,
    EquipmentSystem,
    LineAssignment,
    LineAuthorization,
    ProductionLine,
)
from app.models.plans import (
    Plan,
    PlanOperatorAssignment,
    Revision,
    TaskPlanMembership,
    Validation,
)
from app.models.tasks import Task
from app.models.users import Administrator, Operator, PlantManager, Technician, User

__all__ = [
    "Administrator",
    "EquipmentLineMembership",
    "EquipmentSystem",
    "Intervention",
    "LineAssignment",
    "LineAuthorization",
    "Operator",
    "Plan",
    "PlanOperatorAssignment",
    "PlantManager",
    "ProductionLine",
    "Reinspection",
    "Revision",
    "Task",
    "TaskPlanMembership",
    "Technician",
    "User",
    "Validation",
]
