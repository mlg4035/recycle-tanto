"use client";

import { useMemo, useState } from "react";
import { normalizeOcrResult } from "@/lib/normalize";
import { TableGrid } from "@/components/TableGrid";

export function RawPayloadViewer() {
  const [payloadText, setPayloadText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedPayload, setParsedPayload] = useState<unknown | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [sampleInfo, setSampleInfo] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [sampleTotal, setSampleTotal] = useState<number | null>(null);

  const normalized = useMemo(() => {
    if (!parsedPayload) return null;
    return normalizeOcrResult(parsedPayload);
  }, [parsedPayload]);

  function parsePayload() {
    setError(null);
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      setParsedPayload(parsed);
    } catch {
      setParsedPayload(null);
      setError("Invalid JSON payload");
    }
  }

  async function loadSamplePayload(targetIndex: number) {
    setLoadingSample(true);
    setError(null);
    setSampleInfo(null);
    try {
      const response = await fetch(`/api/dev/sample-payload?index=${targetIndex}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        payloadText?: string;
        sourceName?: string;
        index?: number;
        total?: number;
        error?: string;
      };

      if (!response.ok || !data.payloadText) {
        setParsedPayload(null);
        setError(data.error ?? "Could not load sample payload file");
        return;
      }

      setPayloadText(data.payloadText);
      const parsed = JSON.parse(data.payloadText) as unknown;
      setParsedPayload(parsed);
      setSampleInfo(data.sourceName ? `Loaded ${data.sourceName}` : "Loaded sample");
      setSampleIndex(typeof data.index === "number" ? data.index : targetIndex);
      setSampleTotal(typeof data.total === "number" ? data.total : null);
    } catch {
      setParsedPayload(null);
      setError("Could not load sample payload file");
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 p-4">
      <h2 className="text-lg font-medium">Raw Payload Viewer</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Paste webhook JSON, then preview normalized table output.
      </p>

      <textarea
        className="mt-3 h-40 w-full rounded border border-zinc-300 p-2 font-mono text-xs"
        placeholder='{"documents":[...]}'
        value={payloadText}
        onChange={(event) => setPayloadText(event.target.value)}
      />

      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-zinc-700 px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => loadSamplePayload(sampleIndex)}
          type="button"
          disabled={loadingSample}
        >
          {loadingSample ? "Loading sample..." : "Load sample payload"}
        </button>
        <button
          className="rounded bg-zinc-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => loadSamplePayload(sampleIndex - 1)}
          type="button"
          disabled={loadingSample || sampleIndex <= 0}
        >
          Previous sample
        </button>
        <button
          className="rounded bg-zinc-600 px-3 py-2 text-sm text-white disabled:opacity-60"
          onClick={() => loadSamplePayload(sampleIndex + 1)}
          type="button"
          disabled={loadingSample || (sampleTotal !== null && sampleIndex >= sampleTotal - 1)}
        >
          Next sample
        </button>
        <button
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
          onClick={parsePayload}
          type="button"
        >
          Parse & Preview
        </button>
      </div>

      {sampleInfo ? <p className="mt-3 text-sm text-green-700">{sampleInfo}</p> : null}
      {sampleTotal !== null ? (
        <p className="mt-1 text-xs text-zinc-600">
          Sample {sampleIndex + 1} / {sampleTotal}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {normalized ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-zinc-700">
            Columns: {normalized.columns.length}, Rows: {normalized.rows.length}
          </p>
          <TableGrid table={normalized} />
        </div>
      ) : null}
    </section>
  );
}
