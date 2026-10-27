import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Metric, PanelTitle, SeverityTag, StatusPill } from "../components/maintenance/Shared";
import { executionStats, visiblePlansFor } from "../utils/maintenanceRules.mjs";
import type { PlanStatus } from "../types/maintenance";

const STATUS_ORDER: PlanStatus[] = [
  "Borrador",
  "En revisión",
  "Aprobado",
  "En ejecución",
  "Finalizado",
  "Rechazado",
];

/** Resumen general con indicadores, estado de equipos y planes recientes. */
export function DashboardPage() {
  const { user } = useAuth();
  const { data, query } = useMaintenance();
  const [sort, setSort] = useState({ key: "createdAt", asc: false });

  const scopedPlans = useMemo(
    () => (data && user ? visiblePlansFor(user, data.plans) : []),
    [data, user],
  );

  return (
    <PageState>
      {data && user && <DashboardContent data={data} user={user} plans={scopedPlans} query={query} sort={sort} setSort={setSort} />}
    </PageState>
  );
}

function DashboardContent({
  data,
  user,
  plans,
  query,
  sort,
  setSort,
}: {
  data: NonNullable<ReturnType<typeof useMaintenance>["data"]>;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  plans: ReturnType<typeof visiblePlansFor>;
  query: string;
  sort: { key: string; asc: boolean };
  setSort: (value: { key: string; asc: boolean }) => void;
}) {
  const isOperator = user.role === "Operario";
  const activePlans = plans.filter((plan) => ["Aprobado", "En ejecución"].includes(plan.status));
  const reviewPlans = plans.filter((plan) => plan.status === "En revisión");
  const stats = executionStats(plans);
  const myTasks = plans.flatMap((plan) =>
    plan.tasks.filter((task) => task.operator === user.name).map((task) => ({ ...task, planId: plan.id })),
  );
  const scopedLines =
    user.role === "Técnico" || user.role === "Operario" ? user.lines : null;
  const sensors = data.sensors.filter(
    (sensor) => !scopedLines || scopedLines.includes(sensor.line),
  );
  const alerts = sensors.filter((sensor) => sensor.status !== "Estable");
  const recentPlans = plans
    .filter((plan) =>
      `${plan.id} ${plan.name} ${plan.line} ${plan.creator} ${plan.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 6);

  const completedByStatus = STATUS_ORDER.map((status) => ({
    status,
    count: plans.filter((plan) => plan.status === status).length,
  }));
  const maxStatus = Math.max(1, ...completedByStatus.map((item) => item.count));

  return (
    <>
      <section className="metric-grid" aria-label="Indicadores de mantenimiento">
        {isOperator ? (
          <>
            <Metric
              label="Mis planes"
              value={String(plans.filter((plan) => plan.status !== "Finalizado").length).padStart(2, "0")}
              hint={`${plans.length} planes con tareas asignadas`}
              color="mint"
            />
            <Metric
              label="Tareas asignadas"
              value={String(myTasks.length).padStart(2, "0")}
              hint={`${myTasks.filter((task) => task.completed).length} completadas`}
              color="blue"
            />
            <Metric
              label="Pendientes"
              value={String(myTasks.filter((task) => !task.completed).length).padStart(2, "0")}
              hint="Disponibles en la pantalla de ejecución"
              color="yellow"
            />
            <Metric
              label="Cumplimiento"
              value={`${stats.rate}%`}
              hint="Sobre las tareas de tus planes"
              color="coral"
            />
          </>
        ) : (
          <>
            <Metric
              label="Planes activos"
              value={String(activePlans.length).padStart(2, "0")}
              hint={`${reviewPlans.length} requieren validación`}
              color="mint"
            />
            <Metric
              label="Tareas disponibles"
              value={String(data.tasks.length).padStart(2, "0")}
              hint="En el banco de mantenimiento"
              color="blue"
            />
            <Metric
              label="Cumplimiento"
              value={`${stats.rate}%`}
              hint={`Objetivo de planta: 90% · ${stats.completed}/${stats.total} tareas`}
              color="yellow"
            />
            <Metric
              label="Alertas de equipos"
              value={String(alerts.length).padStart(2, "0")}
              hint={`${alerts.filter((sensor) => sensor.status === "Alerta alta").length} altas · ${alerts.filter((sensor) => sensor.status === "Revisar").length} medias`}
              color="coral"
            />
          </>
        )}
      </section>

      <section className="middle-grid">
        <article className="panel">
          <PanelTitle
            title={isOperator ? "Mis tareas por plan" : "Planes por estado"}
            subtitle={isOperator ? "Tareas asignadas y su avance" : "Distribución del ciclo de mantenimiento"}
          />
          {isOperator ? (
            <div className="operator-task-list">
              {myTasks.length ? (
                myTasks.map((task) => (
                  <div className="operator-task" key={`${task.planId}-${task.id}`}>
                    <span className={`severity-dot ${task.completed ? "low-dot" : "medium-dot"}`} />
                    <span className="sensor-name">
                      <strong>{task.name}</strong>
                      <small>
                        {task.planId} · {task.system} · {task.operator}
                      </small>
                    </span>
                    <SeverityTag value={task.severity} />
                    <span className={`status-pill ${task.completed ? "status-approved" : "status-draft"}`}>
                      {task.completed ? "Completada" : "Pendiente"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty-state">No tienes tareas asignadas por el momento.</div>
              )}
            </div>
          ) : (
            <>
              <div className="status-overview">
                {completedByStatus.map((item) => (
                  <div className="status-row" key={item.status}>
                    <StatusPill value={item.status} />
                    <span className="status-track">
                      <i style={{ width: `${Math.max(item.count ? 6 : 0, (item.count / maxStatus) * 100)}%` }} />
                    </span>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-complete" /> Planes del alcance de tu rol
                </span>
              </div>
            </>
          )}
        </article>

        <article className="panel">
          <PanelTitle
            title="Estado de equipos"
            subtitle="Temperatura, vibración y presión"
          />
          <div className="sensor-list">
            {sensors.map((sensor) => (
              <div className="sensor-row" key={sensor.equipment}>
                <span
                  className={`severity-dot ${
                    sensor.status === "Estable"
                      ? "low-dot"
                      : sensor.status === "Revisar"
                        ? "medium-dot"
                        : "high-dot"
                  }`}
                />
                <span className="sensor-name">
                  <strong>{sensor.equipment}</strong>
                  <small>
                    {sensor.line} · {sensor.period}
                  </small>
                </span>
                <span className="sensor-values">
                  {sensor.temperature}°C{" "}
                  <small>
                    {sensor.vibration} mm/s · {sensor.pressure} bar
                  </small>
                </span>
                <span
                  className={`severity ${
                    sensor.status === "Estable" ? "low" : sensor.status === "Revisar" ? "medium" : "high"
                  }`}
                >
                  {sensor.status}
                </span>
              </div>
            ))}
          </div>
          <p className="sensor-note">
            Histórico consultable por equipo, línea y periodo. Datos agregados para análisis de alto
            volumen.
          </p>
        </article>
      </section>

      <section className="panel plans-panel">
        <div className="plans-heading">
          <PanelTitle
            title="Planes recientes"
            subtitle="Parámetros de generación, revisión y ejecución"
          />
          <div className="heading-actions">
            <Link className="button button-quiet" to="/reportes">
              Ver reportes
            </Link>
            {!isOperator && (
              <Link className="button button-primary" to="/planes?nuevo=1">
                ＋ Generar plan
              </Link>
            )}
          </div>
        </div>
        <DataTable
          columns={[
            { key: "id", label: "PLAN" },
            { key: "line", label: "LÍNEA" },
            { key: "creator", label: "CREADOR" },
            { key: "createdAt", label: "CREACIÓN" },
            { key: "params.total", label: "TAREAS" },
            { key: "status", label: "ESTADO" },
            { key: "actions", label: "" },
          ]}
          rows={recentPlans}
          sort={sort}
          setSort={setSort}
          empty="No hay planes para esta búsqueda."
          render={(plan) => (
            <tr key={plan.id}>
              <td>
                <strong className="plan-id">{plan.id}</strong>
                <div className="plan-name">{plan.name}</div>
              </td>
              <td>{plan.line}</td>
              <td>{plan.creator}</td>
              <td>{plan.createdAt}</td>
              <td>{plan.params.total}</td>
              <td>
                <StatusPill value={plan.status} />
              </td>
              <td>
                <Link className="table-link" to="/planes">
                  Detalle →
                </Link>
              </td>
            </tr>
          )}
        />
      </section>
    </>
  );
}
