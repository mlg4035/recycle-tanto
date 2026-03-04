import crypto from "node:crypto";
import { getEnv } from "@/lib/env";
import {
  forceSetJobResult,
  getJobByDocumentId,
  getJobById,
  updateJobStatus,
} from "@/lib/jobs-dao";
import { fetchCanonicalResult } from "@/lib/ocr";
import { logDev, logError } from "@/lib/logger";
import type { HandwritingWebhookPayload } from "@/lib/types";

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const env = getEnv();
  const normalizedSignature = signature.replace(/^sha256=/i, "").trim();
  const expected = crypto
    .createHmac("sha256", env.HANDWRITINGOCR_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(normalizedSignature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

export async function processWebhookPayload(payload: HandwritingWebhookPayload) {
  const documentId =
    payload.document_id ?? payload.id ?? payload.documents?.[0]?.id;
  if (!documentId) return;

  const job = getJobByDocumentId(documentId);
  if (!job) return;
  if (job.status === "processed") return;

  const incomingResult =
    payload.result_json ??
    payload.result ??
    (Array.isArray(payload.results) ? payload : null) ??
    (Array.isArray(payload.documents) ? payload : null);
  let finalResult: unknown | null = incomingResult;

  if (!finalResult) {
    finalResult = await fetchCanonicalResult(documentId);
  }

  if (!finalResult) {
    forceSetJobResult({
      id: job.id,
      status: "failed",
      resultJson: null,
      error: "No OCR result received",
    });
    return;
  }

  updateJobStatus(job.id, "processed", {
    resultJson: JSON.stringify(finalResult),
    error: null,
  });
  logDev("Job processed via webhook", { jobId: job.id, documentId });
}

export function markJobFailed(jobId: string, message: string) {
  const job = getJobById(jobId);
  if (!job) return;
  forceSetJobResult({
    id: job.id,
    status: "failed",
    resultJson: null,
    error: message,
  });
  logError("Job marked failed");
}
