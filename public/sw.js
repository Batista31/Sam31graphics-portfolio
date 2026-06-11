/**
 * samyak-portfolio Service Worker
 *
 * WHAT THIS DOES (and why it's better than Redis for a 3D portfolio):
 *
 * Redis = server-side key-value DB. It cannot touch your visitor's GPU/CPU.
 * Service Worker = browser-native caching layer. It intercepts HTTP requests
 * and returns cached responses from disk — so .mp4 videos, .glb models, and
 * .jpg images load INSTANTLY on second visit, with no server hit at all.
 *
 * Redis caches data between your server and your database.
 * This SW caches assets between your server and your user's browser.
 * For a static 3D portfolio, only the SW matters.
 */

const CACHE_NAME = "samyak-portfolio-v2";

// Assets to pre-cache on install (critical for first paint)
const PRECACHE = [
  "/",
  "/models/samyak-character/samyak.glb",
];

// Asset patterns to cache on first request (lazy cache)
const CACHEABLE = [
  /\.glb$/,
  /\.gltf$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.png$/,
  /\.webp$/,
  /\.mp4$/,
  /\.mov$/,
  /\.webm$/,
  /\.woff2$/,
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {
        // Don't fail install if precache misses — files may not exist yet
      })
    )
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch — Cache-first for static assets, network-first for pages ──────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin or CDN requests
  if (request.method !== "GET") return;

  const isCacheable = CACHEABLE.some((pattern) => pattern.test(url.pathname));

  if (isCacheable) {
    // Cache-first strategy: instant on repeat visits
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const fresh = await fetch(request);
        if (fresh.ok) {
          // Clone before consuming — response body can only be read once
          cache.put(request, fresh.clone());
        }
        return fresh;
      })
    );
  }
  // All other requests (HTML, API) go straight to network
});
