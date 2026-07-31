/// <reference lib="webworker" />
// @ts-check
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis.self));
const CACHE_PREFIX = 'gual-vocabulary-index-';
const CACHE_NAME = `${CACHE_PREFIX}v2.4.1`;
const APP_SHELL = new URL('./index.html', sw.location.href).href;
const PRECACHE = [
  './', './index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/components.css', './css/responsive.css',
  './js/app.js', './js/constants.js', './js/utils.js', './js/db.js', './js/store.js',
  './js/search.js', './js/import-export.js', './js/ai.js', './js/ui.js',
  './js/category-view-model.js', './js/entry-model.js',
  './data/seed.json', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
];

async function precacheCurrentVersion() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(PRECACHE.map(async (relativeUrl) => {
    const request = new Request(new URL(relativeUrl, sw.location.href).href, { cache: 'reload' });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`预缓存失败：${relativeUrl}（HTTP ${response.status}）`);
    await cache.put(request, response);
  }));
}

sw.addEventListener('install', (event) => {
  event.waitUntil(precacheCurrentVersion());
  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => sw.clients.claim()),
  );
});

async function fetchAndCache(request) {
  const freshRequest = new Request(request, { cache: 'no-store' });
  const response = await fetch(freshRequest);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirst(request, fallback = null) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request) || (fallback ? await cache.match(fallback) : null);
  if (cached) return cached;
  return fetchAndCache(request);
}

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(cacheFirst(APP_SHELL));
    return;
  }

  event.respondWith(cacheFirst(request));
});
