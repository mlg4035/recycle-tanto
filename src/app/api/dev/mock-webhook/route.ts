import { NextResponse } from "next/server";
import { isMockOcrEnabled } from "@/lib/env";
import { getJobById, updateJobStatus } from "@/lib/jobs-dao";
import { createMockWebhookPayload } from "@/lib/ocr";
import { processWebhookPayload } from "@/lib/webhook-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || !isMockOcrEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { jobId?: string };
    const jobId = (body.jobId ?? "").trim();
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const job = getJobById(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const documentId =
      job.handwritingocrDocumentId ?? `mock_manual_${crypto.randomUUID()}`;

    if (!job.handwritingocrDocumentId) {
      updateJobStatus(job.id, "processing", {
        handwritingocrDocumentId: documentId,
        error: null,
      });
    }

    await processWebhookPayload(createMockWebhookPayload(documentId));
    const updatedJob = getJobById(job.id);

    return NextResponse.json({
      ok: true,
      job: updatedJob
        ? {
            id: updatedJob.id,
            status: updatedJob.status,
            createdAt: updatedJob.createdAt,
            updatedAt: updatedJob.updatedAt,
            resultJson: updatedJob.resultJson,
            error: updatedJob.error,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Trigger failed" }, { status: 500 });
  }
}
