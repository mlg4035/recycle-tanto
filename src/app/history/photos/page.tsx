"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScanPhotoPreview } from "@/components/ScanPhotoPreview";
import type { SavedScan } from "@/lib/indexeddb";
import { listScans } from "@/lib/indexeddb";
import { extractImplementationDate } from "@/lib/implementation-date";
import { normalizeOcrResult } from "@/lib/normalize";

type GalleryItem = SavedScan & {
  implementationDate: string | null;
  rowCount: number;
  qualityLabel: "ok" | "warning";
};

export default function HistoryPhotosPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    listScans()
      .then((scans) => {
        return scans.map((scan) => {
          const normalized = normalizeOcrResult(JSON.parse(scan.rawResultJson) as unknown);
          const rowCount = normalized.rows.length;
          return {
            ...scan,
            implementationDate: extractImplementationDate(scan.rawResultJson).displayDate,
            rowCount,
            qualityLabel: rowCount >= 3 ? "ok" : "warning",
          } satisfies GalleryItem;
        });
      })
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Photo Gallery</h1>
      <p className="text-sm text-zinc-600">
        Confirm uploaded images against extracted results.
      </p>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/history">
          Back to history
        </Link>
        <Link className="underline" href="/history/table">
          Tabular history
        </Link>
      </div>

      {items.length === 0 ? <p className="text-sm text-zinc-600">No saved scans yet.</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.localId} className="rounded-lg border border-zinc-300 p-3">
            <ScanPhotoPreview
              blob={item.photoBlob}
              alt={`Scan photo ${item.localId ?? ""}`}
              width={640}
              height={420}
              className="h-44 w-full rounded border border-zinc-200 object-contain"
            />
            <p className="mt-2 text-sm">実施日: {item.implementationDate ?? "Not detected"}</p>
            <div className="mt-1">
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs ${
                  item.qualityLabel === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                Rows: {item.rowCount} {item.qualityLabel === "ok" ? "(likely OK)" : "(review)"}
              </span>
            </div>
            <p className="text-xs text-zinc-600">
              Saved: {new Date(item.createdAt).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-600">Job: {item.sourceJobId}</p>
            {typeof item.localId === "number" ? (
              <Link className="mt-1 inline-block text-sm underline" href={`/scan/${item.localId}`}>
                Open scan
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
