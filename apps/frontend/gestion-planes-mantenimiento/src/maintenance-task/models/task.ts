import type {MaintenanceType} from "./maintenanceType.ts";
import type {Severity} from "./severity.ts";


export interface Task {
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