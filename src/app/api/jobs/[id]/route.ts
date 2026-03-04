import { NextResponse } from "next/server";
import { getJobById } from "@/lib/jobs-dao";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJobById(id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.status === "processed" ? { resultJson: job.resultJson } : {}),
      ...(job.status === "failed" ? { error: job.error } : {}),
    },
  });
}
