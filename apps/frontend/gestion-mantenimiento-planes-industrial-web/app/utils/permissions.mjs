/** Matriz central de permisos por rol. Se comparte entre navegación y guardas. */
export const ROLE_PERMISSIONS = {
  Administrador: [
    "dashboard:view",
    "plans:view",
    "plans:create",
    "plans:review",
    "plans:start",
    "tasks:view",
    "tasks:create",
    "tasks:edit",
    "tasks:review",
    "catalogs:view",
    "catalogs:manage",
    "execution:view",
    "sensors:view",
    "reports:view",
  ],
  "Jefe de planta": [
    "dashboard:view",
    "plans:view",
    "plans:review",
    "plans:start",
    "tasks:view",
    "catalogs:view",
    "execution:view",
    "sensors:view",
    "reports:view",
  ],
  Técnico: [
    "dashboard:view",
    "plans:view",
    "plans:create",
    "plans:start",
    "tasks:view",
    "tasks:create",
    "catalogs:view",
    "execution:view",
    "sensors:view",
    "reports:view",
  ],
  Operario: ["dashboard:view", "execution:view", "reports:view"],
};

export const ROUTE_PERMISSIONS = {
  "/": "dashboard:view",
  "/planes": "plans:view",
  "/tareas": "tasks:view",
  "/lineas": "catalogs:view",
  "/tecnicos": "catalogs:view",
  "/operarios": "catalogs:view",
  "/ejecucion": "execution:view",
  "/sensores": "sensors:view",
  "/reportes": "reports:view",
};

export function hasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function canAccessPath(role, pathname) {
  const normalized = pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
  const permission = Object.entries(ROUTE_PERMISSIONS).find(
    ([path]) => path === normalized || (path !== "/" && normalized.startsWith(`${path}/`)),
  )?.[1];
  return permission ? hasPermission(role, permission) : false;
}
