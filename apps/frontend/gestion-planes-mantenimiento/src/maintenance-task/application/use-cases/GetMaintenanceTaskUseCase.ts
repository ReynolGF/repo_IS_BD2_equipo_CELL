import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";
import type { MaintenanceTaskRepository } from "../repositories/MaintenanceTaskRepository";

export class GetMaintenanceTaskUseCase {
  private readonly maintenanceTaskService: MaintenanceTaskRepository;
  constructor(maintenanceTaskService: MaintenanceTaskRepository) {
    this.maintenanceTaskService = maintenanceTaskService;
  }
  execute(id: string): Promise<MaintenanceTask | null> {
    return this.maintenanceTaskService.getMaintenanceTaskById(id);
  }
}
