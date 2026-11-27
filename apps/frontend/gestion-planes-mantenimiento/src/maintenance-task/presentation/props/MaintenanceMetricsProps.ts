import type { MaintenanceTask } from "../../domain/models/entities/MaintenanceTask";

export interface MaintenanceMetricsProps {
  visibleTasks: MaintenanceTask[];
}
