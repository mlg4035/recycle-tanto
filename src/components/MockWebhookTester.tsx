"use client";

import { useState } from "react";

type TriggerResponse = {
  ok?: boolean;
  error?: string;
  job?: {
    id: string;
    status: string;
    updatedAt: number;
  } | null;
};

export function MockWebhookTester() {
  const [jobId, setJobId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TriggerResponse | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/dev/mock-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = (await response.json()) as TriggerResponse;
      setResult(data);
    } catch {
      setResult({ error: "Server unreachable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 p-4">
      <h2 className="text-lg font-medium">Manual Mock Webhook Trigger</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Enter an existing job ID to force mock completion.
      </p>
      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <input
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="job id"
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          required
        />
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {busy ? "Triggering..." : "Trigger"}
        </button>
      </form>

      {result?.error ? (
        <p className="mt-3 text-sm text-red-600">{result.error}</p>
      ) : null}
      {result?.ok && result.job ? (
        <p className="mt-3 text-sm text-green-700">
          Job {result.job.id} is now {result.job.status}.
        </p>
      ) : null}
    </section>
  );
}
