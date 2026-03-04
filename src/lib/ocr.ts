import { getEnv, isMockOcrEnabled } from "@/lib/env";
import { logError } from "@/lib/logger";
import type { HandwritingOcrSubmitResponse, HandwritingWebhookPayload } from "@/lib/types";

const mockResult = {
  tables: [
    {
      rows: [
        ["Item", "Qty", "Price"],
        ["Bottles", "5", "12.50"],
        ["Cans", "8", "9.00"],
        ["Paper", "3", "4.25"],
      ],
    },
  ],
};

export async function submitToHandwritingOcr(params: {
  image: Blob;
  filename: string;
}) {
  if (isMockOcrEnabled()) {
    return {
      documentId: `mock_${crypto.randomUUID()}`,
      raw: { document_id: "mock" },
    };
  }

  const env = getEnv();
  const baseUrl = env.HANDWRITINGOCR_BASE_URL.replace(/\/+$/, "");
  const webhookUrl = `${env.APP_PUBLIC_BASE_URL}/api/webhooks/handwritingocr`;
  const form = new FormData();
  form.append("action", env.HANDWRITINGOCR_ACTION);
  form.append("webhook_url", webhookUrl);
  form.append("file", params.image, params.filename);

  const res = await fetch(`${baseUrl}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.HANDWRITINGOCR_API_KEY}`,
      Accept: "application/json",
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`HandwritingOCR submit failed (${res.status})`);
  }

  const data = (await res.json()) as HandwritingOcrSubmitResponse;
  const documentId = data.document_id ?? data.id;
  if (!documentId) {
    throw new Error("HandwritingOCR response missing document id");
  }
  return { documentId, raw: data };
}

export async function fetchCanonicalResult(documentId: string) {
  if (isMockOcrEnabled()) {
    return mockResult;
  }

  const env = getEnv();
  const baseUrl = env.HANDWRITINGOCR_BASE_URL.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/documents/${documentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.HANDWRITINGOCR_API_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    logError("Canonical result fetch failed");
    return null;
  }

  return (await res.json()) as unknown;
}

export function createMockWebhookPayload(documentId: string): HandwritingWebhookPayload {
  return {
    document_id: documentId,
    status: "completed",
    result_json: mockResult,
  };
}
