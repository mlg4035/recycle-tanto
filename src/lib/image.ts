/** Compress image from File or Blob (with filename for Blob) */
export async function compressImage(
  file: File | Blob,
  filename?: string,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const f = file instanceof File ? file : new File([file], filename ?? "image.jpg", { type: file.type || "image/jpeg" });
  const bitmap = await createImageBitmap(f);
  const maxEdge = 1600;
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (!value) {
          reject(new Error("Image compression failed"));
          return;
        }
        resolve(value);
      },
      "image/jpeg",
      0.75,
    );
  });

  return { blob, width, height };
}
