import {type ReactNode, useMemo} from "react";
import type {Column} from "../models/column.ts";

export function DataTable<T>({
                                 columns,

                                 render,
                                 empty = "No hay resultados.",
                                 className = "",
                             }: {
    columns: Column[];

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

                                >
                                    {column.label}
                                    <span>↕</span>
                                </button>
                            )}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>
    );
}