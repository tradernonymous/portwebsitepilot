/**
 * PORT's service worker.
 *
 * A gallery that lives in its visitor's pocket should open without a network, and the
 * photographs should stay hung once seen. Two caches, each with one job:
 *
 *   shell — the build's own files, precached at install. The HTML document is network-first
 *           so a deploy always arrives on the next visit; everything hashed is cache-first,
 *           because its name changes when its contents do.
 *   media — gallery photographs, filled as they are seen (stale-while-revalidate), capped so
 *           the visitor's disk is respected.
 *
 * The videos are YouTube's and stay YouTube's — nothing is proxied through here.
 * Updates are polite: the new worker waits, and takes over only once every tab is done.
 */

const VERSION = 'port-v1';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;
const MEDIA_LIMIT = 220;

/* The build's own files, precached at install. Hashed names come from the manifest below. */
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/port-192.png',
  '/icons/port-512.png',
  '/icons/port-192-maskable.png',
  '/icons/port-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  /* The page asks for the handover once it has nothing on screen; the worker complies. */
  if (event.data === 'port-skip-waiting') self.skipWaiting();
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw new Error('offline and never cached');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit ?? network;
}

/** Keep the media cache a cache, not an attic: oldest entries leave first. */
async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (const key of keys.slice(0, keys.length - limit)) await cache.delete(key);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Only this origin is ours to cache; YouTube, fonts and analytics are not. */
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/media/')) {
    event.respondWith(staleWhileRevalidate(request, MEDIA).then((response) => {
      event.waitUntil(trim(MEDIA, MEDIA_LIMIT));
      return response;
    }));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }

  /* The manifest and icons, fetched fresh enough to keep installs honest. */
  event.respondWith(networkFirst(request, SHELL).catch(() => caches.match(request)));
});
