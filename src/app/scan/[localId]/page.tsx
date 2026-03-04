"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { ScanPhotoPreview } from "@/components/ScanPhotoPreview";
import { TableGrid } from "@/components/TableGrid";
import type { SavedScan } from "@/lib/indexeddb";
import { getScan, updateScanTable } from "@/lib/indexeddb";
import { extractImplementationDate } from "@/lib/implementation-date";
import type { TableModel } from "@/lib/types";

export default function ScanDetailPage() {
  const params = useParams<{ localId: string }>();
  const localId = Number(params.localId);
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [table, setTable] = useState<TableModel | null>(null);
  const implementationDate = scan
    ? extractImplementationDate(scan.rawResultJson).displayDate
    : null;

  useEffect(() => {
    if (!Number.isFinite(localId)) return;
    getScan(localId).then((result) => {
      if (!result) return;
      setScan(result);
      setTable(result.tableModel);
    });
  }, [localId]);

  async function onTableChange(next: TableModel) {
    setTable(next);
    await updateScanTable(localId, next);
  }

  if (!scan || !table) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
        <h1 className="text-2xl font-semibold">Saved Scan</h1>
        <p className="text-sm text-zinc-600">Scan not found.</p>
        <Link className="underline" href="/history">
          Back to history
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Saved Scan #{scan.localId}</h1>
      <p className="text-sm text-zinc-600">{new Date(scan.createdAt).toLocaleString()}</p>
      <p className="text-sm text-zinc-600">
        実施日: {implementationDate ?? "Not detected"}
      </p>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/">
          Capture
        </Link>
        <Link className="underline" href="/history">
          History
        </Link>
        <Link className="underline" href="/history/photos">
          Photo gallery
        </Link>
      </div>
      <section className="rounded-lg border border-zinc-300 p-3">
        <h2 className="mb-2 text-sm font-medium">Uploaded photo</h2>
        <ScanPhotoPreview
          blob={scan.photoBlob}
          alt={`Saved scan photo ${scan.localId}`}
          width={960}
          height={640}
          className="max-h-[420px] w-auto rounded border border-zinc-200 object-contain"
        />
      </section>
      <TableGrid table={table} onChange={onTableChange} />
      <ExportButtons
        table={table}
        rawResultJson={scan.rawResultJson}
        baseFilename={`scan-${scan.localId}`}
      />
    </main>
  );
}
