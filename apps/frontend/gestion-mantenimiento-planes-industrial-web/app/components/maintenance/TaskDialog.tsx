import { useState } from "react";
import type { FormEvent } from "react";
import type { MaintenanceData, NewTaskInput, SessionUser, Task } from "../../types/maintenance";
import { useMaintenance } from "../../data/MaintenanceContext";
import { Dialog, DialogActions, SeverityTag } from "./Shared";
import {
  findSimilarTasks,
  isDuplicateTask,
  validateTaskDraft,
} from "../../utils/maintenanceRules.mjs";

/**
 * Alta y edición de tareas del banco (T10-F). Antes de guardar aplica la regla
 * de duplicados (T11-F) y, si hay coincidencia exacta, deriva la solicitud al
 * administrador en lugar de crear el duplicado.
 */
export function TaskDialog({
  data,
  user,
  task,
  close,
}: {
  data: MaintenanceData;
  user: SessionUser;
  task?: Task;
  close: () => void;
}) {
  const { createTask, updateTask, requestDuplicate } = useMaintenance();
  const allowedLines =
    user.role === "Técnico"
      ? data.lines.filter((line) => user.lines.includes(line.name))
      : data.lines;
  const initialLine = task?.line ?? allowedLines[0]?.name ?? "";
  const initialLineData = allowedLines.find((line) => line.name === initialLine);
  const [name, setName] = useState(task?.name ?? "");
  const [line, setLine] = useState(initialLine);
  const [system, setSystem] = useState(task?.system ?? initialLineData?.systems[0] ?? "");
  const [type, setType] = useState<Task["type"]>(task?.type ?? "Preventivo");
  const [severity, setSeverity] = useState<Task["severity"]>(task?.severity ?? "Media");
  const [duration, setDuration] = useState(task?.duration ?? 30);
  const [author, setAuthor] = useState(
    task?.author ?? (user.role === "Técnico" ? user.name : (data.technicians[0]?.name ?? user.name)),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lineData = data.lines.find((item) => item.name === line);
  const draft: NewTaskInput = {
    name,
    line,
    system,
    type,
    severity,
    duration,
    author,
  };
  const errors = validateTaskDraft(draft);
  const duplicate = isDuplicateTask(draft, data.tasks, task?.id);
  const similar = findSimilarTasks(draft, data.tasks, task?.id);

  const changeLine = (value: string) => {
    setLine(value);
    const next = allowedLines.find((item) => item.name === value);
    setSystem(next?.systems[0] ?? "");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setBusy(true);
    try {
      if (duplicate && !task) {
        if (!reason.trim()) {
          setError("Indica el motivo para que un administrador revise el duplicado.");
          setBusy(false);
          return;
        }
        await requestDuplicate({ draft, reason, requestedBy: user.name });
        close();
        return;
      }
      if (task) {
        await updateTask({ ...task, ...draft });
      } else {
        await createTask(draft);
      }
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la tarea.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={task ? `Editar ${task.id}` : "Agregar tarea al banco"}
      subtitle="Clasifícala por línea, sistema, tipo y criticidad."
      close={close}
    >
      <form onSubmit={submit}>
        <label>
          Nombre de la tarea
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Ej. Inspeccionar sello de bomba"
          />
        </label>

        <div className="form-row">
          <label>
            Línea
            <select value={line} onChange={(event) => changeLine(event.target.value)} required>
              {allowedLines.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Sistema o equipo
            <select value={system} onChange={(event) => setSystem(event.target.value)} required>
              {(lineData?.systems ?? []).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Tipo de mantenimiento
            <select value={type} onChange={(event) => setType(event.target.value as Task["type"])}>
              <option>Preventivo</option>
              <option>Correctivo</option>
              <option>Predictivo</option>
            </select>
          </label>
          <label>
            Nivel de criticidad
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Task["severity"])}
            >
              <option>Alta</option>
              <option>Media</option>
              <option>Baja</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Duración estimada (minutos)
            <input
              type="number"
              min="1"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Técnico creador
            <select value={author} onChange={(event) => setAuthor(event.target.value)} required>
              {user.role === "Técnico" ? (
                <option>{user.name}</option>
              ) : (
                data.technicians.map((technician) => (
                  <option key={technician.id}>{technician.name}</option>
                ))
              )}
            </select>
          </label>
        </div>

        {similar.length > 0 && (
          <div className="inline-notice warning">
            <strong>Coincidencias encontradas</strong>
            <ul className="notice-list">
              {similar.map((item) => (
                <li key={item.id}>
                  {item.id} · {item.name} · {item.system} · {item.line}{" "}
                  <SeverityTag value={item.severity} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {duplicate && !task && (
          <div className="duplicate-box">
            <strong>Duplicado exacto detectado</strong>
            <p>
              Ya existe una tarea con el mismo nombre, sistema y línea. Un administrador debe
              autorizarla desde la pestaña <b>Duplicados</b>.
            </p>
            <label>
              Motivo de la solicitud
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explica por qué se necesita esta tarea adicional…"
              />
            </label>
          </div>
        )}

        {task?.duplicateApprovedBy && (
          <div className="inline-notice info">
            Duplicado autorizado por {task.duplicateApprovedBy}:{" "}
            {task.duplicateJustification ?? "sin justificación registrada"}.
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <DialogActions
          close={close}
          submit={
            busy
              ? "Guardando…"
              : duplicate && !task
                ? "Solicitar revisión"
                : task
                  ? "Guardar cambios"
                  : "Guardar tarea"
          }
          disabled={busy}
        />
      </form>
    </Dialog>
  );
}
