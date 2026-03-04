"use client";

import type { JobResponse } from "@/lib/types";

export async function submitJobUpload(params: {
  submissionId: string;
  imageBlob: Blob;
  filename: string;
}) {
  const formData = new FormData();
  formData.append("submissionId", params.submissionId);
  formData.append("image", params.imageBlob, params.filename);

  const response = await fetch("/api/jobs", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }

  const payload = (await response.json()) as { job: JobResponse };
  return payload.job;
}
