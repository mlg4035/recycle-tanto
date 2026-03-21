/** Compress image from File or Blob (with filename for Blob) */
export async function compressImage(
  file: File | Blob,
  filename?: string,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const f =
    file instanceof File
      ? file
      : new File([file], filename ?? "image.jpg", {
          type: file.type || "image/jpeg",
        });

  const objectUrl = URL.createObjectURL(f);

  try {
    const img = await loadImage(objectUrl);

    const maxEdge = 1600;
    const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;

    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }

    // Composite onto white before JPEG export
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

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
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for compression"));

    img.src = src;
  });
}
