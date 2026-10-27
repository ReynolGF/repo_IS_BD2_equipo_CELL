import { useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { Metric, PanelTitle, SeverityTag, StatusPill } from "../components/maintenance/Shared";
import { visiblePlansFor } from "../utils/maintenanceRules.mjs";
import type { Intervention, Plan, PlanTask } from "../types/maintenance";

/** Ejecución de planes, registro de intervenciones y reinspecciones. */
export function ExecutionPage() {
  const { user } = useAuth();
  const { data, query, savePlan, recordIntervention, updateIntervention, notify } = useMaintenance();

  const plans = useMemo(
    () =>
      (data && user ? visiblePlansFor(user, data.plans) : []).filter((plan) =>
        ["Aprobado", "En ejecución", "Finalizado"].includes(plan.status),
      ),
    [data, user],
  );

  if (!data || !user) {
    return (
      <PageState>
        <span />
      </PageState>
    );
  }

  const isOperator = user.role === "Operario";
  const canExecute = user.role !== "Jefe de planta";
  const visiblePlans = plans.filter((plan) =>
    `${plan.id} ${plan.name} ${plan.line} ${plan.creator} ${plan.tasks.map((task) => task.operator).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const myTasks = visiblePlans.flatMap((plan) =>
    plan.tasks.filter((task) => !isOperator || task.operator === user.name),
  );
  const active = visiblePlans.filter((plan) => plan.status !== "Finalizado");
  const planIds = new Set(visiblePlans.map((plan) => plan.id));
  const interventions = data.interventions.filter((item) => {
    const plan = data.plans.find((candidate) => candidate.id === item.planId);
    if (!plan || !planIds.has(plan.id)) return false;
    if (isOperator) return item.operator === user.name;
    return `${item.task} ${item.operator} ${item.planId} ${item.result}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  const markTask = async (
    plan: Plan,
    task: PlanTask,
    completed: boolean,
    reinspection = false,
  ) => {
    const updatedTasks = plan.tasks.map((item) =>
      item.id === task.id ? { ...item, completed: reinspection ? item.completed : completed } : item,
    );
    const allCompleted = updatedTasks.every((item) => item.completed);
    let status = plan.status;
    if (plan.status === "Aprobado") status = "En ejecución";
    if (!reinspection) {
      if (allCompleted) status = "Finalizado";
      else if (plan.status === "Finalizado") status = "En ejecución";
    }
    await savePlan({ ...plan, status, tasks: updatedTasks });
    await recordIntervention({
      planId: plan.id,
      task: task.name,
      operator: task.operator,
      date: new Date().toLocaleString("es", { dateStyle: "short", timeStyle: "short" }),
      notes: reinspection
        ? "Solicita reinspección manual y apoyo técnico adicional."
        : "Intervención registrada desde el plan asignado.",
      result: reinspection
        ? "Reinspección solicitada · pendiente"
        : completed
          ? "Completada"
          : "Pendiente",
      reinspection,
    });
  };

  const assignSupport = async (item: Intervention) => {
    const plan = data.plans.find((candidate) => candidate.id === item.planId);
    const technician = data.technicians.find(
      (candidate) =>
        candidate.name !== item.operator && (!plan || candidate.lines.includes(plan.line)),
    );
    if (!technician) {
      notify("No hay un técnico de apoyo disponible para esa línea.", "error");
      return;
    }
    await updateIntervention({
      ...item,
      supportTechnician: technician.name,
      result: "Reinspección asignada · pendiente",
    });
    notify(`Reinspección asignada a ${technician.name}.`);
  };

  const recordReinspection = async (item: Intervention) => {
    const result = window.prompt(
      "Resultado de la reinspección manual:",
      "Equipo inspeccionado; operación segura.",
    );
    if (!result?.trim()) return;
    await updateIntervention({
      ...item,
      result: `Reinspección completada · ${result.trim()}`,
    });
    notify("Resultado de reinspección guardado en el historial.");
  };

  return (
    <PageState>
      <section className="metric-grid metric-grid-compact">
        <Metric
          label="Planes en ejecución"
          value={String(active.length).padStart(2, "0")}
          hint="Asignados a tu alcance"
          color="mint"
        />
        <Metric
          label="Tareas asignadas"
          value={String(myTasks.length).padStart(2, "0")}
          hint="Según tu rol y líneas"
          color="blue"
        />
        <Metric
          label="Completadas"
          value={String(myTasks.filter((task) => task.completed).length).padStart(2, "0")}
          hint={`${myTasks.length ? Math.round((myTasks.filter((task) => task.completed).length / myTasks.length) * 100) : 0}% de avance`}
          color="yellow"
        />
        <Metric
          label="Reinspecciones"
          value={String(interventions.filter((item) => item.reinspection).length).padStart(2, "0")}
          hint="Solicitudes registradas"
          color="coral"
        />
      </section>

      <section className="execution-layout">
        <div className="panel">
          <div className="panel-toolbar">
            <PanelTitle
              title={isOperator ? "Mis planes y tareas" : "Planes en ejecución"}
              subtitle="Registra cada intervención y solicita apoyo para reinspecciones."
            />
          </div>
          {visiblePlans.length ? (
            visiblePlans.map((plan) => {
              const tasks = plan.tasks.filter((task) => !isOperator || task.operator === user.name);
              return (
                <article className="execution-plan" key={plan.id}>
                  <div className="execution-plan-head">
                    <div>
                      <span className="plan-id">
                        {plan.id} · {plan.line}
                      </span>
                      <h2>{plan.name}</h2>
                      <small className="cell-hint">
                        Operario: {plan.tasks[0]?.operator ?? "Sin asignar"} · Revisor:{" "}
                        {plan.reviewer ?? "pendiente"}
                      </small>
                    </div>
                    <StatusPill value={plan.status} />
                  </div>
                  <div className="task-checklist">
                    {tasks.map((task) => (
                      <div className="execution-task" key={task.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            disabled={!canExecute}
                            onChange={(event) => void markTask(plan, task, event.target.checked)}
                          />
                          <span>
                            <strong>{task.name}</strong>
                            <small>
                              {task.system} · {task.operator} · {task.type}
                            </small>
                          </span>
                        </label>
                        <SeverityTag value={task.severity} />
                        {canExecute && (
                          <button
                            className="table-link"
                            onClick={() => void markTask(plan, task, task.completed, true)}
                          >
                            Solicitar reinspección
                          </button>
                        )}
                      </div>
                    ))}
                    {!tasks.length && (
                      <div className="empty-state">No tienes tareas asignadas en este plan.</div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">No hay planes en ejecución para tu alcance.</div>
          )}
        </div>

        <aside className="panel intervention-panel">
          <PanelTitle
            title="Historial de intervenciones"
            subtitle="Registro persistente por plan ejecutado."
          />
          {interventions.length ? (
            interventions.map((item) => (
              <div className="intervention-item" key={item.id}>
                <span className={`severity-dot ${item.reinspection ? "medium-dot" : "low-dot"}`} />
                <div>
                  <strong>{item.task}</strong>
                  <small>
                    {item.operator} · {item.date} · {item.planId}
                    {item.supportTechnician ? ` · Apoyo: ${item.supportTechnician}` : ""}
                  </small>
                  <p>{item.notes}</p>
                  <span className="cell-hint">{item.result}</span>
                  {item.reinspection && canExecute && (
                    <>
                      <button
                        className="table-link support-link"
                        onClick={() => void assignSupport(item)}
                      >
                        Asignar técnico de apoyo →
                      </button>
                      {item.supportTechnician && (
                        <button
                          className="table-link support-link"
                          onClick={() => void recordReinspection(item)}
                        >
                          Registrar resultado manual →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">Sin intervenciones registradas para este alcance.</div>
          )}
        </aside>
      </section>
    </PageState>
  );
}
