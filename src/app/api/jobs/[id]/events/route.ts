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
      const pushUpdate = () => {
        const job = getJobById(id);
        if (!job) {
          controller.enqueue(
            new TextEncoder().encode(encodeSse("error", { error: "Job not found" })),
          );
          controller.close();
          return;
        }

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

        if (job.status === "processed" || job.status === "failed") {
          controller.close();
        }
      };

      pushUpdate();
      timer = setInterval(pushUpdate, 800);

      request.signal.addEventListener("abort", () => {
        if (timer) clearInterval(timer);
        controller.close();
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
