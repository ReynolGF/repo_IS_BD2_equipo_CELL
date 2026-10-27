import type {
  DuplicateRequest,
  DuplicateStatus,
  Intervention,
  MaintenanceData,
  NewPlanInput,
  NewTaskInput,
  Operator,
  Plan,
  ProductionLine,
  Task,
  Technician,
} from "../types/maintenance";

/**
 * Puerto del repositorio de mantenimiento.
 *
 * Las pantallas dependen de esta interfaz, no de una implementación concreta.
 * Así se puede alternar entre datos simulados y la API real sin cambiar la UI
 * (patrón Repository + Strategy).
 */
export interface MaintenanceRepository {
  load(): Promise<MaintenanceData>;

  createTask(input: NewTaskInput): Promise<Task>;
  updateTask(task: Task): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  requestDuplicate(input: {
    draft: NewTaskInput;
    reason: string;
    requestedBy: string;
  }): Promise<DuplicateRequest>;
  reviewDuplicate(input: {
    id: string;
    status: Exclude<DuplicateStatus, "Pendiente">;
    reviewer: string;
    notes: string;
  }): Promise<DuplicateRequest>;

  saveLine(line: ProductionLine): Promise<ProductionLine>;
  deleteLine(id: string): Promise<void>;

  saveTechnician(technician: Technician): Promise<Technician>;
  deleteTechnician(id: string): Promise<void>;

  saveOperator(operator: Operator): Promise<Operator>;
  deleteOperator(id: string): Promise<void>;

  createPlan(input: NewPlanInput): Promise<Plan>;
  savePlan(plan: Plan): Promise<Plan>;

  createIntervention(input: Omit<Intervention, "id">): Promise<Intervention>;
  updateIntervention(intervention: Intervention): Promise<Intervention>;
}

/** Error de dominio con código estable para que la UI decida cómo mostrarlo. */
export class MaintenanceError extends Error {
  code: string;
  constructor(message: string, code = "MAINTENANCE_ERROR") {
    super(message);
    this.name = "MaintenanceError";
    this.code = code;
  }
}
