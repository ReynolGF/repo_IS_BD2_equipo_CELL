import type {CreateMaintenanceTask} from "../models/DTOs/createMaintenanceTask.ts";
import type {UpdateMaintenanceTask} from "../models/DTOs/updateMaintenanceTask.ts";


export class MaintenanceTaskService {


    async getAll():Promise<void> {

    }

    // GET /tasks/:id
    async getById(id: string):Promise<void>{

    }

    // POST /tasks
    async create(data: CreateMaintenanceTask):Promise<void> {

    }

    // PATCH /tasks/:id
    async update(id: string, data: UpdateMaintenanceTask): Promise<void> {

    }


    // DELETE /tasks/:id
    async delete(id: string): Promise<void> {

    }

}