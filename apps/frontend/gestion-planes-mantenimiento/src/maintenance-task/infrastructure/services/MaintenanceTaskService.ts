import axiosCLient from "../http/axiosClient.ts";
import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask.ts";
import type { MaintenanceTaskRepository } from "../../application/repositories/MaintenanceTaskRepository.ts";
import type { CreateMaintenanceTaskDTO } from "../../application/DTOs/CreateMaintenanceTaskDTO.ts";
import type { UpdateMaintenanceTaskDTO } from "../../application/DTOs/UpdateMaintenanceTaskDTO.ts";
import axiosClient from "../http/axiosClient.ts";

const databaseTasks: MaintenanceTask[] = [
  {
    id: "1",
    name: "Revisión de motor",
    line: "Línea 1",
    system: "Motor principal",
    type: "Preventivo",
    severity: "Alta",
    author: "Juan Pérez",
    timesExecuted: 5,
    duration: 30,
  },
  {
    id: "2",
    name: "Cambio de aceite",
    line: "Línea 2",
    system: "Sistema hidráulico",
    type: "Correctivo",
    severity: "Media",
    author: "María López",
    timesExecuted: 3,
    duration: 45,
  },
  {
    id: "3",
    name: "Inspección de frenos",
    line: "Línea 1",
    system: "Sistema de frenos",
    type: "Predictivo",
    severity: "Baja",
    author: "Carlos García",
    timesExecuted: 2,
    duration: 20,
  },
  {
    id: "4",
    name: "Ajuste de válvulas",
    line: "Línea 3",
    system: "Motor auxiliar",
    type: "Preventivo",
    severity: "Alta",
    author: "Ana Martínez",
    timesExecuted: 4,
    duration: 25,
  },
  {
    id: "5",
    name: "Reemplazo de filtros",
    line: "Línea 2",
    system: "Sistema de filtración",
    type: "Correctivo",
    severity: "Media",
    author: "Luis Fernández",
    timesExecuted: 6,
    duration: 35,
  },
];

export class MaintenanceTaskService implements MaintenanceTaskRepository {
  async createMaintenanceTask(
    task: CreateMaintenanceTaskDTO,
  ): Promise<MaintenanceTask | null> {
    throw new Error("Method not implemented.");
  }
  async updateMaintenanceTask(
    task: UpdateMaintenanceTaskDTO,
  ): Promise<MaintenanceTask | null> {
    throw new Error("Method not implemented.");
  }
  async deleteMaintenanceTask(taskId: string): Promise<MaintenanceTask | null> {
    throw new Error("Method not implemented.");
  }
  async getMaintenanceTaskById(
    taskId: string,
  ): Promise<MaintenanceTask | null> {
    const { data } = await axiosClient.get(`/tasks/${taskId}`);
    return data;
  }
  async getAllMaintenanceTasks(): Promise<MaintenanceTask[]> {
    const { data } = await axiosClient.get("/tasks");
    return data;
  }
}
