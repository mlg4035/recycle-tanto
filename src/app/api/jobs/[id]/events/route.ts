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

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const pushUpdate = () => {
        if (closed) return;
        const job = getJobById(id);
        if (!job) {
          controller.enqueue(
            new TextEncoder().encode(encodeSse("error", { error: "Job not found" })),
          );
          safeClose();
          return;
        }

        try {
          controller.enqueue(
            new TextEncoder().encode(
              encodeSse("status", {
                id: job.id,
                status: job.status,
                updatedAt: job.updatedAt,
                resultJson: job.status === "processed" ? job.resultJson : undefined,
                error: job.status === "failed" ? job.error : undefined,
              }),
            ),
          );
        } catch {
          safeClose();
          return;
        }

        if (job.status === "processed" || job.status === "failed") {
          safeClose();
        }
      };

      pushUpdate();
      timer = setInterval(pushUpdate, 800);

      request.signal.addEventListener("abort", () => {
        safeClose();
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
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
