"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { ExportButtons } from "@/components/ExportButtons";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { TableGrid } from "@/components/TableGrid";
import { enqueueUpload, getQueuedUploadCount, saveScan } from "@/lib/indexeddb";
import { submitJobUpload } from "@/lib/jobs-client";
import { normalizeOcrResult } from "@/lib/normalize";
import type { JobResponse, TableModel } from "@/lib/types";

export default function Home() {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [table, setTable] = useState<TableModel | null>(null);
  const [rawResultJson, setRawResultJson] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedLocalId, setSavedLocalId] = useState<number | null>(null);
  const photoBlobRef = useRef<Blob | null>(null);
  const hasSavedRef = useRef(false);

  useEffect(() => {
    const storedJobId = window.localStorage.getItem("activeJobId");
    if (!storedJobId) return;
    fetch(`/api/jobs/${storedJobId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { job: JobResponse };
        return data.job;
      })
      .then((storedJob) => {
        if (!storedJob) return;
        setJob(storedJob);
      })
      .catch(() => {
        setError("Server unreachable");
      });
  }, []);

  useEffect(() => {
    const onQueuedUploaded = (event: Event) => {
      const detail = (
        event as CustomEvent<{ job?: JobResponse; imageBlob?: Blob }>
      ).detail;
      if (!detail?.job) return;
      if (detail.imageBlob) {
        photoBlobRef.current = detail.imageBlob;
      }
      setError(null);
      setNotice("Queued upload sent. Processing started.");
      setJob(detail.job);
    };
    window.addEventListener("recycletanto-queued-upload-submitted", onQueuedUploaded);
    return () => {
      window.removeEventListener(
        "recycletanto-queued-upload-submitted",
        onQueuedUploaded,
      );
    };
  }, []);

  const onCaptured = useCallback(async (data: { blob: Blob; filename: string }) => {
    setError(null);
    setNotice(null);
    setTable(null);
    setRawResultJson("");
    setSavedLocalId(null);
    setJob(null);
    hasSavedRef.current = false;
    photoBlobRef.current = data.blob;

    const submissionId = crypto.randomUUID();
    const queueAndNotify = async () => {
      await enqueueUpload({
        createdAt: Date.now(),
        submissionId,
        filename: data.filename,
        imageBlob: data.blob,
      });
      const queuedCount = await getQueuedUploadCount();
      window.dispatchEvent(
        new CustomEvent("recycletanto-queue-count", {
          detail: { count: queuedCount },
        }),
      );
      window.dispatchEvent(new Event("recycletanto-flush-queue"));
      setNotice("Queued for upload. It will retry when online.");
    };

    try {
      if (!navigator.onLine) {
        await queueAndNotify();
        return;
      }
      const nextJob = await submitJobUpload({
        submissionId,
        imageBlob: data.blob,
        filename: data.filename,
      });
      setJob(nextJob);
      window.localStorage.setItem("activeJobId", nextJob.id);
    } catch {
      if (!navigator.onLine) {
        await queueAndNotify();
      } else {
        setError("Upload failed");
      }
    }
  }, []);

  const onJobUpdate = useCallback(async (updated: JobResponse) => {
    setJob(updated);
    setNotice(null);
    if (updated.status === "failed") {
      setError("Processing failed");
      window.localStorage.removeItem("activeJobId");
      return;
    }
    if (updated.status !== "processed" || hasSavedRef.current) {
      return;
    }

    try {
      const parsed = updated.resultJson ? JSON.parse(updated.resultJson) : {};
      const model = normalizeOcrResult(parsed);
      setTable(model);
      const raw = JSON.stringify(parsed, null, 2);
      setRawResultJson(raw);

      if (photoBlobRef.current) {
        const localId = await saveScan({
          createdAt: Date.now(),
          photoBlob: photoBlobRef.current,
          tableModel: model,
          rawResultJson: raw,
          sourceJobId: updated.id,
        });
        setSavedLocalId(localId);
        hasSavedRef.current = true;
      }
      window.localStorage.removeItem("activeJobId");
    } catch {
      setError("Processing failed");
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">RecycleTanto Scan</h1>
      <p className="text-sm text-zinc-600">
        Take one photo and wait for table extraction.{" "}
        <Link className="underline" href="/history">
          View history
        </Link>
        {" · "}
        <Link className="underline" href="/import">
          Bulk import
        </Link>
      </p>

      <CameraCapture disabled={Boolean(job && job.status === "processing")} onCaptured={onCaptured} />

      {job ? <ProcessingStatus jobId={job.id} onUpdate={onJobUpdate} /> : null}
      {notice ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {notice}
        </p>
      ) : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {table ? (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
          <h2 className="font-medium">Extracted table</h2>
          <TableGrid table={table} />
          <ExportButtons table={table} rawResultJson={rawResultJson} baseFilename={`scan-${job?.id ?? "result"}`} />
          {savedLocalId ? (
            <Link className="text-sm underline" href={`/scan/${savedLocalId}`}>
              Open saved scan
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
