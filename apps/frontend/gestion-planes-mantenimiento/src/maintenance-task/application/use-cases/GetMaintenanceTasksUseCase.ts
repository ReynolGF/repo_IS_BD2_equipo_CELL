import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";
import type { MaintenanceTaskRepository } from "../repositories/MaintenanceTaskRepository";

export class GetMaintenanceTasksUseCase {
  private readonly maintenanceTaskService: MaintenanceTaskRepository;
  constructor(maintenanceTaskService: MaintenanceTaskRepository) {
    this.maintenanceTaskService = maintenanceTaskService;
  }
  execute(): Promise<MaintenanceTask[]> {
    return this.maintenanceTaskService.getAllMaintenanceTasks();
  }
}
