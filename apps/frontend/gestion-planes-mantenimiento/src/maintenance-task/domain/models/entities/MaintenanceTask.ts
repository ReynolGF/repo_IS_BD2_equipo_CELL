import type { MaintenanceType } from "../MaintenanceType";
import type { Severity } from "../Severity";

export interface MaintenanceTask {
  id: string;
  name: string;
  system: string;
  line: string;
  type: MaintenanceType;
  severity: Severity;
  author: string;
  duration: number;
  timesExecuted: number;
  createdAt?: string;
}
