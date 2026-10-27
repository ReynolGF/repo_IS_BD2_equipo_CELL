import { PermissionGate } from "../auth/PermissionGate";
import { TasksPage } from "../pages/TasksPage";

export function meta() {
  return [{ title: "Banco de tareas · Mantenia" }];
}

export default function TasksRoute() {
  return (
    <PermissionGate permission="tasks:view">
      <TasksPage />
    </PermissionGate>
  );
}
