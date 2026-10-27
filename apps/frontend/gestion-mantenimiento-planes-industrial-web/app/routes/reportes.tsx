import { PermissionGate } from "../auth/PermissionGate";
import { ReportsPage } from "../pages/ReportsPage";

export function meta() {
  return [{ title: "Reportes · Mantenia" }];
}

export default function ReportsRoute() {
  return (
    <PermissionGate permission="reports:view">
      <ReportsPage />
    </PermissionGate>
  );
}
