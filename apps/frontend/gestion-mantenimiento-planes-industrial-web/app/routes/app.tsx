import { Navigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { LoadingScreen } from "../auth/PermissionGate";
import { AppShell } from "../components/AppShell";
import { MaintenanceProvider } from "../data/MaintenanceContext";

export function meta() {
  return [{ title: "Mantenia · Gestión de mantenimiento" }];
}

/** Layout protegido: exige sesión y monta el proveedor de datos. */
export default function AppLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingScreen message="Restaurando sesión…" />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <MaintenanceProvider>
      <AppShell />
    </MaintenanceProvider>
  );
}
