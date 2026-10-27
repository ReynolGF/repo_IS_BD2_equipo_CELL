import { PermissionGate } from "../auth/PermissionGate";
import { SensorsPage } from "../pages/SensorsPage";

export function meta() {
  return [{ title: "Sensores · Mantenia" }];
}

export default function SensorsRoute() {
  return (
    <PermissionGate permission="sensors:view">
      <SensorsPage />
    </PermissionGate>
  );
}
