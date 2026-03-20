"use client";

import { compressImage } from "@/lib/image";
import { enqueueUpload, getQueuedUploadCount, saveScan } from "@/lib/indexeddb";
import { submitJobUpload } from "@/lib/jobs-client";
import { normalizeOcrResult } from "@/lib/normalize";
import type { JobResponse, TableModel } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;
const UPLOAD_DELAY_MS = 4000; // ~7–8 sec per file with typical 3–4 sec processing; stays under 10/min rate limit

async function waitForJobCompletion(jobId: string): Promise<JobResponse> {
  for (;;) {
    const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Job fetch failed (${res.status})`);
    const data = (await res.json()) as { job: JobResponse };
    const job = data.job;
    if (job.status === "processed" || job.status === "failed") {
      return job;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export type BulkItem = {
  blob: Blob;
  filename: string;
};

export type BulkProgress = {
  total: number;
  completed: number;
  failed: number;
  currentFilename: string | null;
  lastError: string | null;
};

export type BulkResult = {
  savedLocalIds: number[];
  failedIndexes: number[];
};

export async function processBulkImport(
  items: BulkItem[],
  onProgress: (p: BulkProgress) => void,
): Promise<BulkResult> {
  const savedLocalIds: number[] = [];
  const failedIndexes: number[] = [];

  const report = (overrides: Partial<BulkProgress>) => {
    onProgress({
      total: items.length,
      completed: savedLocalIds.length + failedIndexes.length,
      failed: failedIndexes.length,
      currentFilename: null,
      lastError: null,
      ...overrides,
    });
  };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    report({ currentFilename: item.filename });

    if (!navigator.onLine) {
      await enqueueUpload({
        createdAt: Date.now(),
        submissionId: crypto.randomUUID(),
        filename: item.filename,
        imageBlob: item.blob,
      });
      const count = await getQueuedUploadCount();
      window.dispatchEvent(
        new CustomEvent("recycletanto-queue-count", { detail: { count } }),
      );
      window.dispatchEvent(new Event("recycletanto-flush-queue"));
      failedIndexes.push(i);
      report({ lastError: "Offline – queued for later", failed: failedIndexes.length });
      continue;
    }

    try {
      const compressed = await compressImage(item.blob, item.filename);
      const submissionId = crypto.randomUUID();

      let job: JobResponse;
      try {
        job = await submitJobUpload({
          submissionId,
          imageBlob: compressed.blob,
          filename: item.filename,
        });
      } catch (e) {
        if (!navigator.onLine) {
          await enqueueUpload({
            createdAt: Date.now(),
            submissionId,
            filename: item.filename,
            imageBlob: compressed.blob,
          });
          const count = await getQueuedUploadCount();
          window.dispatchEvent(
            new CustomEvent("recycletanto-queue-count", { detail: { count } }),
          );
          window.dispatchEvent(new Event("recycletanto-flush-queue"));
        }
        throw e;
      }

      const completed = await waitForJobCompletion(job.id);
      if (completed.status === "failed") {
        failedIndexes.push(i);
        report({ lastError: completed.error ?? "Processing failed", failed: failedIndexes.length });
        continue;
      }

      const parsed = completed.resultJson ? JSON.parse(completed.resultJson) : {};
      const tableModel: TableModel = normalizeOcrResult(parsed);
      const rawResultJson = JSON.stringify(parsed, null, 2);

      const localId = await saveScan({
        createdAt: Date.now(),
        photoBlob: compressed.blob,
        tableModel,
        rawResultJson,
        sourceJobId: completed.id,
      });
      savedLocalIds.push(localId);
      report({ completed: savedLocalIds.length + failedIndexes.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      failedIndexes.push(i);
      report({ lastError: msg, failed: failedIndexes.length });
    }

    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, UPLOAD_DELAY_MS));
    }
  }

  report({ currentFilename: null });
  return { savedLocalIds, failedIndexes };
}
