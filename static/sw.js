self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
        icon: '/favicon.png',
        badge: '/favicon.png',
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
