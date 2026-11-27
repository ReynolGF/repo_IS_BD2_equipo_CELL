import { MaintenanceTaskService } from "../../infrastructure/services/MaintenanceTaskService";
import { CreateMaintenanceTaskUseCase } from "./CreateMaintenanceTaskUseCase";
import { UpdateMaintenanceTaskUseCase } from "./UpdateMaintenanceTaskUseCase";
import { DeleteMaintenanceTaskUseCase } from "./DeleteMaintenanceTaskUseCase";
import { GetMaintenanceTasksUseCase } from "./GetMaintenanceTasksUseCase";
import { GetMaintenanceTaskUseCase } from "./getMaintenanceTaskUseCase";

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
