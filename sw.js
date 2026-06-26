/* ============================================
   JOBALLERT — Service Worker
   Handles push notifications & offline caching
   ============================================ */

const CACHE_NAME = 'joballert-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/jobs.html',
  '/recommended.html',
  '/saved.html',
  '/applied.html',
  '/companies.html',
  '/notifications.html',
  '/settings.html',
  '/css/main.css',
  '/css/components.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/supabase-client.js',
  '/js/ai-matcher.js',
  '/js/auth.js',
  '/js/notifications.js',
  '/js/jobs.js',
  '/js/app.js',
];

// ── Install ────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache pre-load failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (Cache-First for static, Network-First for API) ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and Supabase API calls
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('clearbit.com')) return;

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
        return response;
      }).catch(() => {
        // Return offline fallback
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/dashboard.html');
        }
      });
    })
  );
});

// ── Push Notification ─────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'JobAlert', body: 'New job match found!', url: '/recommended.html' };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url },
      actions: [
        { action: 'view', title: 'View Job' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ── Notification Click ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Background Sync (for offline actions) ─
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-applications') {
    event.waitUntil(syncApplications());
  }
});

async function syncApplications() {
  // Sync any offline actions when connection is restored
  // Implementation would push queued actions to Supabase
}
