import { db } from "@/lib/db";
import type { JobRecord, JobStatus } from "@/lib/types";

type JobRow = {
  id: string;
  submission_id: string;
  status: JobStatus;
  created_at: number;
  updated_at: number;
  handwritingocr_document_id: string | null;
  result_json: string | null;
  error: string | null;
};

function mapRow(row: JobRow): JobRecord {
  return {
    id: row.id,
    submissionId: row.submission_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    handwritingocrDocumentId: row.handwritingocr_document_id,
    resultJson: row.result_json,
    error: row.error,
  };
}

export function getJobById(id: string) {
  const row = db
    .prepare("SELECT * FROM jobs WHERE id = ?")
    .get(id) as JobRow | undefined;
  return row ? mapRow(row) : null;
}

export function getJobBySubmissionId(submissionId: string) {
  const row = db
    .prepare("SELECT * FROM jobs WHERE submission_id = ?")
    .get(submissionId) as JobRow | undefined;
  return row ? mapRow(row) : null;
}

export function getJobByDocumentId(documentId: string) {
  const row = db
    .prepare("SELECT * FROM jobs WHERE handwritingocr_document_id = ?")
    .get(documentId) as JobRow | undefined;
  return row ? mapRow(row) : null;
}

export function createJob(params: { id: string; submissionId: string }) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO jobs (id, submission_id, status, created_at, updated_at)
     VALUES (?, ?, 'queued', ?, ?)`,
  ).run(params.id, params.submissionId, now, now);
  return getJobById(params.id);
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  extra?: {
    handwritingocrDocumentId?: string | null;
    resultJson?: string | null;
    error?: string | null;
  },
) {
  const now = Date.now();
  db.prepare(
    `UPDATE jobs
     SET status = ?,
         updated_at = ?,
         handwritingocr_document_id = CASE WHEN ? THEN ? ELSE handwritingocr_document_id END,
         result_json = CASE WHEN ? THEN ? ELSE result_json END,
         error = CASE WHEN ? THEN ? ELSE error END
     WHERE id = ?`,
  ).run(
    status,
    now,
    extra?.handwritingocrDocumentId !== undefined ? 1 : 0,
    extra?.handwritingocrDocumentId ?? null,
    extra?.resultJson !== undefined ? 1 : 0,
    extra?.resultJson ?? null,
    extra?.error !== undefined ? 1 : 0,
    extra?.error ?? null,
    id,
  );
  return getJobById(id);
}

export function forceSetJobResult(params: {
  id: string;
  status: JobStatus;
  resultJson: string | null;
  error: string | null;
}) {
  const now = Date.now();
  db.prepare(
    `UPDATE jobs
     SET status = ?, updated_at = ?, result_json = ?, error = ?
     WHERE id = ?`,
  ).run(params.status, now, params.resultJson, params.error, params.id);
  return getJobById(params.id);
}

export function createOrGetJobBySubmission(params: {
  id: string;
  submissionId: string;
}) {
  const existing = getJobBySubmissionId(params.submissionId);
  if (existing) return existing;

  try {
    const created = createJob(params);
    if (!created) throw new Error("Failed to create job");
    return created;
  } catch {
    const raceExisting = getJobBySubmissionId(params.submissionId);
    if (raceExisting) return raceExisting;
    throw new Error("Could not create or fetch job");
  }
}

export function recordUploadAttempt(ip: string) {
  db.prepare("INSERT INTO upload_attempts (ip, created_at) VALUES (?, ?)")
    .run(ip, Date.now());
}

export function countRecentUploadAttempts(ip: string, windowMs: number) {
  const since = Date.now() - windowMs;
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM upload_attempts WHERE ip = ? AND created_at >= ?",
    )
    .get(ip, since) as { count: number };
  return row.count;
}
