import { useMemo } from "react";
import type { ReactNode } from "react";
import type { PlanStatus, Severity } from "../../types/maintenance";

export type Column = { key: string; label: string };

/** Tarjeta de indicador con número, pista y barra de progreso. */
export function Metric({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-glyph ${color}`}>◈</span>
      </div>
      <div className="metric-number">{value}</div>
      <div className="metric-foot">{hint}</div>
      <div className={`metric-rule ${color}-rule`}>
        <i style={{ width: `${Math.min(Number.parseInt(value) || 45, 100)}%` }} />
      </div>
    </article>
  );
}

export function PanelTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function SeverityTag({ value }: { value: Severity }) {
  return (
    <span className={`severity ${value === "Alta" ? "high" : value === "Media" ? "medium" : "low"}`}>
      {value}
    </span>
  );
}

const statusClass: Record<PlanStatus, string> = {
  Borrador: "status-draft",
  "En revisión": "status-review",
  Aprobado: "status-approved",
  "En ejecución": "status-running",
  Finalizado: "status-approved",
  Rechazado: "status-rejected",
};

export function StatusPill({ value }: { value: PlanStatus }) {
  return <span className={`status-pill ${statusClass[value]}`}>{value}</span>;
}

export function Dialog({
  title,
  subtitle,
  close,
  children,
  wide,
}: {
  title: string;
  subtitle: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className={`create-modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-heading">
          <div>
            <span className="modal-kicker">GESTIÓN DE MANTENIMIENTO</span>
            <h2 id="dialog-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="modal-close" onClick={close} aria-label="Cerrar" type="button">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function DialogActions({
  close,
  submit,
  disabled,
  submitType = "submit",
  onSubmit,
}: {
  close: () => void;
  submit: string;
  disabled?: boolean;
  submitType?: "submit" | "button";
  onSubmit?: () => void;
}) {
  return (
    <div className="modal-actions">
      <button type="button" className="button button-quiet" onClick={close}>
        Cancelar
      </button>
      <button
        type={submitType}
        className="button button-primary"
        disabled={disabled}
        onClick={onSubmit}
      >
        {submit}
      </button>
    </div>
  );
}

/**
 * Tabla reutilizable con encabezados ordenables. El estado de orden vive en la
 * pantalla para que el reporte y la tabla compartan la misma configuración.
 */
export function DataTable<T>({
  columns,
  rows,
  sort,
  setSort,
  render,
  empty = "No hay resultados.",
  className = "",
}: {
  columns: Column[];
  rows: T[];
  sort: { key: string; asc: boolean };
  setSort: (value: { key: string; asc: boolean }) => void;
  render: (row: T) => ReactNode;
  empty?: string;
  className?: string;
}) {
  const value = (row: T, key: string): unknown =>
    key
      .split(".")
      .reduce(
        (current: unknown, part) =>
          current && typeof current === "object"
            ? (current as Record<string, unknown>)[part]
            : undefined,
        row,
      );
  const sortedRows = useMemo(
    () =>
      sort.key
        ? [...rows].sort(
            (a, b) =>
              String(value(a, sort.key) ?? "").localeCompare(
                String(value(b, sort.key) ?? ""),
                "es",
                { numeric: true },
              ) * (sort.asc ? 1 : -1),
          )
        : rows,
    [rows, sort],
  );
  return (
    <div className={`table-scroll ${className}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                <button
                  className="sort-heading"
                  type="button"
                  onClick={() =>
                    setSort({
                      key: column.key,
                      asc: sort.key === column.key ? !sort.asc : true,
                    })
                  }
                >
                  {column.label}
                  <span>{sort.key === column.key ? (sort.asc ? " ↑" : " ↓") : " ↕"}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{sortedRows.map(render)}</tbody>
      </table>
      {!rows.length && <div className="empty-state">{empty}</div>}
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
}) {
  return <div className={`inline-notice ${tone}`}>{children}</div>;
}
