const CACHE_PREFIX = 'lawcast-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v6`;
const OFFLINE_URL = '/offline.html';
const LAUNCH_URL = '/pwa-start.html';
const STATIC_ASSETS = [OFFLINE_URL, LAUNCH_URL, '/brand/v2/icon-192.png', '/brand/v2/icon-512.png', '/brand/v2/badge-96.png'];

async function cachedDocument(path) {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(path);
  // Pages redirects HTML assets; navigation responses must not replay that redirect.
  return response
    ? new Response(response.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    : fetch(path);
}

// These bounded, per-client transfers are never written to Cache Storage.
const launchTransfers = new Map();
const styleTransfers = new Map();
const TRANSFER_TTL = 120000;
const MAX_TRANSFERS = 4;

function pruneTransfers() {
  for (const store of [launchTransfers, styleTransfers]) {
    for (const [id, entry] of store) {
      if (Date.now() - entry.created > TRANSFER_TTL) {
        entry.controller?.abort();
        entry.port?.postMessage({ status: 'retry' });
        entry.port?.close();
        store.delete(id);
      }
    }
    while (store.size > MAX_TRANSFERS) {
      const id = store.keys().next().value;
      store.get(id).controller?.abort();
      store.get(id).port?.postMessage({ status: 'retry' });
      store.get(id).port?.close();
      store.delete(id);
    }
  }
}

async function boundedResponse(response, limit) {
  const reader = response.body?.getReader();
  const chunks = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) throw new Error('Launch response exceeds transfer limit');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(response.headers);
  // Fetch has already decoded the network body.
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
}

function launchStyles(html, base) {
  const styles = new Set();
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const url = new URL(href, base);
    // Vite resolves CSS imports into these immutable same-origin bundles.
    if (url.origin === self.location.origin && /^\/_app\/immutable\/assets\/[^/]+\.css$/.test(url.pathname) && !url.search) {
      styles.add(url.href);
    }
  }
  if (styles.size > 16) throw new Error('Too many launch stylesheets');
  return [...styles];
}

self.addEventListener('message', (event) => {
  const port = event.ports?.[0];
  const source = event.source;
  if (event.data?.type !== 'PREPARE_LAUNCH' || !port || !source?.id) return;
  if (typeof source.url !== 'string' || typeof event.data.url !== 'string') return;
  let sourceUrl;
  let target;
  try {
    sourceUrl = new URL(source.url);
    target = new URL(event.data.url, self.location.origin);
  } catch { return; }
  if (sourceUrl.origin !== self.location.origin || !['/pwa-start', LAUNCH_URL].includes(sourceUrl.pathname) || target.origin !== self.location.origin || target.pathname !== '/' || target.username || target.password) return;
  target.hash = '';
  launchTransfers.get(source.id)?.controller.abort();
  launchTransfers.delete(source.id);
  pruneTransfers();
  const entry = { url: target.href, created: Date.now(), controller: new AbortController(), port, styles: new Map(), response: null };
  launchTransfers.set(source.id, entry);
  pruneTransfers();
  port.postMessage({ status: 'accepted' });
  event.waitUntil((async () => {
    const timeout = setTimeout(() => entry.controller.abort(), 90000);
    try {
      let response;
      try {
        response = await fetch(target.href, { credentials: 'same-origin', headers: { Accept: 'text/html' }, redirect: 'manual', signal: entry.controller.signal });
      } catch (error) {
        if (entry.controller.signal.aborted) throw error;
        response = await cachedDocument(OFFLINE_URL);
      }
      // Redirects must be handled by a real navigation, including cross-origin redirects.
      if (response.type === 'opaqueredirect' || response.status === 204 || response.status === 205) {
        launchTransfers.delete(source.id);
        port.postMessage({ status: 'navigate' });
        return;
      }
      entry.response = await boundedResponse(response, 1024 * 1024);
      if (response.headers.get('content-type')?.includes('text/html') && response.headers.get('cf-mitigated') !== 'challenge') {
        const html = await entry.response.clone().text();
        const urls = launchStyles(html, target.href);
        await Promise.all(urls.map(async (url) => {
          const css = await fetch(url, { credentials: 'same-origin', redirect: 'error', signal: entry.controller.signal });
          if (!css.ok || !css.headers.get('content-type')?.includes('text/css')) throw new Error('Launch stylesheet unavailable');
          entry.styles.set(url, await boundedResponse(css, 512 * 1024));
        }));
      }
      const client = await self.clients.get(source.id);
      if (launchTransfers.get(source.id) !== entry || !client || !['/pwa-start', LAUNCH_URL].includes(new URL(client.url).pathname)) return;
      entry.created = Date.now();
      port.postMessage({ status: 'ready' });
    } catch {
      entry.controller.abort();
      if (launchTransfers.get(source.id) === entry) {
        launchTransfers.delete(source.id);
        port.postMessage({ status: 'retry' });
      }
    } finally {
      clearTimeout(timeout);
      port.close();
    }
  })());
});

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

  // The installed app paints this local entry before starting the real navigation.
  // Keep normal navigations intact so their status, redirects and headers survive.
  if (request.mode === 'navigate' && ['/pwa-start', LAUNCH_URL].includes(url.pathname)) {
    event.respondWith(cachedDocument(LAUNCH_URL));
    return;
  }

  pruneTransfers();
  const styles = styleTransfers.get(event.clientId);
  if (styles?.styles.has(request.url)) {
    const response = styles.styles.get(request.url);
    styles.styles.delete(request.url);
    if (!styles.styles.size) styleTransfers.delete(event.clientId);
    event.respondWith(Promise.resolve(response));
    return;
  }
  if (request.mode === 'navigate') {
    const owner = event.replacesClientId || event.clientId;
    const transfer = launchTransfers.get(owner);
    const destination = new URL(request.url);
    destination.hash = '';
    if (transfer?.response && transfer.url === destination.href) {
      launchTransfers.delete(owner);
      if (event.resultingClientId && transfer.styles.size) {
        styleTransfers.set(event.resultingClientId, { created: Date.now(), styles: transfer.styles });
        pruneTransfers();
      }
      event.respondWith(Promise.resolve(transfer.response));
      return;
    }
  }

  // Ordinary navigations remain network-first; no SSR or API response is persisted.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => cachedDocument(OFFLINE_URL)));
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
