// Minimal service worker -- its only job is to exist with a fetch handler
// so Chrome/Edge recognize this site as an installable app. It doesn't cache
// anything; every request just goes straight to the network as normal.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
