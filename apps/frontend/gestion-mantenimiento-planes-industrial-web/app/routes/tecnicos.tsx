import { PermissionGate } from "../auth/PermissionGate";
import { TechniciansPage } from "../pages/TechniciansPage";

export function meta() {
  return [{ title: "Técnicos · Mantenia" }];
}

export default function TechniciansRoute() {
  return (
    <PermissionGate permission="catalogs:view">
      <TechniciansPage />
    </PermissionGate>
  );
}
