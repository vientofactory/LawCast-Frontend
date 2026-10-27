const CACHE_PREFIX = 'lawcast-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [OFFLINE_URL, '/brand/v2/icon-192.png', '/brand/v2/icon-512.png', '/brand/v2/badge-96.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Keep SSR, API responses, errors and challenge pages out of offline storage.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const fallback = await cache.match(OFFLINE_URL);
      // Pages redirects HTML assets; navigation fallbacks must not replay that redirect.
      return fallback
        ? new Response(fallback.body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : Response.error();
    }));
  } else if (STATIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) =>
      (await cache.match(request)) || fetch(request),
    ));
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {
        title: 'LawCast 알림',
        body: '새로운 업데이트가 있습니다.',
        tag: 'lawcast-notification',
        url: '/',
        data: {},
      };

      if (event.data) {
        const raw = event.data.text();
        try {
          const parsed = JSON.parse(raw);
          payload = {
            ...payload,
            ...parsed,
            data: parsed?.data || {},
          };
        } catch {
          payload = {
            ...payload,
            body: raw || payload.body,
          };
        }
      }

      await self.registration.showNotification(payload.title || 'LawCast 알림', {
        body: payload.body || '새로운 업데이트가 있습니다.',
        icon: '/brand/v2/icon-192.png',
        badge: '/brand/v2/badge-96.png',
        tag: payload.tag || 'lawcast-notification',
        data: {
          url: payload.url || '/',
          ...(payload.data || {}),
        },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            return client.focus().then(() => client.navigate(targetUrl));
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      }),
  );
});
