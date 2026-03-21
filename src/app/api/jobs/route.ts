import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { getEnv, isMockOcrEnabled } from "@/lib/env";
import {
  countRecentUploadAttempts,
  createOrGetJobBySubmission,
  updateJobStatus,
  recordUploadAttempt,
} from "@/lib/jobs-dao";
import { createMockWebhookPayload, submitToHandwritingOcr } from "@/lib/ocr";
import { processWebhookPayload } from "@/lib/webhook-service";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function getIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

function toApiJob(job: {
  id: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function POST(request: Request) {
  try {
    const ip = getIp(request);
    const recentAttempts = countRecentUploadAttempts(ip, RATE_LIMIT_WINDOW_MS);
    if (recentAttempts >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: "Too many uploads. Try again soon." }, { status: 429 });
    }
    recordUploadAttempt(ip);

    const formData = await request.formData();
    const submissionId = String(formData.get("submissionId") ?? "").trim();
    const image = formData.get("image");

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (image.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image exceeds 8MB limit" }, { status: 400 });
    }

    const job = createOrGetJobBySubmission({
      id: nanoid(),
      submissionId,
    });

    if (!job) {
      return NextResponse.json({ error: "Could not create job" }, { status: 500 });
    }

    if (job.status === "processed" || job.status === "processing" || job.status === "failed") {
      return NextResponse.json({ job: toApiJob(job) });
    }

    if (!isMockOcrEnabled()) {
      try {
        const env = getEnv();
        const webhookHost = new URL(env.APP_PUBLIC_BASE_URL).hostname.toLowerCase();
        const rawHost = request.headers.get("host") ?? "";
        const requestHost = rawHost.split(":")[0]?.toLowerCase() ?? "";
        if (
          requestHost &&
          webhookHost !== requestHost &&
          (requestHost === "localhost" || requestHost === "127.0.0.1")
        ) {
          console.warn(
            "[recycletanto] APP_PUBLIC_BASE_URL is " +
              env.APP_PUBLIC_BASE_URL +
              " but this request is to " +
              rawHost +
              ". HandwritingOCR will POST webhooks to the URL in APP_PUBLIC_BASE_URL, " +
              "so your local SQLite job will never update. Use MOCK_OCR=1 for local dev, " +
              "or set APP_PUBLIC_BASE_URL to a tunnel URL (ngrok, cloudflared) that points here.",
          );
        }
      } catch {
        // getEnv may throw if misconfigured; submit path will surface errors
      }
    }

    const submitResponse = await submitToHandwritingOcr({
      image,
      filename: image.name || "capture.jpg",
    });

    const updated = updateJobStatus(job.id, "processing", {
      handwritingocrDocumentId: submitResponse.documentId,
      error: null,
    });

    if (isMockOcrEnabled()) {
      setTimeout(() => {
        processWebhookPayload(createMockWebhookPayload(submitResponse.documentId)).catch(() => {
          updateJobStatus(job.id, "failed", { error: "Mock processing failed" });
        });
      }, 2000);
    }

    return NextResponse.json({
      job: toApiJob(updated ?? job),
    });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
