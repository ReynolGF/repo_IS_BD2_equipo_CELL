import { PermissionGate } from "../auth/PermissionGate";
import { OperatorsPage } from "../pages/OperatorsPage";

export function meta() {
  return [{ title: "Operarios · Mantenia" }];
}

export default function OperatorsRoute() {
  return (
    <PermissionGate permission="catalogs:view">
      <OperatorsPage />
    </PermissionGate>
  );
}
