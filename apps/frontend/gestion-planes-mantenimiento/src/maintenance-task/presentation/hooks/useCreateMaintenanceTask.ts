import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateMaintenanceTaskDTO } from "../../application/DTOs/CreateMaintenanceTaskDTO";
import { createMaintenanceTask } from "../../composition-root";

export const useCreateMaintenanceTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateMaintenanceTaskDTO) =>
      createMaintenanceTask.execute(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};
