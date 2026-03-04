"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaClientUX() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [queuedCount, setQueuedCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const onSwUpdate = () => {
      setUpdateAvailable(true);
      setDismissed(false);
    };

    const onOnline = () => setIsOffline(false);
    const onOffline = () => {
      setIsOffline(true);
      setDismissed(false);
    };
    const onQueueCount = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      setQueuedCount(typeof detail?.count === "number" ? detail.count : 0);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("recycletanto-sw-update", onSwUpdate);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("recycletanto-queue-count", onQueueCount);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("recycletanto-sw-update", onSwUpdate);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("recycletanto-queue-count", onQueueCount);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstallEvent(null);
    }
  }

  async function applyUpdate() {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => window.location.reload(), 250);
  }

  function retryQueueNow() {
    window.dispatchEvent(new Event("recycletanto-flush-queue"));
  }

  if (
    dismissed ||
    (!installEvent && !updateAvailable && !isOffline && queuedCount === 0)
  ) {
    return null;
  }

  const message = updateAvailable
    ? "A new app version is ready."
    : isOffline
      ? "You are offline. Saved history is still available."
      : queuedCount > 0
        ? `Queued for upload: ${queuedCount}.`
      : "Install RecycleTanto for faster home screen access.";

  return (
    <div className="fixed right-3 bottom-3 left-3 z-50 rounded-lg border border-zinc-300 bg-white p-3 shadow-lg md:left-auto md:w-[380px]">
      <p className="text-sm">{message}</p>
      <div className="mt-2 flex gap-2">
        {installEvent ? (
          <button
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
            onClick={installApp}
            type="button"
          >
            Install app
          </button>
        ) : null}
        {updateAvailable ? (
          <button
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
            onClick={applyUpdate}
            type="button"
          >
            Update now
          </button>
        ) : null}
        {queuedCount > 0 ? (
          <button
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
            onClick={retryQueueNow}
            type="button"
            disabled={isOffline}
          >
            Retry uploads
          </button>
        ) : null}
        <button
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
