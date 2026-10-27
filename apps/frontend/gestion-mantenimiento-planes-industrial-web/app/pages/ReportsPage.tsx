import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useMaintenance } from "../data/MaintenanceContext";
import { PageState } from "../components/maintenance/PageState";
import { DataTable, PanelTitle } from "../components/maintenance/Shared";
import { ReportCell, ReportVisual } from "../components/maintenance/Reports";
import type { ReportBar } from "../components/maintenance/Reports";
import {
  buildAutomaticPlansReport,
  buildReviewerReport,
  executionStats,
  listReviewers,
  visiblePlansFor,
} from "../utils/maintenanceRules.mjs";
import { hasPermission } from "../utils/permissions.mjs";
import type { MaintenanceData, Plan, Severity } from "../types/maintenance";
import type { Column } from "../components/maintenance/Shared";

const REPORTS = [
  {
    name: "Planes automáticos por línea",
    description:
      "Planes automáticos con creador, fecha de creación y parámetros usados, filtrables por línea.",
  },
  {
    name: "Tareas más ejecutadas",
    description:
      "Conteo de tareas ejecutadas en planes finalizados, clasificado por criticidad y sistema.",
  },
  {
    name: "Validaciones por revisor",
    description:
      "Validaciones del revisor con fecha y observaciones; permite filtrar por revisor.",
  },
  {
    name: "Desempeño por plan y criticidad",
    description:
      "Cumplimiento de tareas por criticidad para cada operario y plan.",
  },
  {
    name: "Equilibrio entre líneas",
    description:
      "Distribución de tareas por sistema y criticidad, con verificación de equilibrio.",
  },
  {
    name: "Criticidad, cumplimiento y reinspecciones",
    description:
      "Correlación descriptiva entre criticidad, cumplimiento por turno e intervenciones con reinspección.",
  },
];

type Row = Record<string, unknown> & { __key: string };
type ReportResult = {
  columns: Column[];
  rows: Row[];
  bars: ReportBar[];
  footnote?: string;
};

