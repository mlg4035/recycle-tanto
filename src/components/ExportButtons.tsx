"use client";

import type { TableModel } from "@/lib/types";

type Props = {
  table: TableModel;
  rawResultJson: string;
  baseFilename?: string;
};

function toCsv(table: TableModel) {
  const rows = [table.columns, ...table.rows];
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");
}

function downloadBlob(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ table, rawResultJson, baseFilename = "scan" }: Props) {
  return (
    <div className="flex gap-3">
      <button
        className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
        onClick={() => downloadBlob(`${baseFilename}.csv`, "text/csv", toCsv(table))}
      >
        Export CSV
      </button>
      <button
        className="rounded bg-zinc-700 px-3 py-2 text-sm text-white"
        onClick={() =>
          downloadBlob(`${baseFilename}.json`, "application/json", rawResultJson)
        }
      >
        Export JSON
      </button>
    </div>
  );
}
