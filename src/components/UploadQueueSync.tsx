"use client";

import { useEffect, useRef } from "react";
import {
  attachJobIdToQueuedUpload,
  getQueuedUploadCount,
  listQueuedUploads,
} from "@/lib/indexeddb";
import { submitJobUpload } from "@/lib/jobs-client";

function dispatchQueueCount(count: number) {
  window.dispatchEvent(
    new CustomEvent("recycletanto-queue-count", {
      detail: { count },
    }),
  );
}

function dispatchQueuedUploadSubmitted(detail: {
  job: unknown;
  imageBlob: Blob;
  submissionId: string;
}) {
  window.dispatchEvent(
    new CustomEvent("recycletanto-queued-upload-submitted", { detail }),
  );
}

export function UploadQueueSync() {
  const flushingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const publishCount = async () => {
      const count = await getQueuedUploadCount();
      if (mounted) dispatchQueueCount(count);
    };

    const flushQueue = async () => {
      if (flushingRef.current) return;
      if (!navigator.onLine) {
        await publishCount();
        return;
      }

      flushingRef.current = true;
      try {
        const queued = await listQueuedUploads();

        for (const item of queued) {
          if (!navigator.onLine) break;
          if (!item.queueId) continue;
          if (item.jobId) continue;

          try {
            const job = await submitJobUpload({
              submissionId: item.submissionId,
              imageBlob: item.imageBlob,
              filename: item.filename,
            });

            await attachJobIdToQueuedUpload(item.submissionId, job.id);

            window.localStorage.setItem("activeJobId", job.id);

            dispatchQueuedUploadSubmitted({
              job,
              imageBlob: item.imageBlob,
              submissionId: item.submissionId,
            });

            await publishCount();
          } catch {
            // Stop on first failure to avoid hammering network/server.
            break;
          }
        }
      } finally {
        flushingRef.current = false;
        await publishCount();
      }
    };

    void publishCount();
    void flushQueue();

    const onOnline = () => {
      void flushQueue();
    };

    const interval = window.setInterval(() => {
      void flushQueue();
    }, 15000);

    window.addEventListener("online", onOnline);
    window.addEventListener("recycletanto-flush-queue", onOnline);

    return () => {
      mounted = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("recycletanto-flush-queue", onOnline);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
