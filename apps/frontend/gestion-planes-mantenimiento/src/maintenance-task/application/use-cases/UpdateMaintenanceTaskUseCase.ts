import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";
import type { UpdateMaintenanceTaskDTO } from "../DTOs/UpdateMaintenanceTaskDTO";
import type { MaintenanceTaskRepository } from "../repositories/MaintenanceTaskRepository";

export class UpdateMaintenanceTaskUseCase {
  private readonly maintenanceTaskService: MaintenanceTaskRepository;
  constructor(maintenanceTaskService: MaintenanceTaskRepository) {
    this.maintenanceTaskService = maintenanceTaskService;
  }

  execute(task: UpdateMaintenanceTaskDTO): Promise<MaintenanceTask | null> {
    return this.maintenanceTaskService.updateMaintenanceTask(task);
  }
}
