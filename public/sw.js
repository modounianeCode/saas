const VERSION = "argent-clair-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const RSC_CACHE = `${VERSION}-rsc`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Repli minimal disponible même avant la première navigation.
      await cache.addAll([OFFLINE_URL, "/icon.svg"]).catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, RSC_CACHE]);
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Jamais de cache pour l'authentification (codes, cookies de session).
  if (url.pathname.startsWith("/auth/") || url.pathname === "/sw.js") return;

  // Assets Next.js hachés : cache d'abord.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation client (App Router) : payload RSC, mis en cache par chemin.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request, RSC_CACHE, url.pathname));
    return;
  }

  // Navigation pleine page : réseau d'abord, page en cache sinon, repli hors ligne.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Hors ligne" });
  }
}

/** Réseau d'abord, cache d'un URL précis en repli. */
async function networkFirst(request, cacheName, cacheKey) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    return new Response("", { status: 504, statusText: "Hors ligne" });
  }
}

async function navigationHandler(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    // Page exacte (ex. /dashboard) puis, en dernier recours, page hors ligne.
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("", { status: 503, statusText: "Hors ligne" });
  }
}

function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === "basic";
}
