import { PermissionGate } from "../auth/PermissionGate";
import { DashboardPage } from "../pages/DashboardPage";

export function meta() {
  return [{ title: "Resumen · Mantenia" }];
}

export default function DashboardRoute() {
  return (
    <PermissionGate permission="dashboard:view">
      <DashboardPage />
    </PermissionGate>
  );
}
