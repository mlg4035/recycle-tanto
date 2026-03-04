export type JobStatus = "queued" | "processing" | "processed" | "failed";

export type TableModel = {
  columns: string[];
  rows: string[][];
};

export type JobRecord = {
  id: string;
  submissionId: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  handwritingocrDocumentId: string | null;
  resultJson: string | null;
  error: string | null;
};

export type JobResponse = {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  resultJson?: string;
  error?: string | null;
};

export type HandwritingOcrSubmitResponse = {
  document_id?: string;
  id?: string;
  status?: string;
  result?: unknown;
};

export type HandwritingWebhookPayload = {
  document_id?: string;
  id?: string;
  status?: string;
  result?: unknown;
  result_json?: unknown;
  results?: Array<{
    page_number?: number;
    transcript?: string;
  }>;
  documents?: Array<{
    id?: string;
    data?: unknown;
  }>;
};
