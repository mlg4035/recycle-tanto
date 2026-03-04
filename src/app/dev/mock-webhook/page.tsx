import { notFound } from "next/navigation";
import Link from "next/link";
import { isMockOcrEnabled } from "@/lib/env";
import { MockWebhookTester } from "@/components/MockWebhookTester";
import { QueueInspector } from "@/components/QueueInspector";
import { RawPayloadViewer } from "@/components/RawPayloadViewer";

export const dynamic = "force-dynamic";

export default function DevMockWebhookPage() {
  if (process.env.NODE_ENV === "production" || !isMockOcrEnabled()) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Dev: Mock Webhook</h1>
      <p className="text-sm text-zinc-600">
        Available only in development with <code>MOCK_OCR=1</code>.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">
          Capture
        </Link>
        <Link href="/history" className="underline">
          History
        </Link>
      </div>
      <MockWebhookTester />
      <QueueInspector />
      <RawPayloadViewer />
    </main>
  );
}
