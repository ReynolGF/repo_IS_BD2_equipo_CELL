import type { Severity } from "../../../maintenance-task/domain/models/Severity.ts";

export function SeverityTag({ value }: { value: Severity }) {
  return (
    <span
      className={`severity ${value === "Alta" ? "high" : value === "Media" ? "medium" : "low"}`}
    >
      {value}
    </span>
  );
}
