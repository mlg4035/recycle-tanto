"use client";

import { useEffect, useState } from "react";

type Props = {
  onCaptured: (data: { blob: Blob; filename: string }) => void;
  disabled?: boolean;
};

export function CameraCapture({ onCaptured, disabled }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);

    try {
      const url = URL.createObjectURL(file);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);

      onCaptured({
        blob: file,
        filename: file.name || "upload.jpg",
      });
    } catch {
      setError("Upload failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4">
      <label className="text-sm font-medium">Upload photo</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled || busy}
        onChange={onInputChange}
      />
      {busy ? <p className="text-sm">Preparing image…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Upload preview"
          className="max-h-64 w-auto rounded-md object-contain"
        />
      ) : null}
    </section>
  );
}
