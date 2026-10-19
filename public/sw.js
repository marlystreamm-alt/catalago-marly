/* MA² emergency cache cleanup service worker.
   Replaces older PWA workers, clears stale application caches, then unregisters itself. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally do not intercept requests. Everything must come from the network.
});
