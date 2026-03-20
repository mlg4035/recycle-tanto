"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { processBulkImport, type BulkItem, type BulkProgress } from "@/lib/bulk-processor";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPT = ALLOWED_TYPES.join(",");

function toBulkItems(files: FileList | File[]): BulkItem[] {
  return Array.from(files)
    .filter((f) => ALLOWED_TYPES.includes(f.type))
    .map((f) => ({ blob: f, filename: f.name }));
}

export function BulkImport() {
  const [mode, setMode] = useState<"pc" | "drive">("pc");
  const [items, setItems] = useState<BulkItem[]>([]);
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [doneResult, setDoneResult] = useState<{ saved: number; failed: number } | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFilesSelected = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const newItems = toBulkItems(files);
    setItems((prev) => [...prev, ...newItems]);
    setDoneResult(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      onFilesSelected(e.dataTransfer.files);
    },
    [onFilesSelected],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const clearItems = useCallback(() => {
    setItems([]);
    setProgress(null);
    setDoneResult(null);
    setDriveError(null);
    fileInputRef.current?.value && (fileInputRef.current.value = "");
  }, []);

  const startProcessing = useCallback(async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setProgress({ total: items.length, completed: 0, failed: 0, currentFilename: null, lastError: null });
    setDoneResult(null);

    try {
      const result = await processBulkImport(items, setProgress);
      setDoneResult({
        saved: result.savedLocalIds.length,
        failed: result.failedIndexes.length,
      });
      setItems([]);
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [items]);

  const pickFromDrive = useCallback(async () => {
    setDriveError(null);
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    if (!clientId) {
      setDriveError("Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local");
      return;
    }

    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
      });

    type PickerDoc = { id?: string; name?: string };
    type PickerData = { action?: string; docs?: PickerDoc[] };
    type Win = typeof window & {
      gapi?: { load: (name: string, cb: () => void) => void };
      google?: {
        accounts?: { oauth2?: { initTokenClient: (c: { client_id: string; scope: string }) => { callback?: (r: { access_token?: string; error?: unknown }) => void; requestAccessToken: (opts?: { prompt?: string }) => void } } };
        picker?: {
          PickerBuilder: new () => {
            addView: (v: unknown) => unknown;
            setOAuthToken: (t: string) => unknown;
            setDeveloperKey?: (k: string) => unknown;
            setAppId?: (id: string) => unknown;
            setCallback: (cb: (d: PickerData) => void) => unknown;
            build: () => { setVisible: (v: boolean) => void };
          };
          ViewId?: { DOCS_IMAGES?: string };
        };
      };
    };

    try {
      await loadScript("https://apis.google.com/js/api.js");
      await loadScript("https://accounts.google.com/gsi/client");

      const w = window as Win;
      if (!w.gapi) {
        setDriveError("Google API failed to load.");
        return;
      }

      await new Promise<void>((resolve) => {
        w.gapi!.load("picker", () => resolve());
      });

      const google = w.google;
      if (!google?.accounts?.oauth2?.initTokenClient || !google?.picker?.PickerBuilder) {
        setDriveError("Google Picker or Sign-In failed to load.");
        return;
      }

      const accessToken = await new Promise<string>((resolve, reject) => {
        const tc = google.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly",
        });
        tc.callback = (res) => {
          if (res.error) reject(new Error(String(res.error)));
          else if (res.access_token) resolve(res.access_token);
          else reject(new Error("No access token"));
        };
        tc.requestAccessToken({ prompt: "consent" });
      });

      type PickerBuilderInstance = {
        addView: (v: unknown) => PickerBuilderInstance;
        setOAuthToken: (t: string) => PickerBuilderInstance;
        setDeveloperKey?: (k: string) => PickerBuilderInstance;
        setAppId?: (id: string) => PickerBuilderInstance;
        setCallback: (cb: (d: PickerData) => void) => PickerBuilderInstance;
        build: () => { setVisible: (v: boolean) => void };
      };
      const PickerBuilderClass = google.picker!.PickerBuilder as new () => PickerBuilderInstance;
      let builder: PickerBuilderInstance = new PickerBuilderClass()
        .addView(google.picker!.ViewId?.DOCS_IMAGES ?? "DOCS_IMAGES")
        .setOAuthToken(accessToken)
        .setCallback(async (data: PickerData) => {
          const docs = data.docs ?? [];
          if (docs.length === 0) return;

          const newItems: BulkItem[] = [];
          for (const doc of docs) {
            if (!doc.id) continue;
            try {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                { headers: { Authorization: `Bearer ${accessToken}` } },
              );
              if (!res.ok) continue;
              const blob = await res.blob();
              const name = doc.name ?? `drive-${doc.id}.jpg`;
              newItems.push({ blob, filename: name });
            } catch {
              // skip failed downloads
            }
          }
          if (newItems.length > 0) {
            setItems((prev) => [...prev, ...newItems]);
            setDoneResult(null);
          }
        });

      if (apiKey && builder.setDeveloperKey) builder = builder.setDeveloperKey(apiKey);
      if (appId && builder.setAppId) builder = builder.setAppId(appId);

      const picker = builder.build();
      picker.setVisible(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google Drive error";
      setDriveError(msg);
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-4">
      <h1 className="text-2xl font-semibold">Bulk Import</h1>
      <p className="text-sm text-zinc-600">
        Import multiple images from your PC or Google Drive for table extraction.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("pc")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${mode === "pc" ? "border-zinc-600 bg-zinc-100" : "border-zinc-300"}`}
        >
          From PC
        </button>
        <button
          type="button"
          onClick={() => setMode("drive")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${mode === "drive" ? "border-zinc-600 bg-zinc-100" : "border-zinc-300"}`}
        >
          Google Drive
        </button>
      </div>

      {mode === "pc" && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
          <label className="text-sm font-medium">Select or drop images</label>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(e) => onFilesSelected(e.target.files)}
              className="text-sm"
            />
            <p className="text-xs text-zinc-500">JPEG, PNG, WebP • drag and drop supported</p>
          </div>
        </section>
      )}

      {mode === "drive" && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
          <label className="text-sm font-medium">Select from Google Drive</label>
          <button
            type="button"
            onClick={pickFromDrive}
            disabled={isProcessing}
            className="rounded-lg border border-zinc-400 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Open Google Drive picker
          </button>
          {driveError ? (
            <p className="text-sm text-red-600">{driveError}</p>
          ) : null}
        </section>
      )}

      {items.length > 0 && (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
          <p className="text-sm font-medium">
            {items.length} image{items.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startProcessing}
              disabled={isProcessing}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {isProcessing ? "Processing…" : "Start import"}
            </button>
            <button
              type="button"
              onClick={clearItems}
              disabled={isProcessing}
              className="rounded-lg border border-zinc-400 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </section>
      )}

      {progress && (
        <section className="rounded-lg border border-zinc-300 p-4">
          <p className="text-sm font-medium">
            {progress.completed} / {progress.total} completed
            {progress.failed > 0 ? ` (${progress.failed} failed)` : ""}
          </p>
          {progress.currentFilename ? (
            <p className="text-xs text-zinc-500">Processing: {progress.currentFilename}</p>
          ) : null}
          {progress.lastError ? (
            <p className="text-xs text-red-600">{progress.lastError}</p>
          ) : null}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-zinc-600 transition-all duration-300"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
        </section>
      )}

      {doneResult && !isProcessing && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Import complete: {doneResult.saved} saved, {doneResult.failed} failed
          </p>
          <Link href="/history" className="mt-2 inline-block text-sm text-emerald-700 underline">
            View history
          </Link>
        </section>
      )}

      <Link href="/" className="text-sm text-zinc-600 underline">
        ← Back to scan
      </Link>
    </main>
  );
}
