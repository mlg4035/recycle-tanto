"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SavedScan } from "@/lib/indexeddb";
import { listScans } from "@/lib/indexeddb";

export default function HistoryPage() {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listScans()
      .then((items) => {
        console.log("listScans returned:", items);
        setScans(items);
      })
      .catch((err) => {
        console.error("listScans failed:", err);
        setError(String(err?.message || err || "Unknown error"));
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">History</h1>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/">
          Back to capture
        </Link>
        <Link className="underline" href="/history">
          History
        </Link>
        <Link className="underline" href="/history/photos">
          Photo gallery
        </Link>
        <Link className="underline" href="/history/table">
          Tabular view
        </Link>
        <Link className="underline" href="/import">
          Bulk import
        </Link>
      </div>
      {error ? <p>Failed to load scans: {error}</p> : null}

      <p>Count: {scans.length}</p>

      {scans.length === 0 ? (
        <p>No saved scans yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {scans.map((scan) => (
            <li key={scan.localId} className="rounded border p-3">
              <p>localId: {scan.localId}</p>
              <p>createdAt: {new Date(scan.createdAt).toLocaleString()}</p>
              <p>job: {scan.sourceJobId}</p>
              <p>blob size: {scan.photoBlob?.size ?? "no blob"}</p>
              <Link className="underline" href={`/scan/${scan.localId}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
