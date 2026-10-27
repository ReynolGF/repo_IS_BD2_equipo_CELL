import type { Severity } from "../../types/maintenance";
import { SeverityTag, StatusPill } from "./Shared";
import type { PlanStatus } from "../../types/maintenance";

export type ReportBar = { label: string; value: number; detail: string; percent?: boolean };

/** Gráfico de barras horizontal incluido en cada reporte. */
export function ReportVisual({ bars }: { bars: ReportBar[] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div className="report-visual" role="img" aria-label="Resumen gráfico del reporte">
      <div className="visual-caption">
        <strong>Resumen gráfico</strong>
        <span>Comparación según los filtros seleccionados</span>
      </div>
      <div className="visual-bars">
        {bars.map((bar) => (
          <div className="visual-row" key={bar.label}>
            <span className="visual-label">{bar.label}</span>
            <span className="visual-track">
              <i
                style={{
                  width: `${Math.max(bar.value ? 4 : 0, (bar.value / max) * 100)}%`,
                }}
              />
            </span>
            <strong>
              {bar.percent ? `${bar.value}%` : bar.value}
            </strong>
            <small>{bar.detail}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Renderiza una celda de reporte según la clave de la columna. */
export function ReportCell({ column, value }: { column: string; value: unknown }) {
  if (column === "severity") return <SeverityTag value={String(value) as Severity} />;
  if (column === "status")
    return <StatusPill value={String(value) as PlanStatus} />;
  if (["rate", "turnAverage", "balance", "coverage"].includes(column)) return `${Number(value)}%`;
  if (column === "observations")
    return <span className="report-observation">{String(value ?? "—")}</span>;
  if (column === "reinspection")
    return (
      <span className={`status-pill ${value === "Solicitada" ? "status-review" : "status-draft"}`}>
        {String(value)}
      </span>
    );
  return String(value ?? "—");
}
