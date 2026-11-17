"""Enumeraciones del dominio.

Los valores se guardan como texto en la base de datos (ver ``app.db.types.enum_column``). Los
nombres están en inglés; el glosario con los términos del informe está en
``docs/modelo-de-datos.md``.
"""

import enum


class Occupation(enum.StrEnum):
    """Rol del usuario en el sistema."""

    technician = "technician"
    operator = "operator"
    plant_manager = "plant_manager"
    administrator = "administrator"


class Shift(enum.StrEnum):
    """Turno de trabajo de un operario."""

    morning = "morning"
    afternoon = "afternoon"
    night = "night"


class OperationalStatus(enum.StrEnum):
    """Estado operativo vigente de un equipo."""

    operational = "operational"
    under_maintenance = "under_maintenance"
    faulty = "faulty"
    stopped = "stopped"


class TaskType(enum.StrEnum):
    """Tipo de mantenimiento de una tarea."""

    preventive = "preventive"
    corrective = "corrective"
    predictive = "predictive"


class Criticality(enum.StrEnum):
    """Nivel de criticidad de una tarea o de un plan."""

    low = "low"
    medium = "medium"
    high = "high"


class PlanStatus(enum.StrEnum):
    """Estado del ciclo de vida de un plan."""

    generated = "generated"
    validated = "validated"
    approved = "approved"
    rejected = "rejected"
    in_execution = "in_execution"
    completed = "completed"


class InterventionResult(enum.StrEnum):
    """Resultado de una intervención registrada por un operario."""

    fulfilled = "fulfilled"
    partial = "partial"
    unfulfilled = "unfulfilled"


class DecisionRevision(enum.StrEnum):
    """Decisión del jefe de planta al revisar un plan."""

    approve = "approve"
    request_new_plan = "request_new_plan"


class ReinspectionStatus(enum.StrEnum):
    """Estado de una solicitud de reinspección."""

    pending = "pending"
    attended = "attended"


class ManualResult(enum.StrEnum):
    """Resultado manual de una reinspección resuelta."""

    confirmed = "confirmed"
    corrected = "corrected"
    discarded = "discarded"


class SensorType(enum.StrEnum):
    """Tipo de sensor. Solo se usa en MongoDB (lecturas de sensores)."""

    temperature = "temperature"
    vibration = "vibration"
    pressure = "pressure"
