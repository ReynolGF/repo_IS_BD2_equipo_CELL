import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { Dialog, DialogActions, Metric, PanelTitle } from "../components/maintenance/Shared";
import { hasPermission } from "../utils/permissions.mjs";
import type { Equipment, MaintenanceData, ProductionLine, SessionUser } from "../types/maintenance";

/** Catálogo de líneas de producción, sistemas y equipos (T07-F). */
export function LinesPage() {
  const { user } = useAuth();
  const { data, query, deleteLine } = useMaintenance();
  const [dialog, setDialog] = useState<ProductionLine | "new" | null>(null);

  const canManage = user ? hasPermission(user.role, "catalogs:manage") : false;
  const visibleLines =
    data?.lines.filter((line) =>
      `${line.id} ${line.name} ${line.process} ${line.systems.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Líneas"
              value={String(data.lines.length).padStart(2, "0")}
              hint="Procesos productivos activos"
              color="mint"
            />
            <Metric
              label="Equipos"
              value={String(data.lines.reduce((total, line) => total + line.equipment.length, 0)).padStart(2, "0")}
              hint="Inventario asociado a las líneas"
              color="blue"
            />
            <Metric
              label="Sistemas"
              value={String(new Set(data.lines.flatMap((line) => line.systems)).size).padStart(2, "0")}
              hint="Cobertura del banco de tareas"
              color="yellow"
            />
            <Metric
              label="Operarios"
              value={String(data.operators.length).padStart(2, "0")}
              hint="Personal con líneas asignadas"
              color="coral"
            />
          </section>

          <section className="panel lines-panel">
            <div className="panel-toolbar">
              <PanelTitle
                title="Líneas y equipos"
                subtitle="Cada línea conserva identificador, nombre, proceso, sistemas y equipos."
              />
              {canManage && (
                <button className="button button-primary" onClick={() => setDialog("new")}>
                  ＋ Nueva línea
                </button>
              )}
            </div>

            <div className="line-grid">
              {visibleLines.map((line) => {
                const lineOperators = data.operators.filter((operator) =>
                  operator.lines.includes(line.name),
                ).length;
                const lineTasks = data.tasks.filter((task) => task.line === line.name).length;
                return (
                  <article className="panel line-card" key={line.id}>
                    <div className="line-card-head">
                      <span className="plant-icon">{line.name.slice(0, 1)}</span>
                      <span className="plan-id">{line.id}</span>
                    </div>
                    <h2>{line.name}</h2>
                    <p>{line.process}</p>
                    <div className="line-stat-row">
                      <span>
                        <strong>{line.equipment.length}</strong> equipos
                      </span>
                      <span>
                        <strong>{lineOperators}</strong> operarios
                      </span>
                      <span>
                        <strong>{lineTasks}</strong> tareas
                      </span>
                    </div>
                    <h3>Sistemas cubiertos</h3>
                    <div className="tag-list">
                      {line.systems.map((system) => (
                        <span key={system}>{system}</span>
                      ))}
                    </div>
                    <h3 className="equipment-title">Equipos</h3>
                    <div className="equipment-list">
                      {line.equipment.length ? (
                        line.equipment.map((equipment) => {
                          const sensor = data.sensors.find(
                            (reading) => reading.equipment === equipment.name,
                          );
                          return (
                            <div className="equipment-row" key={equipment.id}>
                              <span
                                className={`severity-dot ${
                                  !sensor
                                    ? "low-dot"
                                    : sensor.status === "Estable"
                                      ? "low-dot"
                                      : sensor.status === "Revisar"
                                        ? "medium-dot"
                                        : "high-dot"
                                }`}
                              />
                              <span className="equipment-name">
                                <strong>{equipment.name}</strong>
                                <small>
                                  {equipment.system}
                                  {sensor ? ` · ${sensor.temperature}°C` : " · sin lectura"}
                                </small>
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="cell-hint">Sin equipos registrados.</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="line-actions">
                        <button className="table-link" onClick={() => setDialog(line)}>
                          Editar línea y equipos
                        </button>
                        <button
                          className="table-link danger-link"
                          onClick={() => {
                            if (window.confirm(`¿Eliminar la línea ${line.name}?`)) {
                              void deleteLine(line.id).catch(() => {});
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {!visibleLines.length && <div className="empty-state">No hay líneas para la búsqueda.</div>}
          </section>

          {dialog && (
            <LineDialog
              data={data}
              user={user}
              line={dialog === "new" ? undefined : dialog}
              close={() => setDialog(null)}
            />
          )}
        </>
      )}
    </PageState>
  );
}

function emptyEquipment(systems: string[]): Equipment[] {
  return [{ id: "", name: "", system: systems[0] ?? "" }];
}

/** Formulario de línea con edición dinámica de equipos. */
function LineDialog({
  data,
  user,
  line,
  close,
}: {
  data: MaintenanceData;
  user: SessionUser;
  line?: ProductionLine;
  close: () => void;
}) {
  const { saveLine } = useMaintenance();
  const [name, setName] = useState(line?.name ?? "");
  const [process, setProcess] = useState(line?.process ?? "");
  const [systems, setSystems] = useState((line?.systems ?? []).join(", "));
  const [equipment, setEquipment] = useState<Equipment[]>(
    line?.equipment.length ? line.equipment : emptyEquipment(line?.systems ?? []),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const systemList = systems.split(",").map((item) => item.trim()).filter(Boolean);

  const updateEquipment = (index: number, patch: Partial<Equipment>) => {
    setEquipment((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !process.trim() || !systemList.length) {
      setError("Completa el nombre, el proceso y al menos un sistema.");
      return;
    }
    setBusy(true);
    try {
      await saveLine({
        id: line?.id ?? "",
        name: name.trim(),
        process: process.trim(),
        systems: systemList,
        equipment: equipment
          .filter((item) => item.name.trim())
          .map((item) => ({ ...item, system: item.system || systemList[0] })),
      });
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la línea.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={line ? `Editar ${line.name}` : "Nueva línea de producción"}
      subtitle="Define el proceso, los sistemas y los equipos que la componen."
      close={close}
      wide={user.role === "Administrador"}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <label>
            Nombre de la línea
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Proceso productivo
            <input
              value={process}
              onChange={(event) => setProcess(event.target.value)}
              required
              placeholder="Ej. Envasado de producto"
            />
          </label>
        </div>
        <label>
          Sistemas (separados por coma)
          <input
            value={systems}
            onChange={(event) => setSystems(event.target.value)}
            required
            placeholder="Bombas, Válvulas, Bandas"
          />
        </label>

        <fieldset className="form-fieldset">
          <legend>Equipos de la línea</legend>
          <div className="equipment-editor">
            {equipment.map((item, index) => (
              <div className="equipment-edit-row" key={`${item.id}-${index}`}>
                <input
                  value={item.name}
                  onChange={(event) => updateEquipment(index, { name: event.target.value })}
                  placeholder="Nombre del equipo"
                  aria-label="Nombre del equipo"
                />
                <select
                  value={item.system}
                  onChange={(event) => updateEquipment(index, { system: event.target.value })}
                  aria-label="Sistema del equipo"
                >
                  {systemList.map((system) => (
                    <option key={system}>{system}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Quitar equipo"
                  onClick={() =>
                    setEquipment((current) =>
                      current.length > 1 ? current.filter((_, position) => position !== index) : current,
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button button-quiet add-equipment"
            onClick={() => setEquipment((current) => [...current, ...emptyEquipment(systemList)])}
          >
            ＋ Agregar equipo
          </button>
        </fieldset>

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={busy ? "Guardando…" : line ? "Guardar cambios" : "Crear línea"}
          disabled={busy}
        />
      </form>
    </Dialog>
  );
}