/** Reportes funcionales con filtros por línea/revisor y columnas ordenables. */
export function ReportsPage() {
  const { user } = useAuth();
  const { data, query } = useMaintenance();
  const [selected, setSelected] = useState(0);
  const [line, setLine] = useState("Todas las líneas");
  const [reviewer, setReviewer] = useState("Todos los revisores");
  const [sort, setSort] = useState({ key: "", asc: true });

  if (!data || !user) {
    return (
      <PageState>
        <span />
      </PageState>
    );
  }

  const scopedPlans = visiblePlansFor(user, data.plans);
  const lineOptions =
    user.role === "Técnico"
      ? data.lines.filter((item) => user.lines.includes(item.name))
      : data.lines;
  const reviewers = listReviewers(scopedPlans);
  const result = buildReport(selected, scopedPlans, data, line, reviewer, query);
  const stats = executionStats(scopedPlans);

  return (
    <section className="reports-layout">
      <aside className="panel report-menu">
        <p className="nav-group">REPORTES FUNCIONALES</p>
        {REPORTS.map((report, index) => (
          <button
            className={selected === index ? "selected" : ""}
            key={report.name}
            onClick={() => {
              setSelected(index);
              setSort({ key: "", asc: true });
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {report.name}
          </button>
        ))}
        <div className="report-menu-foot">
          <strong>{stats.rate}%</strong>
          <span>cumplimiento del alcance</span>
        </div>
      </aside>

      <article className="panel report-content">
        <div className="report-title">
          <div>
            <span className="eyebrow">
              REPORTE {String(selected + 1).padStart(2, "0")} · {scopedPlans.length} PLANES
            </span>
            <h2>{REPORTS[selected].name}</h2>
            <p>{REPORTS[selected].description}</p>
          </div>
          {hasPermission(user.role, "reports:view") && (
            <button className="button button-primary" onClick={() => window.print()}>
              ⇩ PDF
            </button>
          )}
        </div>

        <div className="report-filters">
          <label>
            Línea de producción
            <select
              value={line}
              onChange={(event) => {
                setLine(event.target.value);
                setSort({ key: "", asc: true });
              }}
            >
              <option>Todas las líneas</option>
              {lineOptions.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {selected === 2 && (
            <label>
              Revisor
              <select
                value={reviewer}
                onChange={(event) => {
                  setReviewer(event.target.value);
                  setSort({ key: "", asc: true });
                }}
              >
                <option>Todos los revisores</option>
                {reviewers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
          <span>Los encabezados de columna ordenan los resultados.</span>
        </div>

        <ReportVisual bars={result.bars} />

        <DataTable
          columns={result.columns}
          rows={result.rows}
          sort={sort}
          setSort={setSort}
          className="report-table"
          empty="No hay información para los filtros seleccionados."
          render={(row) => (
            <tr key={row.__key}>
              {result.columns.map((column) => (
                <td key={column.key}>
                  <ReportCell column={column.key} value={row[column.key]} />
                </td>
              ))}
            </tr>
          )}
        />
        {result.footnote && <p className="report-footnote">{result.footnote}</p>}
      </article>
    </section>
  );
}

function buildReport(
  index: number,
  allPlans: Plan[],
  data: MaintenanceData,
  line: string,
  reviewer: string,
  query: string,
): ReportResult {
  const plans = allPlans.filter((plan) => line === "Todas las líneas" || plan.line === line);
  const search = query.toLowerCase();
  const matches = (value: unknown) => String(value ?? "").toLowerCase().includes(search);

  if (index === 0) {
    const rows = buildAutomaticPlansReport(plans)
      .filter((row) =>
        matches(`${row.id} ${row.name} ${row.line} ${row.creator} ${row.systems}`),
      )
      .map((row) => ({
        ...row,
        __key: row.id,
      }));
    return {
      columns: [
        { key: "id", label: "PLAN" },
        { key: "line", label: "LÍNEA" },
        { key: "creator", label: "CREADOR" },
        { key: "createdAt", label: "FECHA DE CREACIÓN" },
        { key: "total", label: "TOTAL TAREAS" },
        { key: "mix", label: "DISTRIBUCIÓN" },
        { key: "systems", label: "SISTEMAS" },
        { key: "balance", label: "EQUILIBRIO" },
      ],
      rows,
      bars: [...new Set(plans.map((plan) => plan.line))].map((name) => ({
        label: name,
        value: plans.filter((plan) => plan.line === name).length,
        detail: "planes automáticos",
      })),
    };
  }

  if (index === 1) {
    const finalPlans = plans.filter((plan) => plan.status === "Finalizado");
    const executed = new Set(
      finalPlans.flatMap((plan) =>
        plan.tasks.filter((task) => task.completed).map((task) => task.id),
      ),
    );
    const rows = data.tasks
      .filter(
        (task) =>
          executed.has(task.id) &&
          (line === "Todas las líneas" || task.line === line) &&
          matches(`${task.name} ${task.system} ${task.line} ${task.author}`),
      )
      .sort((a, b) => b.timesExecuted - a.timesExecuted)
      .map((task) => ({
        name: task.name,
        timesExecuted: task.timesExecuted,
        severity: task.severity,
        system: task.system,
        line: task.line,
        author: task.author,
        __key: task.id,
      }));
    return {
      columns: [
        { key: "name", label: "TAREA" },
        { key: "timesExecuted", label: "EJECUCIONES" },
        { key: "severity", label: "CRITICIDAD" },
        { key: "system", label: "SISTEMA" },
        { key: "line", label: "LÍNEA" },
        { key: "author", label: "TÉCNICO CREADOR" },
      ],
      rows,
      bars: rows.slice(0, 5).map((row) => ({
        label: String(row.name),
        value: Number(row.timesExecuted),
        detail: `${row.severity} · ${row.system}`,
      })),
    };
  }

  if (index === 2) {
    const rows = buildReviewerReport(plans, reviewer)
      .filter((row) => matches(`${row.id} ${row.name} ${row.line} ${row.reviewer} ${row.observations}`))
      .map((row) => ({ ...row, __key: row.id }));
    return {
      columns: [
        { key: "id", label: "PLAN" },
        { key: "name", label: "NOMBRE" },
        { key: "line", label: "LÍNEA" },
        { key: "reviewer", label: "REVISOR" },
        { key: "validatedAt", label: "FECHA DE VALIDACIÓN" },
        { key: "observations", label: "OBSERVACIONES" },
        { key: "status", label: "ESTADO" },
      ],
      rows,
      bars: reviewersForBars(plans, reviewer),
    };
  }

  if (index === 3) {
    const rows = plans.flatMap((plan) =>
      (["Alta", "Media", "Baja"] as Severity[])
        .map((severity) => {
          const tasks = plan.tasks.filter((task) => task.severity === severity);
          const completed = tasks.filter((task) => task.completed).length;
          return {
            planId: plan.id,
            operator: [...new Set(tasks.map((task) => task.operator))].join(", ") || "—",
            severity,
            tasks: tasks.length,
            completed,
            rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
            __key: `${plan.id}-${severity}`,
          };
        })
        .filter((row) => row.tasks && matches(`${row.planId} ${row.operator} ${row.severity}`)),
    );
    return {
      columns: [
        { key: "planId", label: "PLAN" },
        { key: "operator", label: "OPERARIO" },
        { key: "severity", label: "CRITICIDAD" },
        { key: "tasks", label: "TAREAS ASIGNADAS" },
        { key: "completed", label: "COMPLETADAS" },
        { key: "rate", label: "CUMPLIMIENTO" },
      ],
      rows,
      bars: severityBars(plans),
    };
  }

  if (index === 4) {
    const lineNames = [...new Set(plans.map((plan) => plan.line))];
    const rows = lineNames.flatMap((name) => {
      const linePlans = plans.filter((plan) => plan.line === name);
      const systems = [...new Set(linePlans.flatMap((plan) => plan.tasks.map((task) => task.system)))];
      const balance = Math.round(
        linePlans.reduce((sum, plan) => sum + plan.params.balance, 0) / Math.max(1, linePlans.length),
      );
      return systems.flatMap((system) =>
        (["Alta", "Media", "Baja"] as Severity[])
          .map((severity) => {
            const tasks = linePlans.flatMap((plan) =>
              plan.tasks.filter((task) => task.system === system && task.severity === severity),
            );
            return {
              line: name,
              system,
              severity,
              tasks: tasks.length,
              balance,
              criteria: balance >= 80 ? "Cumplido" : "Revisar",
              __key: `${name}-${system}-${severity}`,
            };
          })
          .filter(
            (row) =>
              row.tasks > 0 && matches(`${row.line} ${row.system} ${row.severity}`),
          ),
      );
    });
    return {
      columns: [
        { key: "line", label: "LÍNEA" },
        { key: "system", label: "SISTEMA" },
        { key: "severity", label: "CRITICIDAD" },
        { key: "tasks", label: "TAREAS" },
        { key: "balance", label: "EQUILIBRIO" },
        { key: "criteria", label: "CRITERIO CUMPLIDO" },
      ],
      rows,
      bars: lineNames.map((name) => {
        const linePlans = plans.filter((plan) => plan.line === name);
        return {
          label: name,
          value: Math.round(
            linePlans.reduce((sum, plan) => sum + plan.params.balance, 0) /
              Math.max(1, linePlans.length),
          ),
          detail: "equilibrio promedio",
          percent: true,
        };
      }),
    };
  }

  const lineNames = [...new Set(plans.map((plan) => plan.line))];
  const rows = lineNames.flatMap((name) => {
    const linePlans = plans.filter((plan) => plan.line === name);
    const lineTasks = linePlans.flatMap((plan) =>
      plan.tasks.map((task) => ({ ...task, planId: plan.id })),
    );
    const correlation = correlationFor(lineTasks);
    return (["Alta", "Media", "Baja"] as Severity[]).flatMap((severity) => {
      const tasks = lineTasks.filter((task) => task.severity === severity);
      if (!tasks.length) return [];
      return [...new Set(tasks.map((task) => task.operator))].map((operator) => {
        const assigned = tasks.filter((task) => task.operator === operator);
        const completed = assigned.filter((task) => task.completed).length;
        const rate = Math.round((completed / assigned.length) * 100);
        const shift = data.operators.find((item) => item.name === operator)?.shift;
        const shiftTasks = lineTasks.filter(
          (task) => data.operators.find((item) => item.name === task.operator)?.shift === shift,
        );
        const turnAverage = shiftTasks.length
          ? Math.round((shiftTasks.filter((task) => task.completed).length / shiftTasks.length) * 100)
          : 0;
        const pendingTask = assigned.find((task) => !task.completed) ?? assigned[0];
        return {
          line: name,
          severity,
          operator,
          rate,
          turnAverage,
          correlation,
          task: pendingTask?.name ?? "—",
          author: pendingTask?.author ?? "—",
          reinspection: data.interventions.some(
            (item) => item.task === pendingTask?.name && item.reinspection,
          )
            ? "Solicitada"
            : "No",
          planId: pendingTask?.planId ?? "—",
          __key: `${name}-${severity}-${operator}`,
        };
      });
    });
  }).filter((row) => matches(`${row.line} ${row.operator} ${row.severity} ${row.task}`));

  return {
    columns: [
      { key: "line", label: "LÍNEA" },
      { key: "severity", label: "CRITICIDAD" },
      { key: "operator", label: "OPERARIO" },
      { key: "rate", label: "CUMPLIMIENTO" },
      { key: "turnAverage", label: "PROMEDIO DEL TURNO" },
      { key: "correlation", label: "CORRELACIÓN" },
      { key: "task", label: "TAREA CON INCUMPLIMIENTO" },
      { key: "author", label: "TÉCNICO CREADOR" },
      { key: "reinspection", label: "REINSPECCIÓN" },
      { key: "planId", label: "PLAN" },
    ],
    rows,
    bars: severityBars(plans),
    footnote:
      "La criticidad se compara con el cumplimiento promedio del turno y el registro de reinspección de la tarea pendiente.",
  };
}

function reviewersForBars(plans: Plan[], reviewer: string): ReportBar[] {
  const reviewers = listReviewers(plans).filter(
    (name) => reviewer === "Todos los revisores" || name === reviewer,
  );
  return reviewers.map((name) => ({
    label: name,
    value: plans.filter((plan) => plan.reviewer === name).length,
    detail: "planes validados",
  }));
}

function severityBars(plans: Plan[]): ReportBar[] {
  return (["Alta", "Media", "Baja"] as Severity[]).map((severity) => {
    const tasks = plans.flatMap((plan) => plan.tasks).filter((task) => task.severity === severity);
    const completed = tasks.filter((task) => task.completed).length;
    return {
      label: `Criticidad ${severity.toLowerCase()}`,
      value: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      detail: `${completed}/${tasks.length} tareas completadas`,
      percent: true,
    };
  });
}

function correlationFor(tasks: Plan["tasks"]): string {
  const groups = new Map<string, { severity: number; rate: number }>();
  for (const task of tasks) {
    const key = `${task.severity}-${task.operator}`;
    const current = groups.get(key) ?? {
      severity: task.severity === "Alta" ? 3 : task.severity === "Media" ? 2 : 1,
      rate: 0,
    };
    current.rate = task.completed ? 100 : 0;
    groups.set(key, current);
  }
  const values = [...groups.values()];
  if (values.length < 2) return "N/D";
  const meanX = values.reduce((sum, value) => sum + value.severity, 0) / values.length;
  const meanY = values.reduce((sum, value) => sum + value.rate, 0) / values.length;
  const numerator = values.reduce(
    (sum, value) => sum + (value.severity - meanX) * (value.rate - meanY),
    0,
  );
  const denominator = Math.sqrt(
    values.reduce((sum, value) => sum + (value.severity - meanX) ** 2, 0) *
      values.reduce((sum, value) => sum + (value.rate - meanY) ** 2, 0),
  );
  return denominator ? (numerator / denominator).toFixed(2) : "N/D";
}
