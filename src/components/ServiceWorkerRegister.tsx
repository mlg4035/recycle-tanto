"use client";

import { useEffect } from "react";

function shouldSkipServiceWorker(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    if (shouldSkipServiceWorker()) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (regs.length === 0) return;
        Promise.all(regs.map((r) => r.unregister())).then(() => {
          if (regs.length > 0) {
            window.location.reload();
          }
        });
      });
      return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          window.dispatchEvent(new Event("recycletanto-sw-update"));
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              window.dispatchEvent(new Event("recycletanto-sw-update"));
            }
          });
        });
      })
      .catch(() => {
        // Keep silent in production UX; offline support is best-effort.
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
