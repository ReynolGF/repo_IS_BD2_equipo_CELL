import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Metric, PanelTitle, SeverityTag, StatusPill } from "../components/maintenance/Shared";
import { PlanGeneratorDialog } from "../components/maintenance/PlanGeneratorDialog";
import { PlanReviewDialog } from "../components/maintenance/PlanReviewDialog";
import { visiblePlansFor } from "../utils/maintenanceRules.mjs";
import { hasPermission } from "../utils/permissions.mjs";
import type { Plan, PlanStatus } from "../types/maintenance";

const STATUSES: (PlanStatus | "Todos")[] = [
  "Todos",
  "Borrador",
  "En revisión",
  "Aprobado",
  "En ejecución",
  "Finalizado",
  "Rechazado",
];

/** Pantalla de planes: filtros, generación, revisión, detalle y arranque. */
export function PlansPage() {
  const { user } = useAuth();
  const { data, query, savePlan } = useMaintenance();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState({ key: "createdAt", asc: false });
  const [line, setLine] = useState("Todas las líneas");
  const [status, setStatus] = useState<PlanStatus | "Todos">("Todos");
  const [generator, setGenerator] = useState(false);
  const [review, setReview] = useState<Plan | null>(null);
  const [detail, setDetail] = useState<Plan | null>(null);

  const plans = useMemo(
    () => (data && user ? visiblePlansFor(user, data.plans) : []),
    [data, user],
  );

  useEffect(() => {
    if (!data) return;
    if (searchParams.get("nuevo") === "1") setGenerator(true);
    if (searchParams.get("revisar") === "1") {
      const first = data.plans.find((plan) => plan.status === "En revisión");
      if (first) setReview(first);
    }
  }, [data, searchParams]);

  const closeDialog = () => {
    setGenerator(false);
    setReview(null);
    setDetail(null);
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  };

  const scopedPlans = plans.filter(
    (plan) =>
      (line === "Todas las líneas" || plan.line === line) &&
      (status === "Todos" || plan.status === status) &&
      `${plan.id} ${plan.name} ${plan.creator} ${plan.line} ${plan.reviewer ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Planes del alcance"
              value={String(plans.length).padStart(2, "0")}
              hint={user.role === "Técnico" ? user.lines.join(" · ") : "Toda la planta"}
              color="mint"
            />
            <Metric
              label="Pendientes de revisión"
              value={String(plans.filter((plan) => plan.status === "En revisión").length).padStart(2, "0")}
              hint="Requieren decisión de la jefatura"
              color="yellow"
            />
            <Metric
              label="En ejecución"
              value={String(plans.filter((plan) => plan.status === "En ejecución").length).padStart(2, "0")}
              hint="Con operario asignado"
              color="blue"
            />
            <Metric
              label="Finalizados"
              value={String(plans.filter((plan) => plan.status === "Finalizado").length).padStart(2, "0")}
              hint="Historial consultable"
              color="coral"
            />
          </section>

          <section className="panel plans-panel">
            <div className="plans-heading">
              <PanelTitle
                title="Planes de mantenimiento"
                subtitle="Parámetros de generación, revisión y ejecución"
              />
              <div className="heading-actions">
                {hasPermission(user.role, "plans:review") && (
                  <button
                    className="button button-quiet"
                    onClick={() => {
                      const first = plans.find((plan) => plan.status === "En revisión");
                      if (first) setReview(first);
                    }}
                  >
                    Validar plan
                  </button>
                )}
                {hasPermission(user.role, "plans:create") && (
                  <button className="button button-primary" onClick={() => setGenerator(true)}>
                    ＋ Generar plan
                  </button>
                )}
              </div>
            </div>

            <div className="filters">
              <label className="filter-field">
                Línea
                <select value={line} onChange={(event) => setLine(event.target.value)}>
                  <option>Todas las líneas</option>
                  {(user.role === "Técnico"
                    ? data.lines.filter((item) => user.lines.includes(item.name))
                    : data.lines
                  ).map((item) => (
                    <option key={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                Estado
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PlanStatus | "Todos")}
                >
                  {STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <span className="filter-count">{scopedPlans.length} planes</span>
            </div>

            <DataTable
              columns={[
                { key: "id", label: "PLAN" },
                { key: "line", label: "LÍNEA" },
                { key: "creator", label: "CREADOR" },
                { key: "createdAt", label: "CREACIÓN" },
                { key: "params.total", label: "TAREAS" },
                { key: "params.balance", label: "EQUILIBRIO" },
                { key: "status", label: "ESTADO" },
                { key: "actions", label: "ACCIONES" },
              ]}
              rows={scopedPlans}
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
                  <td>
                    {plan.params.total}
                    <small className="cell-hint">
                      {plan.params.preventive}% prev. · {plan.params.corrective}% corr. ·{" "}
                      {plan.params.predictive}% pred.
                    </small>
                  </td>
                  <td>
                    {plan.params.balance}%
                    <small className="cell-hint">{plan.params.systems.join(" · ")}</small>
                  </td>
                  <td>
                    <StatusPill value={plan.status} />
                    {plan.reviewer && <small className="cell-hint">Revisor: {plan.reviewer}</small>}
                  </td>
                  <td>
                    <div className="row-actions">
                      {plan.status === "En revisión" && hasPermission(user.role, "plans:review") && (
                        <button onClick={() => setReview(plan)}>Validar</button>
                      )}
                      {plan.status === "Aprobado" && hasPermission(user.role, "plans:start") && (
                        <button onClick={() => void startPlan(plan)}>Iniciar</button>
                      )}
                      {plan.status === "Borrador" &&
                        (user.role === "Administrador" || plan.creator === user.name) && (
                          <button onClick={() => void sendToReview(plan)}>Enviar a revisión</button>
                        )}
                      <button onClick={() => setDetail(plan)}>Detalle</button>
                    </div>
                  </td>
                </tr>
              )}
            />
          </section>

          {generator && (
            <PlanGeneratorDialog
              data={data}
              user={user}
              close={closeDialog}
              initialLine={line !== "Todas las líneas" ? line : undefined}
            />
          )}
          {review && <PlanReviewDialog plan={review} data={data} user={user} close={closeDialog} />}
          {detail && <PlanDetail plan={detail} close={closeDialog} />}
        </>
      )}
    </PageState>
  );

  async function startPlan(plan: Plan) {
    try {
      await savePlan({ ...plan, status: "En ejecución" });
    } catch {
      // El contexto ya publica el error en un aviso; se evita una promesa rechazada sin manejar.
    }
  }

  async function sendToReview(plan: Plan) {
    try {
      await savePlan({ ...plan, status: "En revisión" });
    } catch {
      // El contexto ya publica el error en un aviso.
    }
  }
}

function PlanDetail({ plan, close }: { plan: Plan; close: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="create-modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <span className="modal-kicker">DETALLE DEL PLAN</span>
            <h2>
              {plan.id} · {plan.name}
            </h2>
            <p>
              {plan.line} · {plan.process} · creador {plan.creator} · {plan.createdAt}
            </p>
          </div>
          <button className="modal-close" onClick={close} aria-label="Cerrar" type="button">
            ×
          </button>
        </div>

        <div className="detail-grid">
          <div>
            <span className="detail-label">Estado</span>
            <StatusPill value={plan.status} />
          </div>
          <div>
            <span className="detail-label">Revisor</span>
            <strong>{plan.reviewer ?? "Pendiente"}</strong>
          </div>
          <div>
            <span className="detail-label">Fecha de validación</span>
            <strong>{plan.validatedAt ?? "—"}</strong>
          </div>
          <div>
            <span className="detail-label">Equilibrio</span>
            <strong>{plan.params.balance}%</strong>
          </div>
          <div>
            <span className="detail-label">Mezcla objetivo</span>
            <strong>
              {plan.params.target.preventive}% / {plan.params.target.corrective}% /{" "}
              {plan.params.target.predictive}%
            </strong>
          </div>
          <div>
            <span className="detail-label">Mezcla real</span>
            <strong>
              {plan.params.preventive}% / {plan.params.corrective}% / {plan.params.predictive}%
            </strong>
          </div>
        </div>

        <div className="criteria-box">
          <span>ⓘ</span>
          <div>
            <strong>Observaciones</strong>
            <small>{plan.observations ?? "Sin observaciones registradas."}</small>
            {plan.rejectionCriteria && (
              <>
                <strong className="criteria-title">Criterios de devolución</strong>
                <small>{plan.rejectionCriteria}</small>
              </>
            )}
          </div>
        </div>

        <div className="review-task-list">
          {plan.tasks.map((task) => (
            <div className="review-task" key={task.id}>
              <span className="plan-id">{task.id}</span>
              <span className="review-task-name">
                <strong>{task.name}</strong>
                <small>
                  {task.system} · {task.operator} · {task.completed ? "Completada" : "Pendiente"}
                </small>
              </span>
              <SeverityTag value={task.severity} />
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="button button-quiet" onClick={close}>
            Cerrar
          </button>
        </div>
      </section>
    </div>
  );
}
