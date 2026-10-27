import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { apiAvailable, getDataSource, setDataSource } from "../data";
import type { DataSource } from "../data";
import { Forbidden } from "../auth/PermissionGate";
import { hasPermission, permissionForPath } from "../utils/permissions.mjs";
import type { Permission } from "../utils/permissions.mjs";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  permission: Permission;
  badge?: "plans" | "duplicates";
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "PLANTA",
    items: [
      { to: "/", label: "Resumen", icon: "▦", permission: "dashboard:view" },
      { to: "/planes", label: "Planes", icon: "▤", permission: "plans:view", badge: "plans" },
      { to: "/tareas", label: "Banco de tareas", icon: "☷", permission: "tasks:view", badge: "duplicates" },
    ],
  },
  {
    group: "CATÁLOGOS",
    items: [
      { to: "/lineas", label: "Líneas y equipos", icon: "⌘", permission: "catalogs:view" },
      { to: "/tecnicos", label: "Técnicos", icon: "♙", permission: "catalogs:view" },
      { to: "/operarios", label: "Operarios", icon: "♧", permission: "catalogs:view" },
    ],
  },
  {
    group: "OPERACIÓN",
    items: [
      { to: "/ejecucion", label: "Ejecución", icon: "✓", permission: "execution:view" },
      { to: "/ejecucion/operario", label: "Registrar intervención", icon: "▶", permission: "execution:view" },
      { to: "/ejecucion/estado", label: "Estado de ejecución", icon: "◔", permission: "execution:view" },
      { to: "/reinspecciones", label: "Reinspecciones", icon: "↻", permission: "execution:view" },
      { to: "/sensores", label: "Sensores", icon: "⌁", permission: "sensors:view" },
      { to: "/sensores/analisis", label: "Análisis de sensores", icon: "∿", permission: "sensors:view" },
      { to: "/sensores/estado", label: "Estado de equipos", icon: "◉", permission: "sensors:view" },
    ],
  },
  {
    group: "ANÁLISIS",
    items: [
      { to: "/reportes", label: "Reportes", icon: "▥", permission: "reports:view" },
      { to: "/reportes/tareas-mas-ejecutadas", label: "Tareas más ejecutadas", icon: "▤", permission: "reports:view" },
      { to: "/reportes/desempeno-operarios", label: "Desempeño de operarios", icon: "▥", permission: "reports:view" },
      { to: "/reportes/analisis-cumplimiento", label: "Análisis de cumplimiento", icon: "◈", permission: "reports:view" },
      { to: "/reportes/distribucion-lineas", label: "Distribución entre líneas", icon: "▦", permission: "reports:view" },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Estructura visual compartida: barra lateral, cabecera, avisos y contenido. */
export function AppShell() {
  const { user, signOut } = useAuth();
  const { data, query, setQuery, toast, dismissToast } = useMaintenance();
  const location = useLocation();
  const [source, setSource] = useState<DataSource>("demo");

  useEffect(() => {
    setSource(getDataSource());
  }, []);

  if (!user) return null;

  const allItems = NAV.flatMap((group) => group.items);
  const current =
    allItems.find((item) => item.to === location.pathname) ??
    allItems.find((item) => item.to !== "/" && location.pathname.startsWith(item.to)) ??
    allItems[0];
  const requerido = permissionForPath(location.pathname);
  const pendingDuplicates =
    data?.duplicateRequests.filter((request) => request.status === "Pendiente").length ?? 0;

  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/">
          <span className="brand-mark">
            <span />
          </span>
          <span className="brand-name">
            mantenia<span>.</span>
            <small>INDUSTRIAL OS</small>
          </span>
        </NavLink>

        <div className="plant-switcher">
          <span className="plant-icon">N</span>
          <span>
            <strong>Planta Norte</strong>
            <small>Complejo industrial</small>
          </span>
          <span className="chevron">⌄</span>
        </div>

        <nav className="main-nav" aria-label="Navegación principal">
          {NAV.map((group) => {
            const items = group.items.filter((item) => hasPermission(user.role, item.permission));
            if (!items.length) return null;
            return (
              <div key={group.group}>
                <p className="nav-group">{group.group}</p>
                {items.map((item) => {
                  const badge =
                    item.badge === "plans"
                      ? data?.plans.length
                      : item.badge === "duplicates"
                        ? pendingDuplicates
                        : undefined;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                      {badge !== undefined && badge > 0 && (
                        <span className="nav-count">{badge}</span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-health">
            <span className="health-dot" />
            {source === "api" ? "API conectada" : "Datos simulados"}
          </div>
          <label className="source-switch">
            Fuente
            <select
              value={source}
              onChange={(event) => setDataSource(event.target.value as DataSource)}
              title={apiAvailable ? undefined : "Configura VITE_API_URL para habilitar la API real"}
            >
              <option value="demo">Datos simulados</option>
              <option value="api" disabled={!apiAvailable}>
                API real{apiAvailable ? "" : " · sin configurar"}
              </option>
            </select>
          </label>
          <div className="profile-button">
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
            <button className="logout-button" onClick={signOut} title="Cerrar sesión">
              ⎋
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Planta Norte</span>
            <span className="crumb-divider">/</span>
            <strong>{current.label}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <span>⌕</span>
              <input
                aria-label="Buscar"
                placeholder="Buscar en la planta…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <span className="role-chip">{user.role}</span>
            <span className="top-avatar">{initials(user.name)}</span>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="live-pip" /> {dateLabel.toUpperCase()}
              </div>
              <h1>{current.label === "Resumen" ? "Centro de mantenimiento" : current.label}</h1>
              <p>
                {user.role === "Técnico"
                  ? `Planes y tareas de tus líneas autorizadas: ${user.lines.join(", ")}.`
                  : user.role === "Operario"
                    ? "Consulta tus planes asignados y registra el avance de tus tareas."
                    : "Planes, tareas y equipos de toda la planta en un solo lugar."}
              </p>
            </div>
            <div className="heading-actions">
              <span className="role-scope">
                {user.role === "Técnico" || user.role === "Operario"
                  ? user.lines.join(" · ")
                  : "Vista global de planta"}
              </span>
            </div>
          </section>

          {requerido && !hasPermission(user.role, requerido) ? (
            <Forbidden required={requerido} />
          ) : (
            <Outlet />
          )}

          <footer className="page-footer">
            <span>
              © 2026 Mantenia <i /> Gestión de mantenimiento industrial
            </span>
            <span>
              <i className="footer-status" /> React Router · Datos {source === "api" ? "API" : "simulados"}
            </span>
          </footer>
        </div>
      </main>

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error-toast" : ""}`} role="status">
          <span>{toast.kind === "error" ? "!" : "✓"}</span>
          {toast.message}
          <button aria-label="Cerrar" onClick={dismissToast}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
