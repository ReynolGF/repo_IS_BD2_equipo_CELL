import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateMaintenanceTaskDTO } from "../../application/DTOs/UpdateMaintenanceTaskDTO";
import { createMaintenanceTask } from "../../composition-root";

export const useUpdateMaintenanceTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateMaintenanceTaskDTO) =>
      createMaintenanceTask.execute(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};
