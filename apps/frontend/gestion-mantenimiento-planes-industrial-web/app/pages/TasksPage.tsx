import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Metric, PanelTitle, SeverityTag } from "../components/maintenance/Shared";
import { TaskDialog } from "../components/maintenance/TaskDialog";
import { filterTasks, findSimilarTasks } from "../utils/maintenanceRules.mjs";
import { hasPermission } from "../utils/permissions.mjs";
import type { DuplicateRequest, Task } from "../types/maintenance";

/** Banco de tareas y bandeja de revisión de duplicados. */
export function TasksPage() {
  const { user } = useAuth();
  const { data, query, deleteTask } = useMaintenance();
  const [tab, setTab] = useState<"banco" | "duplicados">("banco");
  const [line, setLine] = useState("Todas las líneas");
  const [type, setType] = useState("Todos");
  const [severity, setSeverity] = useState("Todas");
  const [sort, setSort] = useState({ key: "id", asc: true });
  const [dialog, setDialog] = useState<Task | "new" | null>(null);

  const canCreate = user ? hasPermission(user.role, "tasks:create") : false;
  const canManage = user ? hasPermission(user.role, "tasks:edit") : false;
  const canReview = user ? hasPermission(user.role, "tasks:review") : false;
  const allowedLines =
    data && user?.role === "Técnico"
      ? data.lines.filter((item) => user.lines.includes(item.name))
      : (data?.lines ?? []);
  const visibleTasks = useMemo(
    () =>
      (data?.tasks ?? []).filter(
        (task) => user?.role !== "Técnico" || user.lines.includes(task.line),
      ),
    [data, user],
  );
  const filtered = filterTasks(visibleTasks, {
    query,
    line,
    type,
    severity,
  });
  const pending = data?.duplicateRequests.filter((request) => request.status === "Pendiente") ?? [];
  const history = data?.duplicateRequests.filter((request) => request.status !== "Pendiente") ?? [];

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Tareas del banco"
              value={String(visibleTasks.length).padStart(2, "0")}
              hint={`${visibleTasks.filter((task) => task.severity === "Alta").length} de criticidad alta`}
              color="mint"
            />
            <Metric
              label="Preventivas"
              value={String(visibleTasks.filter((task) => task.type === "Preventivo").length).padStart(2, "0")}
              hint="Rutinas programadas"
              color="blue"
            />
            <Metric
              label="Correctivas"
              value={String(visibleTasks.filter((task) => task.type === "Correctivo").length).padStart(2, "0")}
              hint="Intervenciones por falla"
              color="yellow"
            />
            <Metric
              label="Duplicados pendientes"
              value={String(pending.length).padStart(2, "0")}
              hint="Requieren revisión administrativa"
              color="coral"
            />
          </section>

          <section className="panel">
            <div className="panel-toolbar tabs-toolbar">
              <div className="tabs">
                <button
                  className={tab === "banco" ? "selected" : ""}
                  onClick={() => setTab("banco")}
                  type="button"
                >
                  Banco de tareas
                  <span>{visibleTasks.length}</span>
                </button>
                {canReview && (
                  <button
                    className={tab === "duplicados" ? "selected" : ""}
                    onClick={() => setTab("duplicados")}
                    type="button"
                  >
                    Duplicados
                    {pending.length > 0 && <span className="tab-alert">{pending.length}</span>}
                  </button>
                )}
              </div>
              {tab === "banco" && canCreate && (
                <button className="button button-primary" onClick={() => setDialog("new")}>
                  ＋ Agregar tarea
                </button>
              )}
              {tab === "duplicados" && (
                <span className="table-count">{pending.length} solicitudes pendientes</span>
              )}
            </div>

            {tab === "banco" && (
              <>
                <div className="filters">
                  <label className="filter-field">
                    Línea
                    <select value={line} onChange={(event) => setLine(event.target.value)}>
                      <option>Todas las líneas</option>
                      {allowedLines.map((item) => (
                        <option key={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    Tipo
                    <select value={type} onChange={(event) => setType(event.target.value)}>
                      <option>Todos</option>
                      <option>Preventivo</option>
                      <option>Correctivo</option>
                      <option>Predictivo</option>
                    </select>
                  </label>
                  <label className="filter-field">
                    Criticidad
                    <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                      <option>Todas</option>
                      <option>Alta</option>
                      <option>Media</option>
                      <option>Baja</option>
                    </select>
                  </label>
                  <span className="filter-count">{filtered.length} tareas</span>
                </div>

                <DataTable
                  columns={[
                    { key: "id", label: "ID" },
                    { key: "name", label: "TAREA" },
                    { key: "line", label: "LÍNEA" },
                    { key: "system", label: "SISTEMA / EQUIPO" },
                    { key: "type", label: "TIPO" },
                    { key: "severity", label: "CRITICIDAD" },
                    { key: "author", label: "TÉCNICO CREADOR" },
                    { key: "timesExecuted", label: "EJECUCIONES" },
                    { key: "actions", label: "ACCIONES" },
                  ]}
                  rows={filtered}
                  sort={sort}
                  setSort={setSort}
                  empty="No hay tareas que coincidan con la búsqueda."
                  render={(task) => (
                    <tr key={task.id}>
                      <td className="plan-id">{task.id}</td>
                      <td>
                        <strong>{task.name}</strong>
                        <small className="cell-hint">{task.duration} min estimados</small>
                        {task.duplicateApprovedBy && (
                          <small className="cell-hint duplicate-hint">
                            Duplicado autorizado por {task.duplicateApprovedBy}
                          </small>
                        )}
                      </td>
                      <td>{task.line}</td>
                      <td>{task.system}</td>
                      <td>{task.type}</td>
                      <td>
                        <SeverityTag value={task.severity} />
                      </td>
                      <td>{task.author}</td>
                      <td>{task.timesExecuted}</td>
                      <td>
                        {canManage ? (
                          <div className="row-actions">
                            <button onClick={() => setDialog(task)}>Editar</button>
                            <button
                              className="danger-link"
                              onClick={() => {
                                if (window.confirm(`¿Eliminar la tarea ${task.id}?`)) {
                                  void deleteTask(task.id).catch(() => {});
                                }
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <span className="cell-hint">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  )}
                />
              </>
            )}

            {tab === "duplicados" && (
              <div className="duplicate-panel">
                <PanelTitle
                  title="Solicitudes de duplicado"
                  subtitle="El administrador decide si la coincidencia se autoriza o se rechaza."
                />
                {pending.length ? (
                  pending.map((request) => (
                    <DuplicateCard
                      key={request.id}
                      request={request}
                      reviewer={user.name}
                      similar={findSimilarTasks(request.draft, data.tasks)}
                    />
                  ))
                ) : (
                  <div className="empty-state">No hay solicitudes pendientes de revisión.</div>
                )}

                <h3 className="section-subtitle">Historial de revisiones</h3>
                <DataTable
                  columns={[
                    { key: "id", label: "SOLICITUD" },
                    { key: "draft.name", label: "TAREA" },
                    { key: "draft.line", label: "LÍNEA" },
                    { key: "requestedBy", label: "SOLICITADA POR" },
                    { key: "status", label: "DECISIÓN" },
                    { key: "reviewedBy", label: "REVISOR" },
                    { key: "reviewedAt", label: "FECHA" },
                    { key: "reviewNotes", label: "NOTAS" },
                  ]}
                  rows={history}
                  sort={sort}
                  setSort={setSort}
                  empty="Sin revisiones anteriores."
                  render={(request) => (
                    <tr key={request.id}>
                      <td className="plan-id">{request.id}</td>
                      <td>{request.draft.name}</td>
                      <td>{request.draft.line}</td>
                      <td>{request.requestedBy}</td>
                      <td>
                        <span
                          className={`status-pill ${request.status === "Aprobada" ? "status-approved" : "status-rejected"}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td>{request.reviewedBy ?? "—"}</td>
                      <td>{request.reviewedAt ?? "—"}</td>
                      <td>{request.reviewNotes ?? "—"}</td>
                    </tr>
                  )}
                />
              </div>
            )}
          </section>

          {dialog && (
            <TaskDialog
              data={data}
              user={user}
              task={dialog === "new" ? undefined : dialog}
              close={() => setDialog(null)}
            />
          )}
        </>
      )}
    </PageState>
  );
}

/** Tarjeta de decisión para una solicitud de duplicado pendiente. */
function DuplicateCard({
  request,
  reviewer,
  similar,
}: {
  request: DuplicateRequest;
  reviewer: string;
  similar: Task[];
}) {
  const { reviewDuplicate } = useMaintenance();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const decide = async (status: "Aprobada" | "Rechazada") => {
    setError("");
    if (status === "Rechazada" && !notes.trim()) {
      setError("Indica el motivo del rechazo.");
      return;
    }
    setBusy(true);
    try {
      await reviewDuplicate({ id: request.id, status, reviewer, notes: notes.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la decisión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="duplicate-card">
      <div className="duplicate-head">
        <div>
          <span className="plan-id">{request.id}</span>
          <h3>{request.draft.name}</h3>
          <p>
            {request.draft.line} · {request.draft.system} · {request.draft.type} ·{" "}
            {request.draft.duration} min
          </p>
        </div>
        <SeverityTag value={request.draft.severity} />
      </div>
      <p className="duplicate-reason">
        <strong>Motivo:</strong> {request.reason}
      </p>
      <small className="cell-hint">
        Solicitada por {request.requestedBy} · {request.requestedAt}
      </small>
      {similar.length > 0 && (
        <div className="inline-notice warning">
          Coincide con:{" "}
          {similar.map((task) => `${task.id} (${task.name})`).join(", ")}.
        </div>
      )}
      <label>
        Notas de revisión
        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Justificación de la decisión…"
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      <div className="duplicate-actions">
        <button
          className="button button-quiet"
          disabled={busy}
          onClick={() => void decide("Rechazada")}
        >
          Rechazar
        </button>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => void decide("Aprobada")}
        >
          Aprobar duplicado
        </button>
      </div>
    </article>
  );
}
