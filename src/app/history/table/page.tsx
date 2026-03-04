"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SavedScan } from "@/lib/indexeddb";
import { listScans } from "@/lib/indexeddb";
import {
  ITEM_TYPE_ORDER,
  sumScanQuantity,
  sumScanTypeQuantities,
} from "@/lib/history-analytics";
import { extractImplementationDate } from "@/lib/implementation-date";

type Row = {
  localId: number | null;
  sourceJobId: string;
  implementationDate: string | null;
  implementationTimestamp: number | null;
  savedAt: number;
  totalQuantity: number;
  categoryTotals: Record<string, number>;
};

const PAGE_SIZE = 10;

function toCsvCell(value: string | number) {
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

export default function HistoryTablePage() {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [sortKey, setSortKey] = useState<string>("implementationDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    listScans().then(setScans).catch(() => setScans([]));
  }, []);

  const rows = useMemo<Row[]>(() => {
    return scans.map((scan) => {
      const date = extractImplementationDate(scan.rawResultJson);
      const typeMap = sumScanTypeQuantities(scan);
      return {
        localId: typeof scan.localId === "number" ? scan.localId : null,
        sourceJobId: scan.sourceJobId,
        implementationDate: date.displayDate,
        implementationTimestamp: date.timestamp,
        savedAt: scan.createdAt,
        totalQuantity: sumScanQuantity(scan),
        categoryTotals: Object.fromEntries(typeMap.entries()),
      };
    });
  }, [scans]);

  const categories = useMemo(() => {
    return [...ITEM_TYPE_ORDER];
  }, []);

  const sortedRows = useMemo(() => {
    const valueOf = (row: Row, key: string): string | number => {
      if (key === "implementationDate") return row.implementationTimestamp ?? row.savedAt;
      if (key === "savedAt") return row.savedAt;
      if (key === "totalQuantity") return row.totalQuantity;
      if (key === "sourceJobId") return row.sourceJobId;
      if (key.startsWith("category:")) {
        const name = key.slice("category:".length);
        return row.categoryTotals[name] ?? 0;
      }
      return 0;
    };

    const cloned = [...rows];
    cloned.sort((a, b) => {
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      let result: number;
      if (typeof av === "string" && typeof bv === "string") {
        result = av.localeCompare(bv);
      } else {
        result = Number(av) - Number(bv);
      }
      return sortDir === "asc" ? result : -result;
    });
    return cloned;
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (effectivePage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [effectivePage, sortedRows]);

  function onSortClick(key: string) {
    setPage(1);
    setSortDir((prev) => (sortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc"));
    setSortKey(key);
  }

  const directionSymbol = sortDir === "asc" ? "▲" : "▼";

  function exportCsv(rowsToExport: Row[], filename: string) {
    const header = [
      "実施日",
      "Saved",
      "Job",
      "Total 数量",
      ...categories,
    ];
    const body = rowsToExport.map((row) => [
      row.implementationDate ?? "",
      new Date(row.savedAt).toISOString(),
      row.sourceJobId,
      row.totalQuantity.toFixed(2),
      ...categories.map((category) => (row.categoryTotals[category] ?? 0).toFixed(2)),
    ]);
    const csv = [header, ...body]
      .map((record) => record.map(toCsvCell).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Tabular History</h1>
      <p className="text-sm text-zinc-600">
        10 files per page. Click headers to sort.
      </p>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/history">
          Back to history cards
        </Link>
        <Link className="underline" href="/history/photos">
          Photo gallery
        </Link>
        <Link className="underline" href="/">
          Back to capture
        </Link>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() =>
            exportCsv(
              pagedRows,
              `history-page-${effectivePage}-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          disabled={pagedRows.length === 0}
        >
          Export current page CSV
        </button>
        <button
          type="button"
          className="rounded bg-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={() =>
            exportCsv(
              sortedRows,
              `history-all-${new Date().toISOString().slice(0, 10)}.csv`,
            )
          }
          disabled={sortedRows.length === 0}
        >
          Export all CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-300">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border-b border-zinc-300 px-3 py-2 text-left">
                <button type="button" onClick={() => onSortClick("implementationDate")}>
                  実施日 {sortKey === "implementationDate" ? directionSymbol : ""}
                </button>
              </th>
              <th className="border-b border-zinc-300 px-3 py-2 text-left">
                <button type="button" onClick={() => onSortClick("savedAt")}>
                  Saved {sortKey === "savedAt" ? directionSymbol : ""}
                </button>
              </th>
              <th className="border-b border-zinc-300 px-3 py-2 text-left">
                <button type="button" onClick={() => onSortClick("sourceJobId")}>
                  Job {sortKey === "sourceJobId" ? directionSymbol : ""}
                </button>
              </th>
              <th className="border-b border-zinc-300 px-3 py-2 text-right">
                <button type="button" onClick={() => onSortClick("totalQuantity")}>
                  Total 数量 {sortKey === "totalQuantity" ? directionSymbol : ""}
                </button>
              </th>
              {categories.map((category) => {
                const key = `category:${category}`;
                return (
                  <th key={category} className="border-b border-zinc-300 px-3 py-2 text-right">
                    <button type="button" onClick={() => onSortClick(key)}>
                      {category} {sortKey === key ? directionSymbol : ""}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={`${row.localId ?? "unknown"}-${row.sourceJobId}`}>
                <td className="border-b border-zinc-200 px-3 py-2">
                  {row.implementationDate ?? "Not detected"}
                </td>
                <td className="border-b border-zinc-200 px-3 py-2">
                  {new Date(row.savedAt).toLocaleString()}
                </td>
                <td className="border-b border-zinc-200 px-3 py-2">
                  {row.localId !== null ? (
                    <Link className="underline" href={`/scan/${row.localId}`}>
                      {row.sourceJobId}
                    </Link>
                  ) : (
                    row.sourceJobId
                  )}
                </td>
                <td className="border-b border-zinc-200 px-3 py-2 text-right">
                  {row.totalQuantity.toFixed(2)}
                </td>
                {categories.map((category) => (
                  <td key={category} className="border-b border-zinc-200 px-3 py-2 text-right">
                    {(row.categoryTotals[category] ?? 0).toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + categories.length}
                  className="px-3 py-6 text-center text-zinc-600"
                >
                  No scans found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>
          Page {effectivePage} / {totalPages} ({sortedRows.length} files)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50"
            disabled={effectivePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50"
            disabled={effectivePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
