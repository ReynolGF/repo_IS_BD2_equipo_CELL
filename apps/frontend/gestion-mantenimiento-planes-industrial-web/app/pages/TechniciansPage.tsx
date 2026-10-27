import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, Dialog, DialogActions, Metric, PanelTitle } from "../components/maintenance/Shared";
import { hasPermission } from "../utils/permissions.mjs";
import type { MaintenanceData, Technician } from "../types/maintenance";

/** Catálogo de técnicos, especialidades y autorizaciones por línea (T08-F). */
export function TechniciansPage() {
  const { user } = useAuth();
  const { data, query, deleteTechnician } = useMaintenance();
  const [sort, setSort] = useState({ key: "name", asc: true });
  const [dialog, setDialog] = useState<Technician | "new" | null>(null);

  const canManage = user ? hasPermission(user.role, "catalogs:manage") : false;
  const technicians =
    data?.technicians.filter((technician) =>
      `${technician.id} ${technician.name} ${technician.specialty} ${technician.lines.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];

  return (
    <PageState>
      {data && user && (
        <>
          <section className="metric-grid metric-grid-compact">
            <Metric
              label="Técnicos"
              value={String(data.technicians.length).padStart(2, "0")}
              hint="Personal de mantenimiento"
              color="mint"
            />
            <Metric
              label="Especialidades"
              value={String(new Set(data.technicians.map((item) => item.specialty)).size).padStart(2, "0")}
              hint="Cobertura técnica de la planta"
              color="blue"
            />
            <Metric
              label="Validadores"
              value={String(data.technicians.filter((item) => item.canValidate).length).padStart(2, "0")}
              hint="Pueden validar planes de sus líneas"
              color="yellow"
            />
            <Metric
              label="Planes creados"
              value={String(data.plans.length).padStart(2, "0")}
              hint="Trazabilidad por técnico"
              color="coral"
            />
          </section>

          <section className="panel">
            <div className="panel-toolbar">
              <PanelTitle
                title="Técnicos autorizados"
                subtitle="Especialidad y líneas donde pueden generar o validar planes."
              />
              {canManage && (
                <button className="button button-primary" onClick={() => setDialog("new")}>
                  ＋ Registrar técnico
                </button>
              )}
            </div>

            <DataTable
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "TÉCNICO" },
                { key: "specialty", label: "ESPECIALIDAD" },
                { key: "lines", label: "LÍNEAS AUTORIZADAS" },
                { key: "canValidate", label: "AUTORIZACIÓN" },
                { key: "plans", label: "PLANES CREADOS" },
                { key: "actions", label: "ACCIONES" },
              ]}
              rows={technicians}
              sort={sort}
              setSort={setSort}
              empty="No hay técnicos para la búsqueda."
              render={(technician) => {
                const created = data.plans.filter((plan) => plan.creator === technician.name).length;
                return (
                  <tr key={technician.id}>
                    <td className="plan-id">{technician.id}</td>
                    <td>
                      <strong>{technician.name}</strong>
                    </td>
                    <td>{technician.specialty}</td>
                    <td>
                      <div className="tag-list">
                        {technician.lines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${technician.canValidate ? "status-approved" : "status-draft"}`}
                      >
                        {technician.canValidate ? "Puede validar" : "Solo genera"}
                      </span>
                    </td>
                    <td>{created}</td>
                    <td>
                      {canManage ? (
                        <div className="row-actions">
                          <button onClick={() => setDialog(technician)}>Editar</button>
                          <button
                            className="danger-link"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar a ${technician.name}?`)) {
                                void deleteTechnician(technician.id).catch(() => {});
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
                );
              }}
            />
          </section>

          {dialog && (
            <TechnicianDialog
              data={data}
              technician={dialog === "new" ? undefined : dialog}
              close={() => setDialog(null)}
            />
          )}
        </>
      )}
    </PageState>
  );
}

function TechnicianDialog({
  data,
  technician,
  close,
}: {
  data: MaintenanceData;
  technician?: Technician;
  close: () => void;
}) {
  const { saveTechnician } = useMaintenance();
  const [name, setName] = useState(technician?.name ?? "");
  const [specialty, setSpecialty] = useState(technician?.specialty ?? "");
  const [lines, setLines] = useState<string[]>(technician?.lines ?? []);
  const [canValidate, setCanValidate] = useState(technician?.canValidate ?? false);
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
      setError("Selecciona al menos una línea autorizada.");
      return;
    }
    setBusy(true);
    try {
      await saveTechnician({
        id: technician?.id ?? "",
        name,
        specialty,
        lines,
        canValidate,
      });
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el técnico.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={technician ? `Editar ${technician.name}` : "Registrar técnico"}
      subtitle="Define su especialidad y las líneas donde puede generar o validar planes."
      close={close}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <label>
            Nombre completo
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Especialidad
            <input
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              required
              placeholder="Ej. Mantenimiento mecánico"
            />
          </label>
        </div>

        <p className="field-label">Líneas autorizadas para generar planes</p>
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

        <label className="switch-row">
          <input
            type="checkbox"
            checked={canValidate}
            onChange={(event) => setCanValidate(event.target.checked)}
          />
          <span>
            <strong>Autorizado para validar planes</strong>
            <small>La jefatura mantiene la aprobación final; esta marca habilita la validación técnica.</small>
          </span>
        </label>

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={busy ? "Guardando…" : technician ? "Guardar cambios" : "Registrar técnico"}
          disabled={busy}
        />
      </form>
    </Dialog>
  );
}
