import { CreateMaintenanceTaskUseCase } from "./application/use-cases/CreateMaintenanceTaskUseCase";
import { DeleteMaintenanceTaskUseCase } from "./application/use-cases/DeleteMaintenanceTaskUseCase";
import { GetMaintenanceTasksUseCase } from "./application/use-cases/GetMaintenanceTasksUseCase";
import { GetMaintenanceTaskUseCase } from "./application/use-cases/getMaintenanceTaskUseCase";
import { UpdateMaintenanceTaskUseCase } from "./application/use-cases/UpdateMaintenanceTaskUseCase";
import { MaintenanceTaskService } from "./infrastructure/services/MaintenanceTaskService";

const maintenanceTaskRepository = new MaintenanceTaskService();

export const getMaintenanceTasks = new GetMaintenanceTasksUseCase(
  maintenanceTaskRepository,
);
export const getMaintenanceTask = new GetMaintenanceTaskUseCase(
  maintenanceTaskRepository,
);
export const createMaintenanceTask = new CreateMaintenanceTaskUseCase(
  maintenanceTaskRepository,
);
export const updateMaintenanceTask = new UpdateMaintenanceTaskUseCase(
  maintenanceTaskRepository,
);
export const deleteMaintenanceTask = new DeleteMaintenanceTaskUseCase(
  maintenanceTaskRepository,
);
