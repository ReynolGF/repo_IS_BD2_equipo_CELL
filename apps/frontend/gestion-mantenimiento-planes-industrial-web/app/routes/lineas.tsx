import { PermissionGate } from "../auth/PermissionGate";
import { LinesPage } from "../pages/LinesPage";

export function meta() {
  return [{ title: "Líneas y equipos · Mantenia" }];
}

export default function LinesRoute() {
  return (
    <PermissionGate permission="catalogs:view">
      <LinesPage />
    </PermissionGate>
  );
}
