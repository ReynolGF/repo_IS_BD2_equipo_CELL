import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/**
 * Rutas de la aplicación:
 * - `/login` es pública.
 * - El layout protegido monta la sesión, el proveedor de datos y la navegación.
 * - Cada ruta aplica su permiso con `PermissionGate` y una guarda por rol.
 * - Las pantallas de operación y reportes de Manuel (loader/action de React
 *   Router) cuelgan de `/ejecucion`, `/reinspecciones`, `/sensores/...` y
 *   `/reportes/...`; la guarda por rol las cubre por prefijo.
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
    route("ejecucion/operario", "routes/ejecucion-operario.tsx"),
    route("ejecucion/estado", "routes/ejecucion-estado.tsx"),
    route("reinspecciones", "routes/reinspecciones.tsx"),
    route("sensores", "routes/sensores.tsx"),
    route("sensores/analisis", "routes/sensores-analisis.tsx"),
    route("sensores/estado", "routes/sensores-estado.tsx"),
    route("reportes", "routes/reportes.tsx"),
    route("reportes/tareas-mas-ejecutadas", "routes/tareas-mas-ejecutadas.tsx"),
    route("reportes/desempeno-operarios", "routes/desempeno-operarios.tsx"),
    route("reportes/analisis-cumplimiento", "routes/analisis-cumplimiento.tsx"),
    route("reportes/distribucion-lineas", "routes/distribucion-lineas.tsx"),
    route("*", "routes/not-found.tsx"),
  ]),
] satisfies RouteConfig;