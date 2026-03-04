"use client";

import { useEffect, useState } from "react";
import type { JobResponse } from "@/lib/types";

type Props = {
  jobId: string | null;
  onUpdate: (job: JobResponse) => void;
};

async function fetchJob(jobId: string) {
  const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("status fetch failed");
  const data = (await res.json()) as { job: JobResponse };
  return data.job;
}

export function ProcessingStatus({ jobId, onUpdate }: Props) {
  const [currentStatus, setCurrentStatus] = useState<JobResponse["status"] | null>(
    null,
  );
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    let done = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let eventSource: EventSource | null = null;

    const stopAll = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (eventSource) eventSource.close();
    };

    const maybeDone = (job: JobResponse) => {
      onUpdate(job);
      setCurrentStatus(job.status);
      setHasConnectionError(false);
      if (job.status === "processed") {
        done = true;
        stopAll();
      } else if (job.status === "failed") {
        done = true;
        stopAll();
      }
    };

    const startPollingFallback = () => {
      if (pollTimer || done) return;
      setUsingFallback(true);
      pollTimer = setInterval(async () => {
        if (done) return;
        try {
          const job = await fetchJob(jobId);
          maybeDone(job);
        } catch {
          setHasConnectionError(true);
        }
      }, 2000);
    };

    if (typeof window !== "undefined" && "EventSource" in window) {
      eventSource = new EventSource(`/api/jobs/${jobId}/events`);
      eventSource.addEventListener("status", (event) => {
        const parsed = JSON.parse((event as MessageEvent).data) as JobResponse;
        maybeDone(parsed);
      });
      eventSource.addEventListener("error", () => {
        if (done) return;
        eventSource?.close();
        startPollingFallback();
      });
    } else {
      startPollingFallback();
    }

    fetchJob(jobId).then(maybeDone).catch(() => setHasConnectionError(true));

    return () => {
      done = true;
      stopAll();
    };
  }, [jobId, onUpdate]);

  if (!jobId) return null;

  const message = hasConnectionError
    ? "Server unreachable"
    : currentStatus === "processed"
      ? "Processed"
      : currentStatus === "failed"
        ? "Processing failed"
        : "Processing…";

  return (
    <section className="rounded-lg border border-zinc-300 p-4">
      <p className="text-sm font-medium">Job: {jobId}</p>
      <p className="text-sm">{message || "Processing…"}</p>
      {usingFallback ? <p className="text-xs text-zinc-500">Using polling fallback</p> : null}
    </section>
  );
}
