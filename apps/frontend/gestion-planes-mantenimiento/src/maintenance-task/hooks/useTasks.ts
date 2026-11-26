import { useQuery } from "@tanstack/react-query";
import { taskService } from "../services";

export const useTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: taskService.getAll,
    staleTime: 1000 * 60,
  });

export const useTask = (id: string) =>
  useQuery({
    queryKey: ["task", id],
    queryFn: () => taskService.getById(id),
    enabled: !!id,
  });

export const useCreateTask = () => {};

export const useUpdateTask = () => {};

export const useDeleteTask = () => {};
