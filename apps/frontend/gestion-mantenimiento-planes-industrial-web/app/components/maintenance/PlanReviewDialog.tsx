import { useState } from "react";
import type { FormEvent } from "react";
import type { MaintenanceData, Plan, SessionUser } from "../../types/maintenance";
import { useMaintenance } from "../../data/MaintenanceContext";
import { Dialog, DialogActions, SeverityTag } from "./Shared";
import { findOperatorConflict } from "../../utils/maintenanceRules.mjs";

/**
 * Revisión de planes por la jefatura de planta (T15-F).
 * Permite aprobar con asignación de operario o rechazar/devolver con criterios.
 */
export function PlanReviewDialog({
  plan,
  data,
  user,
  close,
}: {
  plan: Plan;
  data: MaintenanceData;
  user: SessionUser;
  close: () => void;
}) {
  const { savePlan, notify } = useMaintenance();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const lineOperators = data.operators.filter((operator) => operator.lines.includes(plan.line));
  const [operator, setOperator] = useState(
    plan.tasks.find((task) => task.operator !== "Sin asignar")?.operator ??
      lineOperators.find(
        (candidate) => !findOperatorConflict(candidate.name, plan.id, data.plans),
      )?.name ??
      "",
  );
  const [observations, setObservations] = useState(plan.observations ?? "");
  const [criteria, setCriteria] = useState(plan.rejectionCriteria ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const conflict = operator ? findOperatorConflict(operator, plan.id, data.plans) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (decision === "approve") {
      if (!operator) {
        setError("Selecciona el operario responsable del plan.");
        return;
      }
      if (conflict) {
        setError(`${operator} ya tiene asignado el plan ${conflict.id}.`);
        return;
      }
    } else if (!criteria.trim()) {
      setError("Indica los criterios para devolver o rechazar el plan.");
      return;
    }
    setBusy(true);
    try {
      if (decision === "approve") {
        await savePlan({
          ...plan,
          status: "Aprobado",
          reviewer: user.name,
          validatedAt: new Date().toISOString().slice(0, 10),
          observations: observations.trim() || "Plan aprobado sin observaciones.",
          tasks: plan.tasks.map((task) => ({ ...task, operator })),
        });
        notify(`${plan.id} aprobado y asignado a ${operator}.`);
      } else {
        await savePlan({
          ...plan,
          status: "Rechazado",
          reviewer: user.name,
          validatedAt: new Date().toISOString().slice(0, 10),
          observations: observations.trim() || "Plan devuelto por la jefatura.",
          rejectionCriteria: criteria.trim(),
          tasks: plan.tasks.map((task) => ({ ...task, operator: "Sin asignar" })),
        });
        notify(`${plan.id} devuelto con criterios para una nueva versión.`);
      }
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la revisión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Revisar ${plan.id}`}
      subtitle="La decisión guarda revisor, fecha y observaciones."
      close={close}
      wide
    >
      <div className="review-summary">
        <div>
          <span className="plan-id">{plan.id}</span>
          <h3>{plan.name}</h3>
          <p>
            {plan.line} · {plan.process} · creador {plan.creator} · {plan.createdAt}
          </p>
        </div>
        <div className="review-mix">
          <strong>{plan.params.total} tareas</strong>
          <span>
            {plan.params.preventive}% prev. · {plan.params.corrective}% corr. ·{" "}
            {plan.params.predictive}% pred.
          </span>
          <span>Sistemas: {plan.params.systems.join(", ")}</span>
        </div>
      </div>

      <div className="review-task-list">
        {plan.tasks.map((task) => (
          <div className="review-task" key={task.id}>
            <span className="plan-id">{task.id}</span>
            <span className="review-task-name">
              <strong>{task.name}</strong>
              <small>
                {task.system} · {task.type} · {task.duration} min
              </small>
            </span>
            <SeverityTag value={task.severity} />
          </div>
        ))}
      </div>

      <form onSubmit={submit}>
        <div className="decision-tabs">
          <button
            type="button"
            className={decision === "approve" ? "selected" : ""}
            onClick={() => setDecision("approve")}
          >
            ✓ Aprobar plan
          </button>
          <button
            type="button"
            className={decision === "reject" ? "selected reject" : "reject"}
            onClick={() => setDecision("reject")}
          >
            ↩ Devolver con criterios
          </button>
        </div>

        {decision === "approve" ? (
          <>
            <label>
              Operario responsable
              <select value={operator} onChange={(event) => setOperator(event.target.value)} required>
                <option value="">Selecciona un operario</option>
                {lineOperators.map((candidate) => {
                  const assigned = findOperatorConflict(candidate.name, plan.id, data.plans);
                  return (
                    <option key={candidate.id} value={candidate.name} disabled={Boolean(assigned)}>
                      {candidate.name} · {candidate.shift}
                      {assigned ? ` · ya tiene ${assigned.id}` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {conflict && (
              <div className="form-warning">
                {operator} ya tiene asignado el plan {conflict.id}. La regla permite un solo plan
                activo por operario.
              </div>
            )}
            <label>
              Observaciones de validación
              <textarea
                rows={3}
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Criterios revisados, ajustes solicitados…"
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Criterios para la nueva versión
              <textarea
                rows={3}
                required
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                placeholder="Ej. Incluir tareas predictivas y cubrir el sistema Compresores."
              />
            </label>
            <label>
              Observaciones de la jefatura
              <textarea
                rows={2}
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Motivo del rechazo o devolución…"
              />
            </label>
          </>
        )}

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={
            busy
              ? "Guardando…"
              : decision === "approve"
                ? "Aprobar y asignar"
                : "Devolver plan"
          }
          disabled={busy || (decision === "approve" ? Boolean(conflict) || !operator : !criteria.trim())}
        />
      </form>
    </Dialog>
  );
}
