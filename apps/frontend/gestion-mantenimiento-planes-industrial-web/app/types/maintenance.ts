/**
 * Modelos del dominio de mantenimiento, independientes de React y del
 * transporte. Las pantallas y los servicios comparten estos tipos para que el
 * contrato con la API sea explícito y verificable por TypeScript.
 */

/** Roles soportados por la aplicación. */
export type Role = "Administrador" | "Técnico" | "Operario" | "Jefe de planta";

export type Severity = "Alta" | "Media" | "Baja";

export type MaintenanceType = "Preventivo" | "Correctivo" | "Predictivo";

export type PlanStatus =
  | "Borrador"
  | "En revisión"
  | "Aprobado"
  | "En ejecución"
  | "Finalizado"
  | "Rechazado";

/** Tarea del banco de mantenimiento. */
export type Task = {
  id: string;
  name: string;
  system: string;
  line: string;
  type: MaintenanceType;
  severity: Severity;
  author: string;
  duration: number;
  timesExecuted: number;
  createdAt?: string;
  /** Trazabilidad cuando un administrador autoriza un duplicado. */
  duplicateApprovedBy?: string;
  duplicateJustification?: string;
};

/** Tarea incluida dentro de un plan y su estado de ejecución. */
export type PlanTask = Task & {
  operator: string;
  completed: boolean;
};

/**
 * Parámetros usados para generar un plan. `target` conserva la configuración
 * solicitada y los campos superiores conservan la distribución real aplicada.
 */
export type PlanParameters = {
  total: number;
  preventive: number;
  corrective: number;
  predictive: number;
  systems: string[];
  balance: number;
  target: {
    total: number;
    preventive: number;
    corrective: number;
    predictive: number;
  };
};

export type Plan = {
  id: string;
  name: string;
  line: string;
  process: string;
  creator: string;
  reviewer?: string;
  createdAt: string;
  validatedAt?: string;
  observations?: string;
  /** Criterios solicitados cuando la jefatura devuelve o rechaza un plan. */
  rejectionCriteria?: string;
  status: PlanStatus;
  params: PlanParameters;
  tasks: PlanTask[];
};

/** Equipo que pertenece a una línea de producción. */
export type Equipment = {
  id: string;
  name: string;
  system: string;
};

export type ProductionLine = {
  id: string;
  name: string;
  process: string;
  systems: string[];
  equipment: Equipment[];
};

export type Technician = {
  id: string;
  name: string;
  specialty: string;
  /** Líneas en las que puede generar planes. */
  lines: string[];
  /** Habilitación para validar técnicamente planes de sus líneas. */
  canValidate: boolean;
};

export type Operator = {
  id: string;
  name: string;
  age: number;
  shift: string;
  lines: string[];
};

export type Intervention = {
  id: string;
  planId: string;
  task: string;
  operator: string;
  date: string;
  notes: string;
  result: string;
  reinspection: boolean;
  supportTechnician?: string;
};

export type SensorReading = {
  equipment: string;
  line: string;
  period: string;
  temperature: number;
  vibration: number;
  pressure: number;
  status: string;
};

export type DuplicateStatus = "Pendiente" | "Aprobada" | "Rechazada";

/** Solicitud de revisión cuando una tarea coincide con otra ya registrada. */
export type DuplicateRequest = {
  id: string;
  draft: NewTaskInput;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: DuplicateStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdTaskId?: string;
};

export type NewTaskInput = Omit<
  Task,
  "id" | "timesExecuted" | "createdAt" | "duplicateApprovedBy" | "duplicateJustification"
>;

export type MaintenanceData = {
  tasks: Task[];
  plans: Plan[];
  lines: ProductionLine[];
  technicians: Technician[];
  operators: Operator[];
  interventions: Intervention[];
  sensors: SensorReading[];
  duplicateRequests: DuplicateRequest[];
};

/** Entrada para generar un plan desde el banco de tareas. */
export type NewPlanInput = {
  name: string;
  line: string;
  process: string;
  creator: string;
  params: PlanParameters;
  tasks: PlanTask[];
};

/** Usuario autenticado en la sesión de demostración. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Líneas visibles para técnicos; vacío para roles globales. */
  lines: string[];
  technicianId?: string;
  operatorId?: string;
};
