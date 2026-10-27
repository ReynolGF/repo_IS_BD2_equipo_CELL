import enum

class Occupation(str, enum.Enum):
    technician = "technician"
    operator = "operator"
    plant_manager = "plant_manager"
    administrator = "administrator"


class Shift(str, enum.Enum):
    morning = "morning"
    afternoon = "afternoon"
    night = "night"


class OperationalStatus(str, enum.Enum):
    operational = "operational"
    under_maintenance = "under_maintenance"
    faulty = "faulty"
    stopped = "stopped"


class TaskType(str, enum.Enum):
    preventive = "preventive"
    corrective = "corrective"
    predictive = "predictive"


class Criticality(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PlanStatus(str, enum.Enum):
    generated = "generated"
    validated = "validated"
    approved = "approved"
    rejected = "rejected"
    in_execution = "in_execution"
    completed = "completed"


class InterventionResult(str, enum.Enum):
    fulfilled = "fulfilled"
    partial = "partial"
    unfulfilled = "unfulfilled"


class DecisionRevision(str, enum.Enum):
    approve = "approve"
    request_new_plan = "request_new_plan"


class ReinspectionStatus(str, enum.Enum):
    pending = "pending"
    attended = "attended"


class ManualResult(str, enum.Enum):
    confirmed = "confirmed"
    corrected = "corrected"
    discarded = "discarded"


class SensorType(str, enum.Enum):
    """Only used in MongoDB (sensor readings)."""
    temperature = "temperature"
    vibration = "vibration"
    pressure = "pressure"