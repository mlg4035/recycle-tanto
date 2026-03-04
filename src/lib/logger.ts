import { isProd } from "@/lib/env";

export function logDev(message: string, meta?: unknown) {
  if (isProd()) return;
  if (meta === undefined) {
    console.log(message);
    return;
  }
  console.log(message, meta);
}

export function logError(message: string, error?: unknown) {
  if (isProd()) {
    console.error(message);
    return;
  }
  console.error(message, error);
}
