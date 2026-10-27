import { PermissionGate } from "../auth/PermissionGate";
import { PlansPage } from "../pages/PlansPage";

export function meta() {
  return [{ title: "Planes · Mantenia" }];
}

export default function PlansRoute() {
  return (
    <PermissionGate permission="plans:view">
      <PlansPage />
    </PermissionGate>
  );
}
