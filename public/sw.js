const SHELL_CACHE = "recycletanto-shell-v2";
const RUNTIME_CACHE = "recycletanto-runtime-v2";
const API_CACHE = "recycletanto-api-v2";
const SHELL_URLS = ["/", "/history", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== SHELL_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== API_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }
  const networkResponse = await networkFetch;
  if (networkResponse) return networkResponse;
  return new Response("Offline", { status: 503 });
}

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match(fallbackPath);
    if (fallback) return fallback;
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    const fallbackPath = url.pathname.startsWith("/history") ? "/history" : "/";
    event.respondWith(networkFirst(request, fallbackPath));
    return;
  }

  if (isSameOrigin && url.pathname.startsWith("/api/jobs/")) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (
    isSameOrigin &&
    ["/_next/", "/icons/", "/favicon.ico"].some((prefix) =>
      url.pathname.startsWith(prefix),
    )
  ) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (["image", "style", "script", "font"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
