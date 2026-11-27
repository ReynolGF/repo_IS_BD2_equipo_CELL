import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";
import type { CreateMaintenanceTaskDTO } from "../DTOs/CreateMaintenanceTaskDTO";

import type { MaintenanceTaskRepository } from "../repositories/MaintenanceTaskRepository";

export class CreateMaintenanceTaskUseCase {
  private readonly maintenanceTaskService: MaintenanceTaskRepository;
  constructor(maintenanceTaskService: MaintenanceTaskRepository) {
    this.maintenanceTaskService = maintenanceTaskService;
  }

  execute(task: CreateMaintenanceTaskDTO): Promise<MaintenanceTask | null> {
    return this.maintenanceTaskService.createMaintenanceTask(task);
  }
}
