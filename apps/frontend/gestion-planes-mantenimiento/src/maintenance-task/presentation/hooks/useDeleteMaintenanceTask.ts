import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMaintenanceTask } from "../../composition-root";

export const useDeleteMaintenanceTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMaintenanceTask.execute(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
};
