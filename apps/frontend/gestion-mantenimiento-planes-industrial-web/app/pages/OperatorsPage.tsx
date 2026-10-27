import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Dialog, DialogActions, Metric, PanelTitle, StatusPill } from "../components/maintenance/Shared";
import { hasPermission } from "../utils/permissions.mjs";
import type { MaintenanceData, Operator } from "../types/maintenance";

const SHIFTS = ["Mañana", "Tarde", "Noche"];

/** Catálogo de operarios, turnos y líneas asignadas (T09-F). */
export function OperatorsPage() {
  const { user } = useAuth();
  const { data, query, setQuery, deleteOperator } = useMaintenance();
  const navigate = useNavigate();
  const [sort, setSort] = useState({ key: "name", asc: true });
  const [dialog, setDialog] = useState<Operator | "new" | null>(null);

  const canManage = user ? hasPermission(user.role, "catalogs:manage") : false;
  const operators =
    data?.operators.filter((operator) =>
      `${operator.id} ${operator.name} ${operator.shift} ${operator.lines.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];

  const activePlanFor = (name: string) =>
    data?.plans.find(
      (plan) =>
        ["Aprobado", "En ejecución"].includes(plan.status) &&
        plan.tasks.some((task) => task.operator === name),
    );

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Operarios"
              value={String(data.operators.length).padStart(2, "0")}
              hint="Personal registrado"
              color="mint"
            />
            <Metric
              label="Turnos"
              value={String(new Set(data.operators.map((item) => item.shift)).size).padStart(2, "0")}
              hint="Cobertura de la planta"
              color="blue"
            />
            <Metric
              label="Con plan activo"
              value={String(
                data.operators.filter((operator) => activePlanFor(operator.name)).length,
              ).padStart(2, "0")}
              hint="Una sola asignación por operario"
              color="yellow"
            />
            <Metric
              label="Disponibles"
              value={String(
                data.operators.filter((operator) => !activePlanFor(operator.name)).length,
              ).padStart(2, "0")}
              hint="Pueden recibir una nueva asignación"
              color="coral"
            />
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <PanelTitle
                title="Operarios y planes asignados"
                subtitle="Cada operario conserva turno, líneas y una única asignación activa."
              />
              {canManage && (
                <button className="button button-primary" onClick={() => setDialog("new")}>
                  ＋ Registrar operario
                </button>
              )}
            </div>

            <DataTable
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "OPERARIO" },
                { key: "age", label: "EDAD" },
                { key: "shift", label: "TURNO" },
                { key: "lines", label: "LÍNEAS" },
                { key: "plan", label: "PLAN ASIGNADO" },
                { key: "actions", label: "ACCIONES" },
              ]}
              rows={operators}
              sort={sort}
              setSort={setSort}
              empty="No hay operarios para la búsqueda."
              render={(operator) => {
                const plan = activePlanFor(operator.name);
                return (
                  <tr key={operator.id}>
                    <td className="plan-id">{operator.id}</td>
                    <td>
                      <strong>{operator.name}</strong>
                    </td>
                    <td>{operator.age}</td>
                    <td>{operator.shift}</td>
                    <td>{operator.lines.join(", ")}</td>
                    <td>
                      {plan ? (
                        <>
                          <strong className="plan-id">{plan.id}</strong>
                          <div className="cell-hint">{plan.name}</div>
                          <StatusPill value={plan.status} />
                        </>
                      ) : (
                        <span className="status-pill status-draft">Sin asignación</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="table-link"
                          onClick={() => {
                            setQuery(operator.name);
                            navigate("/ejecucion");
                          }}
                        >
                          Ver ejecución →
                        </button>
                        {canManage && (
                          <>
                            <button onClick={() => setDialog(operator)}>Editar</button>
                            <button
                              className="danger-link"
                              onClick={() => {
                                if (window.confirm(`¿Eliminar a ${operator.name}?`)) {
                                  void deleteOperator(operator.id).catch(() => {});
                                }
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }}
            />
          </section>

          {dialog && (
            <OperatorDialog
              data={data}
              operator={dialog === "new" ? undefined : dialog}
              close={() => setDialog(null)}
            />
          )}
        </>
      )}
    </PageState>
  );
}

function OperatorDialog({
  data,
  operator,
  close,
}: {
  data: MaintenanceData;
  operator?: Operator;
  close: () => void;
}) {
  const { saveOperator } = useMaintenance();
  const [name, setName] = useState(operator?.name ?? "");
  const [age, setAge] = useState(operator?.age ?? 30);
  const [shift, setShift] = useState(operator?.shift ?? SHIFTS[0]);
  const [lines, setLines] = useState<string[]>(operator?.lines ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleLine = (line: string, checked: boolean) => {
    setLines((current) =>
      checked ? [...current, line] : current.filter((item) => item !== line),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!lines.length) {
      setError("Selecciona al menos una línea de trabajo.");
      return;
    }
    setBusy(true);
    try {
      await saveOperator({
        id: operator?.id ?? "",
        name,
        age,
        shift,
        lines,
      });
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el operario.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={operator ? `Editar ${operator.name}` : "Registrar operario"}
      subtitle="El perfil conserva turno y líneas; la asignación de plan se controla al aprobar."
      close={close}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <label>
            Nombre completo
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Edad
            <input
              type="number"
              min={18}
              max={80}
              value={age}
              onChange={(event) => setAge(Number(event.target.value))}
              required
            />
          </label>
        </div>
        <label>
          Turno
          <select value={shift} onChange={(event) => setShift(event.target.value)}>
            {SHIFTS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <p className="field-label">Líneas donde trabaja</p>
        <div className="checkbox-grid">
          {data.lines.map((line) => (
            <label className="check-option" key={line.id}>
              <input
                type="checkbox"
                checked={lines.includes(line.name)}
                onChange={(event) => toggleLine(line.name, event.target.checked)}
              />
              {line.name}
            </label>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={busy ? "Guardando…" : operator ? "Guardar cambios" : "Registrar operario"}
          disabled={busy}
        />
      </form>
    </Dialog>
  );
}
