"use client";

import type { TableModel } from "@/lib/types";

type Props = {
  table: TableModel;
  onChange?: (table: TableModel) => void;
};

export function TableGrid({ table, onChange }: Props) {
  const editable = Boolean(onChange);

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    if (!onChange) return;
    const nextRows = table.rows.map((row, r) => {
      if (r !== rowIndex) return row;
      return row.map((cell, c) => (c === colIndex ? value : cell));
    });
    onChange({ ...table, rows: nextRows });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-300">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column} className="border-b border-zinc-300 bg-zinc-100 px-3 py-2 text-left">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {table.columns.map((_, colIndex) => (
                <td key={`cell-${rowIndex}-${colIndex}`} className="border-b border-zinc-200 px-3 py-2">
                  {editable ? (
                    <input
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                      value={row[colIndex] ?? ""}
                      onChange={(event) => updateCell(rowIndex, colIndex, event.target.value)}
                    />
                  ) : (
                    row[colIndex] ?? ""
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
