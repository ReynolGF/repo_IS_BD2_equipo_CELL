import type { ReactNode } from "react";
import { sparkline } from "../../../infrastructure/sparkLine.ts";

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
    <div className="panel-heading flex items-start justify-between gap-[14px]">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

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
  const chart = sparkline(`${label}-${value}-${hint}`);
  return (
    <article
      className={`metric-card metric-${color} relative min-h-[158px] overflow-hidden rounded-[20px] border border-line p-[17px_18px_12px] transition duration-200 hover:-translate-y-0.5 max-[720px]:min-h-[146px] max-[720px]:p-[14px_14px_10px] min-[1500px]:min-h-[166px]`}
    >
      <div className="metric-top flex items-center justify-between gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.5px] text-muted">
        <span>{label}</span>
        <span className="metric-glyph" aria-hidden="true">
          ◈
        </span>
      </div>
      <div className="metric-number my-[10px] mb-1 font-display text-[33px] font-semibold leading-none tracking-[-1.6px] text-ink max-[720px]:text-[28px]">
        {value}
      </div>
      <div className="metric-foot">{hint}</div>
      <div className="metric-spark" aria-hidden="true">
        <svg viewBox="0 0 120 42" preserveAspectRatio="none">
          <path className="spark-area" d={chart.area} />
          <path className="spark-line" d={chart.line} />
        </svg>
      </div>
    </article>
  );
}
