import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";
import { hasPermission } from "../utils/permissions.mjs";
import type { Permission } from "../utils/permissions.mjs";

/** Pantalla de espera mientras se restaura la sesión desde localStorage. */
export function LoadingScreen({ message = "Cargando información de mantenimiento…" }: { message?: string }) {
  return (
    <main className="loading-state">
      <span className="loading-mark">M</span>
      <p>{message}</p>
    </main>
  );
}

/** Vista mostrada cuando el rol no tiene permiso para la ruta solicitada. */
export function Forbidden({ required }: { required?: string }) {
  const { user, signOut } = useAuth();
  return (
    <main className="permission-page">
      <span className="permission-code">403</span>
      <h1>Acceso no autorizado</h1>
      <p>
        El rol <strong>{user?.role ?? "invitado"}</strong> no tiene permiso para esta sección
        {required ? ` (${required})` : ""}. Solicita acceso a un administrador o vuelve al resumen.
      </p>
      <div className="permission-actions">
        <Link className="button button-primary" to="/">
          Volver al resumen
        </Link>
        <button className="button button-quiet" onClick={signOut}>
          Cambiar de usuario
        </button>
      </div>
    </main>
  );
}

/**
 * Guarda de ruta: redirige a login si no hay sesión y muestra 403 si el rol no
 * tiene el permiso. La navegación del menú se filtra con la misma matriz.
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!hasPermission(user.role, permission)) return <Forbidden required={permission} />;
  return <>{children}</>;
}
