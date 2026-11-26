import type { CreateMaintenanceTask } from "../models/DTOs/createMaintenanceTask.ts";
import type { UpdateMaintenanceTask } from "../models/DTOs/updateMaintenanceTask.ts";
import type { Task } from "../models/task.ts";
import axios from "axios";

const databaseTasks: Task[] = [
  {
    id: "1",
    name: "Revisión de motor",
    line: "Línea 1",
    system: "Motor principal",
    type: "Preventivo",
    severity: "Alta",
    author: "Juan Pérez",
    timesExecuted: 5,
    duration: 30,
  },
  {
    id: "2",
    name: "Cambio de aceite",
    line: "Línea 2",
    system: "Sistema hidráulico",
    type: "Correctivo",
    severity: "Media",
    author: "María López",
    timesExecuted: 3,
    duration: 45,
  },
  {
    id: "3",
    name: "Inspección de frenos",
    line: "Línea 1",
    system: "Sistema de frenos",
    type: "Predictivo",
    severity: "Baja",
    author: "Carlos García",
    timesExecuted: 2,
    duration: 20,
  },
  {
    id: "4",
    name: "Ajuste de válvulas",
    line: "Línea 3",
    system: "Motor auxiliar",
    type: "Preventivo",
    severity: "Alta",
    author: "Ana Martínez",
    timesExecuted: 4,
    duration: 25,
  },
  {
    id: "5",
    name: "Reemplazo de filtros",
    line: "Línea 2",
    system: "Sistema de filtración",
    type: "Correctivo",
    severity: "Media",
    author: "Luis Fernández",
    timesExecuted: 6,
    duration: 35,
  },
];

// const api = axios.create({
//   baseURL: "http://localhost:3000/api",
//   headers: { "Content-Type": "application/json" },
// });

export class MaintenanceTaskService {
  async getAll(): Promise<Task[]> {
    //const { data } = await api.get("/tasks");
    //return data;
    return databaseTasks;
  }

  async getById(id: string): Promise<Task | undefined> {
    //const { data } = await api.get(`/tasks/${id}`);
    //return data;
    return databaseTasks.find((task) => task.id === id);
  }

  // async create(data: CreateMaintenanceTask): Promise<void> {}

  // async update(id: string, data: UpdateMaintenanceTask): Promise<void> {}

  // async delete(id: string): Promise<void> {}
}
