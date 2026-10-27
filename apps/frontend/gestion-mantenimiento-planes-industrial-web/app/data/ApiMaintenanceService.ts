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

/**
 * Adaptador REST del repositorio (patrón Adapter sobre `fetch`).
 *
 * El contrato se documenta en `docs/arquitectura-front.md`. Si una respuesta
 * no es correcta se lanza un `MaintenanceError` para que la UI muestre el
 * mensaje sin acoplarse a los detalles de HTTP.
 */
export class ApiMaintenanceService implements MaintenanceRepository {
  constructor(private readonly baseUrl = "/api") {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      let message = `La solicitud falló (${response.status}).`;
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) message = payload.message;
      } catch {
        // La respuesta no era JSON; se conserva el mensaje genérico.
      }
      throw new MaintenanceError(message, `HTTP_${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async load(): Promise<MaintenanceData> {
    const data = await this.request<MaintenanceData>("/maintenance");
    return { ...data, duplicateRequests: data.duplicateRequests ?? [] };
  }

  createTask(input: NewTaskInput) {
    return this.request<Task>("/tasks", { method: "POST", body: JSON.stringify(input) });
  }

  updateTask(task: Task) {
    return this.request<Task>(`/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(task) });
  }

  async deleteTask(id: string) {
    await this.request<void>(`/tasks/${id}`, { method: "DELETE" });
  }

  requestDuplicate(input: { draft: NewTaskInput; reason: string; requestedBy: string }) {
    return this.request<DuplicateRequest>("/duplicate-requests", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  reviewDuplicate(input: {
    id: string;
    status: Exclude<DuplicateStatus, "Pendiente">;
    reviewer: string;
    notes: string;
  }) {
    return this.request<DuplicateRequest>(`/duplicate-requests/${input.id}/review`, {
      method: "PUT",
      body: JSON.stringify({ status: input.status, reviewer: input.reviewer, notes: input.notes }),
    });
  }

  saveLine(line: ProductionLine) {
    return line.id
      ? this.request<ProductionLine>(`/lines/${line.id}`, {
          method: "PUT",
          body: JSON.stringify(line),
        })
      : this.request<ProductionLine>("/lines", { method: "POST", body: JSON.stringify(line) });
  }

  async deleteLine(id: string) {
    await this.request<void>(`/lines/${id}`, { method: "DELETE" });
  }

  saveTechnician(technician: Technician) {
    return technician.id
      ? this.request<Technician>(`/technicians/${technician.id}`, {
          method: "PUT",
          body: JSON.stringify(technician),
        })
      : this.request<Technician>("/technicians", {
          method: "POST",
          body: JSON.stringify(technician),
        });
  }

  async deleteTechnician(id: string) {
    await this.request<void>(`/technicians/${id}`, { method: "DELETE" });
  }

  saveOperator(operator: Operator) {
    return operator.id
      ? this.request<Operator>(`/operators/${operator.id}`, {
          method: "PUT",
          body: JSON.stringify(operator),
        })
      : this.request<Operator>("/operators", { method: "POST", body: JSON.stringify(operator) });
  }

  async deleteOperator(id: string) {
    await this.request<void>(`/operators/${id}`, { method: "DELETE" });
  }

  createPlan(input: NewPlanInput) {
    return this.request<Plan>("/plans/generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  savePlan(plan: Plan) {
    return this.request<Plan>(`/plans/${plan.id}`, {
      method: "PUT",
      body: JSON.stringify(plan),
    });
  }

  createIntervention(input: Omit<Intervention, "id">) {
    return this.request<Intervention>("/interventions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateIntervention(intervention: Intervention) {
    return this.request<Intervention>(`/interventions/${intervention.id}`, {
      method: "PUT",
      body: JSON.stringify(intervention),
    });
  }
}
