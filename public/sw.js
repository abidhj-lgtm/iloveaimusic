// I Love AI Music - Service Worker
const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  '/',
  '/discover',
  '/offline',
];

const MAX_DATA_ENTRIES = 20;
const MAX_IMAGE_ENTRIES = 50;

// Install: Pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_URLS).catch((err) => {
        console.warn('[SW] Failed to pre-cache some URLs:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for API, cache-first for shell and images
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except our API)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) return;

  // API calls: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE, MAX_DATA_ENTRIES));
    return;
  }

  // Images: Cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|avif)$/)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ENTRIES));
    return;
  }

  // App shell: Cache-first with network fallback
  if (request.mode === 'navigate') {
    event.respondWith(cacheFirstWithOfflineFallback(request, APP_SHELL_CACHE));
    return;
  }

  // Everything else: Network-first
  event.respondWith(networkFirstWithCache(request, APP_SHELL_CACHE, MAX_DATA_ENTRIES));
});

// Network-first strategy with cache fallback
async function networkFirstWithCache(request, cacheName, maxEntries) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await trimCache(cacheName, maxEntries);
    }
    return networkResponse;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Cache-first strategy
async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await trimCache(cacheName, maxEntries);
    }
    return networkResponse;
  } catch (err) {
    return new Response('', { status: 404 });
  }
}

// Cache-first with offline fallback
async function cacheFirstWithOfflineFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response('Offline', { status: 503 });
  }
}

// Trim cache to max entries (oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
  }
}

// Background Sync: Replay queued actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  // Notify all clients to replay their queue
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'REPLAY_QUEUE' });
  });
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});