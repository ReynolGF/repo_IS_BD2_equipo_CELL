import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/**
 * Rutas de la aplicación:
 * - `/login` es pública.
 * - El layout protegido monta la sesión, el proveedor de datos y la navegación.
 * - Cada ruta aplica su permiso con `PermissionGate` y una guarda por rol.
 */
export default [
  route("login", "routes/login.tsx"),
  layout("routes/app.tsx", [
    index("routes/dashboard.tsx"),
    route("planes", "routes/planes.tsx"),
    route("tareas", "routes/tareas.tsx"),
    route("lineas", "routes/lineas.tsx"),
    route("tecnicos", "routes/tecnicos.tsx"),
    route("operarios", "routes/operarios.tsx"),
    route("ejecucion", "routes/ejecucion.tsx"),
    route("sensores", "routes/sensores.tsx"),
    route("reportes", "routes/reportes.tsx"),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;
