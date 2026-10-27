import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { MaintenanceData, Plan, SessionUser } from "../../types/maintenance";
import { useMaintenance } from "../../data/MaintenanceContext";
import { Dialog, DialogActions, SeverityTag } from "./Shared";
import {
  buildPlanParams,
  suggestTaskSelection,
  validateGenerationParams,
} from "../../utils/maintenanceRules.mjs";

/**
 * Diálogo de generación de planes.
 *
 * Implementa la configuración de parámetros (T12-F) y la generación a partir de
 * tareas seleccionadas (T13-F): la copia de parámetros queda dentro del plan.
 */
export function PlanGeneratorDialog({
  data,
  user,
  close,
  initialLine,
  onGenerated,
}: {
  data: MaintenanceData;
  user: SessionUser;
  close: () => void;
  initialLine?: string;
  onGenerated?: (plan: Plan) => void;
}) {
  const { generatePlan } = useMaintenance();
  const allowedLines =
    user.role === "Técnico"
      ? data.lines.filter((line) => user.lines.includes(line.name))
      : data.lines;
  const [lineName, setLineName] = useState(
    initialLine && allowedLines.some((line) => line.name === initialLine)
      ? initialLine
      : (allowedLines[0]?.name ?? ""),
  );
  const line = allowedLines.find((item) => item.name === lineName) ?? allowedLines[0];
  const authorizedTechnicians = data.technicians.filter((technician) =>
    technician.lines.includes(line?.name ?? ""),
  );
  const [creator, setCreator] = useState(
    user.role === "Técnico"
      ? user.name
      : (authorizedTechnicians[0]?.name ?? ""),
  );
  const [name, setName] = useState("Plan de mantenimiento del ciclo");
  const [systems, setSystems] = useState<string[]>(line?.systems ?? []);
  const [total, setTotal] = useState(4);
  const [preventive, setPreventive] = useState(50);
  const [corrective, setCorrective] = useState(25);
  const [predictive, setPredictive] = useState(25);
  const [balance, setBalance] = useState(90);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const eligible = useMemo(
    () =>
      data.tasks.filter(
        (task) => task.line === line?.name && systems.includes(task.system),
      ),
    [data.tasks, line?.name, systems],
  );
  const chosen = eligible.filter((task) => selected.includes(task.id));
  const mix = preventive + corrective + predictive;
  const actual = chosen.length
    ? {
        preventive: Math.round((chosen.filter((task) => task.type === "Preventivo").length / chosen.length) * 100),
        corrective: Math.round((chosen.filter((task) => task.type === "Correctivo").length / chosen.length) * 100),
        predictive: Math.round((chosen.filter((task) => task.type === "Predictivo").length / chosen.length) * 100),
      }
    : { preventive: 0, corrective: 0, predictive: 0 };

  const params = { total, preventive, corrective, predictive, systems, balance };
  const validation = validateGenerationParams(params, eligible.length);
  const selectionError =
    chosen.length !== total
      ? `Selecciona exactamente ${total} tareas (llevas ${chosen.length}).`
      : "";

  const changeLine = (value: string) => {
    const next = allowedLines.find((item) => item.name === value);
    setLineName(value);
    setSystems(next?.systems ?? []);
    setSelected([]);
    const technicians = data.technicians.filter((item) => item.lines.includes(value));
    setCreator(user.role === "Técnico" ? user.name : (technicians[0]?.name ?? ""));
  };

  const toggleSystem = (system: string, checked: boolean) => {
    const next = checked ? [...systems, system] : systems.filter((item) => item !== system);
    setSystems(next);
    setSelected((current) =>
      current.filter((id) => {
        const task = data.tasks.find((item) => item.id === id);
        return task ? next.includes(task.system) : false;
      }),
    );
  };

  const suggest = () => {
    setSelected(suggestTaskSelection(eligible, params));
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!line) {
      setError("No hay una línea de producción disponible para tu rol.");
      return;
    }
    const errors = [...validation, selectionError].filter(Boolean);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setBusy(true);
    try {
      const plan = await generatePlan({
        name: name.trim(),
        line: line.name,
        process: line.process,
        creator,
        params: buildPlanParams(chosen, { total, preventive, corrective, predictive }),
        tasks: chosen.map((task) => ({ ...task, operator: "Sin asignar", completed: false })),
      });
      onGenerated?.(plan);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Generar plan de mantenimiento"
      subtitle="Configura la mezcla, la cobertura de sistemas y las tareas del ciclo."
      close={close}
      wide
    >
      <form onSubmit={submit}>
        <label>
          Nombre del plan
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <div className="form-row">
          <label>
            Línea de producción
            <select value={lineName} onChange={(event) => changeLine(event.target.value)} required>
              {allowedLines.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Técnico creador autorizado
            <select value={creator} onChange={(event) => setCreator(event.target.value)} required>
              {user.role === "Técnico" ? (
                <option>{user.name}</option>
              ) : (
                authorizedTechnicians.map((technician) => (
                  <option key={technician.id}>{technician.name}</option>
                ))
              )}
            </select>
          </label>
        </div>

        <fieldset className="form-fieldset">
          <legend>Parámetros de generación</legend>
          <div className="form-row three">
            <label>
              Cantidad total
              <input
                type="number"
                min={1}
                max={Math.max(1, eligible.length)}
                value={total}
                onChange={(event) => {
                  setTotal(Number(event.target.value));
                  setSelected([]);
                }}
              />
            </label>
            <label>
              Equilibrio esperado
              <input
                type="number"
                min={1}
                max={100}
                value={balance}
                onChange={(event) => setBalance(Number(event.target.value))}
              />
            </label>
            <div className={`mix-total ${mix === 100 ? "ok" : "bad"}`}>
              Suma de proporciones
              <strong>{mix}%</strong>
            </div>
          </div>
          <div className="form-row three">
            <label>
              Preventivo %
              <input
                type="number"
                min={0}
                max={100}
                value={preventive}
                onChange={(event) => setPreventive(Number(event.target.value))}
              />
            </label>
            <label>
              Correctivo %
              <input
                type="number"
                min={0}
                max={100}
                value={corrective}
                onChange={(event) => setCorrective(Number(event.target.value))}
              />
            </label>
            <label>
              Predictivo %
              <input
                type="number"
                min={0}
                max={100}
                value={predictive}
                onChange={(event) => setPredictive(Number(event.target.value))}
              />
            </label>
          </div>
          <p className="field-label">Cobertura de sistemas y equipos</p>
          <div className="checkbox-grid">
            {(line?.systems ?? []).map((system) => (
              <label className="check-option" key={system}>
                <input
                  type="checkbox"
                  checked={systems.includes(system)}
                  onChange={(event) => toggleSystem(system, event.target.checked)}
                />
                {system}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="picker-heading">
          <p className="field-label">
            Tareas elegibles · {eligible.length} disponibles · {chosen.length}/{total} seleccionadas
          </p>
          <button type="button" className="button button-quiet" onClick={suggest}>
            ✳ Sugerir selección
          </button>
        </div>

        <div className="task-picker">
          {eligible.length ? (
            eligible.map((task) => (
              <label className="task-option" key={task.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, task.id]
                        : current.filter((id) => id !== task.id),
                    )
                  }
                />
                <span>
                  <strong>{task.name}</strong>
                  <small>
                    {task.system} · {task.type} · {task.duration} min
                  </small>
                </span>
                <SeverityTag value={task.severity} />
              </label>
            ))
          ) : (
            <div className="empty-state">
              No hay tareas para la línea y sistemas seleccionados.
            </div>
          )}
        </div>

        <div className="mix-preview">
          <span>
            Mezcla real seleccionada: <strong>{actual.preventive}% prev.</strong> ·{" "}
            <strong>{actual.corrective}% corr.</strong> · <strong>{actual.predictive}% pred.</strong>
          </span>
          <span>
            Cobertura: <strong>{new Set(chosen.map((task) => task.system)).size}</strong> sistemas
          </span>
        </div>

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={busy ? "Generando…" : `Generar plan (${chosen.length})`}
          disabled={busy || Boolean(validation.length) || Boolean(selectionError)}
        />
      </form>
    </Dialog>
  );
}
