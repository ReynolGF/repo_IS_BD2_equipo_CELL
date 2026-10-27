import { PermissionGate } from "../auth/PermissionGate";
import { ExecutionPage } from "../pages/ExecutionPage";

export function meta() {
  return [{ title: "Ejecución · Mantenia" }];
}

export default function ExecutionRoute() {
  return (
    <PermissionGate permission="execution:view">
      <ExecutionPage />
    </PermissionGate>
  );
}
