/**
 * Medico Service Worker
 * Strategy:
 *  - Static assets  → Cache First (fast loads)
 *  - HTML pages     → Network First, fallback to cache, fallback to offline.html
 *  - API/IoT POST   → Network only (always fresh data)
 *  - Socket.IO      → Network only
 */

const CACHE_VERSION  = 'v2';
const STATIC_CACHE   = `medico-static-${CACHE_VERSION}`;
const PAGES_CACHE    = `medico-pages-${CACHE_VERSION}`;
const ALL_CACHES     = [STATIC_CACHE, PAGES_CACHE];

// Files to pre-cache on install
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Routes that must always be fresh (never serve stale)
const NETWORK_ONLY_PATTERNS = [
  '/api/',
  '/socket.io/',
  '/auth/login',
  '/auth/logout',
  '/auth/register'
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !ALL_CACHES.includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET + non-same-origin
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin)  return;

  // Network-only patterns
  if (NETWORK_ONLY_PATTERNS.some(p => url.pathname.startsWith(p))) return;

  // Static assets (CSS/JS/images/fonts) → Cache First
  if (/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|ttf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages → Network First
  event.respondWith(networkFirst(request));
});

// ── Strategies ────────────────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Last resort: offline page
    const offline = await caches.match('/offline.html');
    return offline || new Response(
      '<h1>Offline</h1><p>Please reconnect to use Medico.</p>',
      { headers: { 'Content-Type': 'text/html' }, status: 503 }
    );
  }
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Medico Alert', body: event.data.text() }; }

  const options = {
    body:    data.body    || 'New health alert received',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    tag:     data.tag     || 'medico-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: data.url || '/alerts', patientId: data.patientId },
    actions: [
      { action: 'view',    title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss'    }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Medico Alert', options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = (event.action === 'view' && event.notification.data?.url)
    ? event.notification.data.url
    : '/alerts';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => c.url.includes(targetUrl) && 'focus' in c);
        if (existing) return existing.focus();
        return clients.openWindow(targetUrl);
      })
  );
});

// ── Background Sync (retry failed vital POSTs) ────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-vitals') {
    event.waitUntil(retryCachedVitals());
  }
});

async function retryCachedVitals() {
  // In a real implementation, read from IndexedDB and retry
  // Placeholder for future offline vital queuing
  console.log('[SW] Background sync triggered — sync-vitals');
}

// ── Message from page ─────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CACHE_URLS') {
    caches.open(PAGES_CACHE).then(cache => cache.addAll(event.data.urls || []));
  }
});
