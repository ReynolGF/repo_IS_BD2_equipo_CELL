import { useQuery } from "@tanstack/react-query";
import { getMaintenanceTasks } from "../../composition-root";

export const useMaintenanceTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: () => getMaintenanceTasks.execute(),
  });
