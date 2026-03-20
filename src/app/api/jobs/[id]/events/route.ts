import { getJobById } from "@/lib/jobs-dao";

export const runtime = "nodejs";

function encodeSse(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  let timer: NodeJS.Timeout | null = null;
  let closed = false;

  const encoder = new TextEncoder();

  const cleanup = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const safeClose = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (closed) return;
    closed = true;
    cleanup();
    try {
      controller.close();
    } catch {
      // ignore: controller may already be closed
    }
  };

  const safeEnqueue = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    chunk: Uint8Array,
  ) => {
    if (closed) return false;
    try {
      controller.enqueue(chunk);
      return true;
    } catch {
      closed = true;
      cleanup();
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const pushUpdate = () => {
        if (closed) return;

        const job = getJobById(id);

        if (!job) {
          safeEnqueue(
            controller,
            encoder.encode(encodeSse("error", { error: "Job not found" })),
          );
          safeClose(controller);
          return;
        }

        const ok = safeEnqueue(
          controller,
          encoder.encode(
            encodeSse("status", {
              id: job.id,
              status: job.status,
              updatedAt: job.updatedAt,
              resultJson: job.status === "processed" ? job.resultJson : undefined,
              error: job.status === "failed" ? job.error : undefined,
            }),
          ),
        );

        if (!ok) return;

        if (job.status === "processed" || job.status === "failed") {
          safeClose(controller);
        }
      };

      pushUpdate();

      if (!closed) {
        timer = setInterval(pushUpdate, 800);
      }

      request.signal.addEventListener("abort", () => {
        safeClose(controller);
      });
    },

    cancel() {
      closed = true;
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
