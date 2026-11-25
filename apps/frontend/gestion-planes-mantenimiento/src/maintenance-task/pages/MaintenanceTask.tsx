import { Metric } from "../components/Metric.tsx";
import type { Task } from "../models/task.ts";
import { DataTable } from "../components/DataTable.tsx";
import { SeverityTag } from "../components/SeverityTag.tsx";
import { useState } from "react";
import { database } from "../../database-seed/database.ts";
import { MaintenanceTaskService } from "../services/MaintenanceTaskService.ts";

export const MaintenanceTask = () => {
  const maintenanceTaskService = new MaintenanceTaskService();

  const allowedLines = [
    { id: "1", name: "Línea 1" },
    { id: "2", name: "Línea 2" },
    { id: "3", name: "Línea 3" },
  ];
  const [tasks, setTasks] = useState<Task[]>(database.tasks); // Replace with actual data fetching logic
  const [line, setLine] = useState("Todas las líneas");
  const [sort, setSort] = useState({ key: "id", asc: true });
  const [type, setType] = useState("Todos");
  const [severity, setSeverity] = useState("Todas");
  const visibleTasks: Task[] = database.tasks; // Replace with actual filtering logic
  return (
    <>
      <section className="metric-grid metric-grid-compact mb-4 grid grid-cols-4 gap-[14px] max-[1240px]:grid-cols-2 max-[720px]:gap-2.5 max-[520px]:grid-cols-1">
        <Metric
          label="Tareas del banco"
          value={String(visibleTasks.length).padStart(2, "0")}
          hint={`${visibleTasks.filter((task) => task.severity === "Alta").length} de criticidad alta`}
          color="mint"
        />
        <Metric
          label="Preventivas"
          value={String(
            visibleTasks.filter((task) => task.type === "Preventivo").length,
          ).padStart(2, "0")}
          hint="Rutinas programadas"
          color="blue"
        />
        <Metric
          label="Correctivas"
          value={String(
            visibleTasks.filter((task) => task.type === "Correctivo").length,
          ).padStart(2, "0")}
          hint="Intervenciones por falla"
          color="yellow"
        />
      </section>
      <button className="button min-h-[38px] inline-flex items-center justify-center gap-[7px] rounded-full border border-line-strong px-4 text-[11.5px] font-semibold leading-none whitespace-nowrap transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:transform-none button-primary font-bold">
        ＋ Agregar tarea
      </button>
      <div className="filters">
        <label className="filter-field">
          Línea
          <select
            value={line}
            onChange={(event) => setLine(event.target.value)}
          >
            <option>Todas las líneas</option>
            {allowedLines.map((item) => (
              <option key={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          Tipo
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option>Todos</option>
            <option>Preventivo</option>
            <option>Correctivo</option>
            <option>Predictivo</option>
          </select>
        </label>
        <label className="filter-field">
          Criticidad
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option>Todas</option>
            <option>Alta</option>
            <option>Media</option>
            <option>Baja</option>
          </select>
        </label>
        <span className="filter-count">{tasks.length} tareas</span>
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
        rows={tasks}
        sort={sort}
        setSort={setSort}
        empty="No hay tareas que coincidan con la búsqueda."
        render={(task: Task) => (
          <tr key={task.id}>
            <td className="plan-id">{task.id}</td>
            <td>
              <strong>{task.name}</strong>
              <small className="cell-hint">{task.duration} min estimados</small>
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
              <div className="row-actions">
                <button>Editar</button>
                <button className="danger-link">Eliminar</button>
              </div>
            </td>
          </tr>
        )}
      />
    </>
  );
};
