"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { compressImage } from "@/lib/image";

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
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed.blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      onCaptured({
        blob: compressed.blob,
        filename: file.name || "capture.jpg",
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
      <label className="text-sm font-medium">Capture photo</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        disabled={disabled || busy}
        onChange={onInputChange}
      />
      {busy ? <p className="text-sm">Compressing image…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt="Captured preview"
          width={400}
          height={300}
          unoptimized
          className="max-h-64 w-auto rounded-md object-contain"
        />
      ) : null}
    </section>
  );
}
