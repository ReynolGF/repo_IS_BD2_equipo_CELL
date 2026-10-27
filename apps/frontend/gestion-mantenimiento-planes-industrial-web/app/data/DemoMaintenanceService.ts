import { demoData } from "./demoData";
import { MaintenanceError } from "./MaintenanceRepository";
import type { MaintenanceRepository } from "./MaintenanceRepository";
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
import { findOperatorConflict, isDuplicateTask, validateGenerationParams } from "../utils/maintenanceRules.mjs";

const clone = <T>(value: T): T => structuredClone(value);

const today = () => new Date().toISOString().slice(0, 10);
const now = () =>
  new Date().toLocaleString("es", { dateStyle: "short", timeStyle: "short" });

function nextId(prefix: string, values: { id: string }[], pad = 3) {
  const max = values.reduce((current, item) => {
    const number = Number(item.id.split("-").pop());
    return Number.isFinite(number) ? Math.max(current, number) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

/**
 * Adaptador local (Strategy concreta) que implementa el puerto del repositorio
 * sobre una copia en memoria de los datos simulados.
 */
export class DemoMaintenanceService implements MaintenanceRepository {
  private data: MaintenanceData = clone(demoData);

  async load(): Promise<MaintenanceData> {
    return clone(this.data);
  }

  async createTask(input: NewTaskInput): Promise<Task> {
    if (isDuplicateTask(input, this.data.tasks)) {
      throw new MaintenanceError(
        "Ya existe una tarea con ese nombre, sistema y línea. Solicita la revisión de un administrador.",
        "DUPLICATE_TASK",
      );
    }
    const task: Task = {
      ...input,
      id: nextId("T", this.data.tasks),
      timesExecuted: 0,
      createdAt: today(),
    };
    this.data.tasks = [task, ...this.data.tasks];
    return clone(task);
  }

  async updateTask(task: Task): Promise<Task> {
    if (isDuplicateTask(task, this.data.tasks, task.id)) {
      throw new MaintenanceError(
        "La actualización genera un duplicado con otra tarea del banco.",
        "DUPLICATE_TASK",
      );
    }
    this.data.tasks = this.data.tasks.map((item) => (item.id === task.id ? clone(task) : item));
    return clone(task);
  }

  async deleteTask(id: string): Promise<void> {
    if (this.data.plans.some((plan) => plan.tasks.some((task) => task.id === id))) {
      throw new MaintenanceError(
        "No se puede eliminar una tarea que ya forma parte de un plan.",
        "TASK_IN_USE",
      );
    }
    this.data.tasks = this.data.tasks.filter((task) => task.id !== id);
  }

  async requestDuplicate(input: {
    draft: NewTaskInput;
    reason: string;
    requestedBy: string;
  }): Promise<DuplicateRequest> {
    if (!input.reason.trim()) {
      throw new MaintenanceError("Indica el motivo de la solicitud de duplicado.", "REASON_REQUIRED");
    }
    const pending = this.data.duplicateRequests.some(
      (request) =>
        request.status === "Pendiente" &&
        isDuplicateTask(input.draft, [request.draft as Task], ""),
    );
    if (pending) {
      throw new MaintenanceError(
        "Ya existe una solicitud pendiente para esta misma tarea.",
        "DUPLICATE_REQUEST_EXISTS",
      );
    }
    const request: DuplicateRequest = {
      id: nextId("DUP", this.data.duplicateRequests),
      draft: clone(input.draft),
      reason: input.reason.trim(),
      requestedBy: input.requestedBy,
      requestedAt: now(),
      status: "Pendiente",
    };
    this.data.duplicateRequests = [request, ...this.data.duplicateRequests];
    return clone(request);
  }

  async reviewDuplicate(input: {
    id: string;
    status: Exclude<DuplicateStatus, "Pendiente">;
    reviewer: string;
    notes: string;
  }): Promise<DuplicateRequest> {
    const request = this.data.duplicateRequests.find((item) => item.id === input.id);
    if (!request) throw new MaintenanceError("La solicitud no existe.", "NOT_FOUND");
    if (request.status !== "Pendiente") {
      throw new MaintenanceError("La solicitud ya fue revisada.", "ALREADY_REVIEWED");
    }
    let createdTaskId: string | undefined;
    if (input.status === "Aprobada") {
      const task: Task = {
        ...request.draft,
        id: nextId("T", this.data.tasks),
        timesExecuted: 0,
        createdAt: today(),
        duplicateApprovedBy: input.reviewer,
        duplicateJustification: input.notes || "Duplicado autorizado por administración.",
      };
      this.data.tasks = [task, ...this.data.tasks];
      createdTaskId = task.id;
    }
    const updated: DuplicateRequest = {
      ...request,
      status: input.status,
      reviewedBy: input.reviewer,
      reviewedAt: now(),
      reviewNotes: input.notes,
      createdTaskId,
    };
    this.data.duplicateRequests = this.data.duplicateRequests.map((item) =>
      item.id === updated.id ? updated : item,
    );
    return clone(updated);
  }

  async saveLine(line: ProductionLine): Promise<ProductionLine> {
    const systems = [
      ...new Set(line.systems.map((system) => system.trim()).filter(Boolean)),
    ];
    if (!line.name.trim() || !line.process.trim() || !systems.length) {
      throw new MaintenanceError(
        "La línea requiere nombre, proceso y al menos un sistema.",
        "INVALID_LINE",
      );
    }
    const duplicateName = this.data.lines.some(
      (item) => item.id !== line.id && item.name.toLowerCase() === line.name.trim().toLowerCase(),
    );
    if (duplicateName) {
      throw new MaintenanceError("Ya existe una línea con ese nombre.", "DUPLICATE_LINE");
    }
    const existing = this.data.lines.find((item) => item.id === line.id);
    const id = line.id || nextId("LIN", this.data.lines, 2);
    const equipment = line.equipment
      .filter((item) => item.name.trim())
      .map((item, index) => {
        const system = item.system.trim();
        return {
          ...item,
          id: item.id || `EQ-${String(this.data.lines.flatMap((entry) => entry.equipment).length + index + 1).padStart(2, "0")}`,
          name: item.name.trim(),
          system: systems.includes(system) ? system : systems[0],
        };
      });
    const saved: ProductionLine = {
      id,
      name: line.name.trim(),
      process: line.process.trim(),
      systems,
      equipment,
    };
    const exists = this.data.lines.some((item) => item.id === saved.id);
    this.data.lines = exists
      ? this.data.lines.map((item) => (item.id === saved.id ? saved : item))
      : [...this.data.lines, saved];

    // El nombre de la línea se usa como referencia en tareas, planes y
    // personal; al renombrarla se actualizan todas las referencias para no
    // dejar registros huérfanos.
    if (existing && existing.name !== saved.name) {
      this.data.tasks = this.data.tasks.map((task) =>
        task.line === existing.name ? { ...task, line: saved.name } : task,
      );
      this.data.plans = this.data.plans.map((plan) =>
        plan.line === existing.name ? { ...plan, line: saved.name } : plan,
      );
      this.data.technicians = this.data.technicians.map((technician) => ({
        ...technician,
        lines: technician.lines.map((name) => (name === existing.name ? saved.name : name)),
      }));
      this.data.operators = this.data.operators.map((operator) => ({
        ...operator,
        lines: operator.lines.map((name) => (name === existing.name ? saved.name : name)),
      }));
      this.data.sensors = this.data.sensors.map((sensor) =>
        sensor.line === existing.name ? { ...sensor, line: saved.name } : sensor,
      );
      this.data.duplicateRequests = this.data.duplicateRequests.map((request) =>
        request.draft.line === existing.name
          ? { ...request, draft: { ...request.draft, line: saved.name } }
          : request,
      );
    }

    return clone(saved);
  }

  async deleteLine(id: string): Promise<void> {
    const line = this.data.lines.find((item) => item.id === id);
    if (!line) return;
    if (
      this.data.plans.some((plan) => plan.line === line.name) ||
      this.data.tasks.some((task) => task.line === line.name) ||
      this.data.operators.some((operator) => operator.lines.includes(line.name)) ||
      this.data.technicians.some((technician) => technician.lines.includes(line.name))
    ) {
      throw new MaintenanceError(
        "No se puede eliminar una línea con tareas, planes o personal asignado.",
        "LINE_IN_USE",
      );
    }
    this.data.lines = this.data.lines.filter((item) => item.id !== id);
  }

  async saveTechnician(technician: Technician): Promise<Technician> {
    if (!technician.name.trim() || !technician.specialty.trim()) {
      throw new MaintenanceError("El técnico requiere nombre y especialidad.", "INVALID_TECHNICIAN");
    }
    const saved: Technician = {
      ...technician,
      id: technician.id || nextId("TEC", this.data.technicians, 2),
      name: technician.name.trim(),
      specialty: technician.specialty.trim(),
      lines: [...new Set(technician.lines)],
    };
    const exists = this.data.technicians.some((item) => item.id === saved.id);
    this.data.technicians = exists
      ? this.data.technicians.map((item) => (item.id === saved.id ? saved : item))
      : [...this.data.technicians, saved];
    return clone(saved);
  }

  async deleteTechnician(id: string): Promise<void> {
    const technician = this.data.technicians.find((item) => item.id === id);
    if (!technician) return;
    if (this.data.plans.some((plan) => plan.creator === technician.name)) {
      throw new MaintenanceError(
        "No se puede eliminar un técnico que creó planes. Reasigna o conserva el historial.",
        "TECHNICIAN_IN_USE",
      );
    }
    this.data.technicians = this.data.technicians.filter((item) => item.id !== id);
  }

  async saveOperator(operator: Operator): Promise<Operator> {
    if (!operator.name.trim() || !operator.shift.trim()) {
      throw new MaintenanceError("El operario requiere nombre y turno.", "INVALID_OPERATOR");
    }
    if (!Number.isFinite(operator.age) || operator.age < 18) {
      throw new MaintenanceError("La edad del operario debe ser mayor o igual a 18.", "INVALID_AGE");
    }
    const saved: Operator = {
      ...operator,
      id: operator.id || nextId("OP", this.data.operators, 2),
      name: operator.name.trim(),
      shift: operator.shift.trim(),
      lines: [...new Set(operator.lines)],
    };
    const exists = this.data.operators.some((item) => item.id === saved.id);
    this.data.operators = exists
      ? this.data.operators.map((item) => (item.id === saved.id ? saved : item))
      : [...this.data.operators, saved];
    return clone(saved);
  }

  async deleteOperator(id: string): Promise<void> {
    const operator = this.data.operators.find((item) => item.id === id);
    if (!operator) return;
    const activePlan = this.data.plans.find(
      (plan) =>
        ["Aprobado", "En ejecución"].includes(plan.status) &&
        plan.tasks.some((task) => task.operator === operator.name),
    );
    if (activePlan) {
      throw new MaintenanceError(
        `No se puede eliminar a ${operator.name}: tiene el plan activo ${activePlan.id}.`,
        "OPERATOR_IN_USE",
      );
    }
    this.data.operators = this.data.operators.filter((item) => item.id !== id);
  }

  async createPlan(input: NewPlanInput): Promise<Plan> {
    const errors = validateGenerationParams(
      {
        total: input.params.target.total,
        preventive: input.params.target.preventive,
        corrective: input.params.target.corrective,
        predictive: input.params.target.predictive,
        systems: input.params.systems,
        balance: input.params.balance,
      },
      input.tasks.length,
    );
    if (errors.length) throw new MaintenanceError(errors.join(" "), "INVALID_PLAN");
    if (!input.tasks.length) {
      throw new MaintenanceError("Selecciona al menos una tarea para generar el plan.", "EMPTY_PLAN");
    }
    if (input.tasks.some((task) => task.line !== input.line)) {
      throw new MaintenanceError(
        "Todas las tareas del plan deben pertenecer a la línea seleccionada.",
        "LINE_MISMATCH",
      );
    }
    const plan: Plan = {
      ...input,
      id: nextId("PM-2026", this.data.plans),
      createdAt: today(),
      status: "En revisión",
      tasks: input.tasks.map((task) => ({
        ...task,
        operator: "Sin asignar",
        completed: false,
      })),
    };
    this.data.plans = [plan, ...this.data.plans];
    return clone(plan);
  }

  async savePlan(plan: Plan): Promise<Plan> {
    if (["Aprobado", "En ejecución"].includes(plan.status)) {
      const operators = [
        ...new Set(plan.tasks.map((task) => task.operator).filter((name) => name && name !== "Sin asignar")),
      ];
      for (const operator of operators) {
        const conflict = findOperatorConflict(operator, plan.id, this.data.plans);
        if (conflict) {
          throw new MaintenanceError(
            `${operator} ya tiene asignado el plan ${conflict.id}.`,
            "OPERATOR_CONFLICT",
          );
        }
      }
    }
    this.data.plans = this.data.plans.map((item) => (item.id === plan.id ? clone(plan) : item));
    return clone(plan);
  }

  async createIntervention(input: Omit<Intervention, "id">): Promise<Intervention> {
    const intervention: Intervention = {
      ...input,
      id: nextId("INT", this.data.interventions),
    };
    this.data.interventions = [intervention, ...this.data.interventions];
    return clone(intervention);
  }

  async updateIntervention(intervention: Intervention): Promise<Intervention> {
    this.data.interventions = this.data.interventions.map((item) =>
      item.id === intervention.id ? clone(intervention) : item,
    );
    return clone(intervention);
  }
}
