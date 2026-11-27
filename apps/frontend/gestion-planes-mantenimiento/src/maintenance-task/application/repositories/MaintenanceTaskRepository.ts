import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";
import type { CreateMaintenanceTaskDTO } from "../DTOs/CreateMaintenanceTaskDTO";
import type { UpdateMaintenanceTaskDTO } from "../DTOs/UpdateMaintenanceTaskDTO";

export interface MaintenanceTaskRepository {
  createMaintenanceTask(
    task: CreateMaintenanceTaskDTO,
  ): Promise<MaintenanceTask | null>;
  updateMaintenanceTask(
    task: UpdateMaintenanceTaskDTO,
  ): Promise<MaintenanceTask | null>;
  deleteMaintenanceTask(taskId: string): Promise<MaintenanceTask | null>;
  getMaintenanceTaskById(taskId: string): Promise<MaintenanceTask | null>;
  getAllMaintenanceTasks(): Promise<MaintenanceTask[]>;
}
