import { useQuery } from "@tanstack/react-query";
import { getMaintenanceTask } from "../../composition-root";

export const useMaintenanceTask = (id: string) => {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => getMaintenanceTask.execute(id),
  });
};
