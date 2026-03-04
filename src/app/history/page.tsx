"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScanPhotoPreview } from "@/components/ScanPhotoPreview";
import type { SavedScan } from "@/lib/indexeddb";
import { deleteScan, deleteScans, listScans } from "@/lib/indexeddb";
import {
  sumScanCategoryQuantities,
  sumScanQuantity,
} from "@/lib/history-analytics";
import { extractImplementationDate, formatYearMonth } from "@/lib/implementation-date";

type HistoryItem = SavedScan & {
  sortTimestamp: number;
  implementationDate: string | null;
  monthKey: string;
};

type CategoryFilter = {
  monthKey: string;
  category: string;
} | null;

export default function HistoryPage() {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<CategoryFilter>(null);

  useEffect(() => {
    listScans().then(setScans).catch(() => setScans([]));
  }, []);

  const groupedScans = useMemo(() => {
    const enriched: HistoryItem[] = scans
      .map((scan) => {
        const extracted = extractImplementationDate(scan.rawResultJson);
        const sortTimestamp = extracted.timestamp ?? scan.createdAt;
        return {
          ...scan,
          sortTimestamp,
          implementationDate: extracted.displayDate,
          monthKey: extracted.timestamp ? formatYearMonth(extracted.timestamp) : "unknown",
        };
      })
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const groups = new Map<string, HistoryItem[]>();
    for (const item of enriched) {
      const existing = groups.get(item.monthKey) ?? [];
      existing.push(item);
      groups.set(item.monthKey, existing);
    }

    return Array.from(groups.entries()).map(([monthKey, items]) => ({
      monthKey,
      items,
    }));
  }, [scans]);

  const monthlyTotals = useMemo(() => {
    return groupedScans
      .filter((group) => group.monthKey !== "unknown")
      .map((group) => {
        const categoryMap = new Map<string, number>();
        for (const scan of group.items) {
          const scanCategoryTotals = sumScanCategoryQuantities(scan);
          for (const [category, value] of scanCategoryTotals) {
            categoryMap.set(category, (categoryMap.get(category) ?? 0) + value);
          }
        }

        return {
          monthKey: group.monthKey,
          scanCount: group.items.length,
          totalQuantity: group.items.reduce(
            (sum, scan) => sum + sumScanQuantity(scan),
            0,
          ),
          categoryTotals: Array.from(categoryMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([category, total]) => ({ category, total })),
        };
      });
  }, [groupedScans]);

  const visibleGroups = useMemo(() => {
    if (!selectedFilter) return groupedScans;

    return groupedScans
      .filter((group) => group.monthKey === selectedFilter.monthKey)
      .map((group) => ({
        ...group,
        items: group.items.filter((scan) => {
          const categoryTotals = sumScanCategoryQuantities(scan);
          return (categoryTotals.get(selectedFilter.category) ?? 0) > 0;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedScans, selectedFilter]);

  const filteredLocalIds = useMemo(() => {
    if (!selectedFilter) return [];
    const ids: number[] = [];
    for (const group of visibleGroups) {
      for (const scan of group.items) {
        if (typeof scan.localId === "number") {
          ids.push(scan.localId);
        }
      }
    }
    return ids;
  }, [selectedFilter, visibleGroups]);

  function onCategoryClick(monthKey: string, category: string) {
    setSelectedFilter((prev) =>
      prev && prev.monthKey === monthKey && prev.category === category
        ? null
        : { monthKey, category },
    );
  }

  async function onDeleteScan(localId: number) {
    const confirmed = window.confirm("Delete this saved scan?");
    if (!confirmed) return;
    await deleteScan(localId);
    setScans((prev) => prev.filter((scan) => scan.localId !== localId));
  }

  async function onDeleteFilteredScans() {
    if (!selectedFilter || filteredLocalIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${filteredLocalIds.length} filtered scan(s)? This cannot be undone.`,
    );
    if (!confirmed) return;

    await deleteScans(filteredLocalIds);
    const removeSet = new Set(filteredLocalIds);
    setScans((prev) =>
      prev.filter(
        (scan) => !(typeof scan.localId === "number" && removeSet.has(scan.localId)),
      ),
    );
    setSelectedFilter(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Scan History</h1>
      <p className="text-sm text-zinc-600">
        Sorted by 実施日 when available.
      </p>
      <Link className="text-sm underline" href="/">
        Back to capture
      </Link>
      <Link className="text-sm underline" href="/history/table">
        Open tabular view
      </Link>
      <Link className="text-sm underline" href="/history/photos">
        Open photo gallery
      </Link>

      {scans.length === 0 ? <p className="text-sm text-zinc-600">No saved scans yet.</p> : null}
      {monthlyTotals.length > 0 ? (
        <section className="rounded-lg border border-zinc-300 p-4">
          <h2 className="text-base font-semibold">Monthly Totals (数量)</h2>
          {selectedFilter ? (
            <div className="mt-2 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <span>
                Filter: {selectedFilter.monthKey} / {selectedFilter.category}
              </span>
              <div className="flex items-center gap-3">
                <button
                  className="text-red-700 underline"
                  type="button"
                  onClick={() => void onDeleteFilteredScans()}
                  disabled={filteredLocalIds.length === 0}
                >
                  Delete filtered ({filteredLocalIds.length})
                </button>
                <button
                  className="underline"
                  type="button"
                  onClick={() => setSelectedFilter(null)}
                >
                  Clear filter
                </button>
              </div>
            </div>
          ) : null}
          <ul className="mt-2 flex flex-col gap-2">
            {monthlyTotals.map((item) => (
              <li
                key={item.monthKey}
                className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-sm"
              >
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>{item.monthKey}</span>
                    <span>
                      {item.totalQuantity.toFixed(2)} (from {item.scanCount} scan
                      {item.scanCount === 1 ? "" : "s"})
                    </span>
                  </div>
                  {item.categoryTotals.length > 0 ? (
                    <div className="flex flex-wrap gap-1 text-xs text-zinc-600">
                      {item.categoryTotals.map((entry) => {
                        const active =
                          selectedFilter?.monthKey === item.monthKey &&
                          selectedFilter?.category === entry.category;
                        return (
                          <button
                            key={`${item.monthKey}-${entry.category}`}
                            type="button"
                            onClick={() => onCategoryClick(item.monthKey, entry.category)}
                            className={`rounded border px-2 py-0.5 ${
                              active
                                ? "border-zinc-900 bg-zinc-900 text-white"
                                : "border-zinc-300 bg-white hover:bg-zinc-100"
                            }`}
                          >
                            {entry.category}: {entry.total.toFixed(2)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => (
          <section key={group.monthKey} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">
              {group.monthKey === "unknown" ? "Unknown 実施日" : `${group.monthKey} (${group.items.length})`}
            </h2>
            <ul className="flex flex-col gap-3">
              {group.items.map((scan) => (
                <li key={scan.localId} className="rounded-lg border border-zinc-300 p-3">
                  <div className="mb-2">
                    <ScanPhotoPreview
                      blob={scan.photoBlob}
                      alt={`Scan photo ${scan.localId ?? ""}`}
                      width={240}
                      height={160}
                      className="h-28 w-auto rounded border border-zinc-200 object-contain"
                    />
                  </div>
                  <p className="text-sm">
                    実施日: {scan.implementationDate ?? "Not detected"}
                  </p>
                  <p className="text-xs text-zinc-600">
                    Saved: {new Date(scan.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-600">Job: {scan.sourceJobId}</p>
                  {(() => {
                    const localId = scan.localId;
                    return (
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    {typeof localId === "number" ? (
                      <Link className="underline" href={`/scan/${localId}`}>
                        Open
                      </Link>
                    ) : null}
                    {typeof localId === "number" ? (
                      <button
                        type="button"
                        className="text-red-700 underline"
                        onClick={() => void onDeleteScan(localId)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
