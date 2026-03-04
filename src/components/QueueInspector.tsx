"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearQueuedUploads,
  getQueuedUploadCount,
  listQueuedUploads,
  removeQueuedUpload,
  type QueuedUpload,
} from "@/lib/indexeddb";
import { submitJobUpload } from "@/lib/jobs-client";
import type { JobResponse } from "@/lib/types";

type QueueRow = QueuedUpload & { queueId: number };

function dispatchQueueCount(count: number) {
  window.dispatchEvent(
    new CustomEvent("recycletanto-queue-count", { detail: { count } }),
  );
}

function dispatchQueuedUploadSubmitted(job: JobResponse, imageBlob: Blob, submissionId: string) {
  window.dispatchEvent(
    new CustomEvent("recycletanto-queued-upload-submitted", {
      detail: { job, imageBlob, submissionId },
    }),
  );
}

export function QueueInspector() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const queued = await listQueuedUploads();
    const typedRows = queued.filter((item): item is QueueRow =>
      typeof item.queueId === "number",
    );
    setRows(typedRows);
    const count = await getQueuedUploadCount();
    dispatchQueueCount(count);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const retryOne = useCallback(
    async (row: QueueRow) => {
      setBusy(true);
      setMessage(null);
      try {
        const job = await submitJobUpload({
          submissionId: row.submissionId,
          imageBlob: row.imageBlob,
          filename: row.filename,
        });
        await removeQueuedUpload(row.queueId);
        window.localStorage.setItem("activeJobId", job.id);
        dispatchQueuedUploadSubmitted(job, row.imageBlob, row.submissionId);
        setMessage(`Retried ${row.filename} successfully.`);
      } catch {
        setMessage(`Retry failed for ${row.filename}.`);
      } finally {
        await refresh();
        setBusy(false);
      }
    },
    [refresh],
  );

  const removeOne = useCallback(
    async (queueId: number) => {
      setBusy(true);
      setMessage(null);
      await removeQueuedUpload(queueId);
      await refresh();
      setBusy(false);
      setMessage("Removed queued upload.");
    },
    [refresh],
  );

  const retryAll = useCallback(async () => {
    if (rows.length === 0) return;
    setBusy(true);
    setMessage(null);
    let success = 0;
    for (const row of rows) {
      try {
        const job = await submitJobUpload({
          submissionId: row.submissionId,
          imageBlob: row.imageBlob,
          filename: row.filename,
        });
        await removeQueuedUpload(row.queueId);
        window.localStorage.setItem("activeJobId", job.id);
        dispatchQueuedUploadSubmitted(job, row.imageBlob, row.submissionId);
        success += 1;
      } catch {
        break;
      }
    }
    await refresh();
    setBusy(false);
    setMessage(`Retried ${success} queued upload(s).`);
  }, [refresh, rows]);

  const clearAll = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    await clearQueuedUploads();
    await refresh();
    setBusy(false);
    setMessage("Cleared queued uploads.");
  }, [refresh]);

  return (
    <section className="rounded-lg border border-zinc-300 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Queue Inspector</h2>
        <button
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Queued uploads: {rows.length}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          type="button"
          onClick={() => void retryAll()}
          disabled={busy || rows.length === 0}
        >
          Retry all
        </button>
        <button
          className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
          type="button"
          onClick={() => void clearAll()}
          disabled={busy || rows.length === 0}
        >
          Clear all
        </button>
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}

      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.queueId} className="rounded border border-zinc-200 p-3">
            <p className="text-sm font-medium">{row.filename}</p>
            <p className="text-xs text-zinc-600">submissionId: {row.submissionId}</p>
            <p className="text-xs text-zinc-600">
              size: {Math.round(row.imageBlob.size / 1024)} KB
            </p>
            <p className="text-xs text-zinc-600">
              created: {new Date(row.createdAt).toLocaleString()}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60"
                type="button"
                onClick={() => void retryOne(row)}
                disabled={busy}
              >
                Retry
              </button>
              <button
                className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-60"
                type="button"
                onClick={() => void removeOne(row.queueId)}
                disabled={busy}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
