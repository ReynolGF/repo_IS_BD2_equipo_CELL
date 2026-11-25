import { type ReactNode, useMemo } from "react";
import type { Column } from "../models/column.ts";

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
    <div className={`table-scroll overflow-x-auto ${className}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>
                {column.sortable === false ? (
                  column.label
                ) : (
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
                    <span>
                      {sort.key === column.key
                        ? sort.asc
                          ? " ↑"
                          : " ↓"
                        : " ↕"}
                    </span>
                  </button>
                )}
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
