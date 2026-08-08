// @ts-check
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (globalThis.self));
const CACHE_PREFIX = 'gual-vocabulary-index-';
const CACHE_NAME = `${CACHE_PREFIX}v4.0.1-runtime-convergence-20260808-1`;
const APP_SHELL = new URL('./index.html', sw.location.href).href;
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './css/v3.css', './css/v3.3.1.css', './css/v3.4.0.css', './css/v4.0.0.css', './css/v4.0.1.css',
  './js/v3-upgrade.js', './js/v3-app.js', './js/v3-ui.js', './js/v3-store.js', './js/v3-db.js',
  './js/v3-model.js', './js/v3-import.js', './js/v3-ai.js', './js/v3-exchange.js', './js/v3-integrations.js', './js/v3-data-worker.js',
  './data/seed.json', './data/seed-report.json', './data/relation-low-level-lexemes.json',
  './assets/icons/vix-icon-180-v4.png', './assets/icons/vix-icon-192-v4.png', './assets/icons/vix-icon-512-v4.png',
];

sw.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
  })());
});


sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await sw.clients.claim();
  })());
});

async function appShellFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = (await cache.match(request)) || (await cache.match(APP_SHELL)) || (await cache.match('./'));
  if (cached) return cached;
  const response = await fetch(request, { cache: 'no-store' });
  if (response.ok) await cache.put(APP_SHELL, response.clone());
  return response;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

sw.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(appShellFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
