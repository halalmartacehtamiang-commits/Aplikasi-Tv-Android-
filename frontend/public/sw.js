// Basic offline-first service worker for HalalMart Digital Signage
const CACHE = "hm-signage-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Cache media files for offline playback on TV displays
  if (url.pathname.includes("/api/media/") && url.pathname.endsWith("/file")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        try {
          const resp = await fetch(e.request);
          // Only cache successful responses — never cache 404/502/error responses
          if (resp && resp.ok && resp.status === 200) {
            cache.put(e.request, resp.clone());
          }
          return resp;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
  }
});
