import { database } from "../../database-seed/database.ts";
import type { CreateMaintenanceTask } from "../models/DTOs/createMaintenanceTask.ts";
import type { UpdateMaintenanceTask } from "../models/DTOs/updateMaintenanceTask.ts";
import type { Task } from "../models/task.ts";

export class MaintenanceTaskService {
  async getAll(): Promise<Task[]> {
    return database.tasks;
  }

  // GET /tasks/:id
  async getById(id: string): Promise<Task | undefined> {
    return database.tasks.find((task) => task.id === id);
  }

  // POST /tasks
  async create(data: CreateMaintenanceTask): Promise<void> {}

  // PATCH /tasks/:id
  async update(id: string, data: UpdateMaintenanceTask): Promise<void> {}

  // DELETE /tasks/:id
  async delete(id: string): Promise<void> {}
}
