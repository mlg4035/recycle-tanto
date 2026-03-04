import { NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { processWebhookPayload, verifyWebhookSignature } from "@/lib/webhook-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  const validSignature = verifyWebhookSignature(rawBody, signature);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    void processWebhookPayload(payload).catch((error) => {
      logError("Webhook processing failed", error);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("Webhook parse failed", error);
    return NextResponse.json({ ok: true });
  }
}
