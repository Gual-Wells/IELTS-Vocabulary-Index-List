// 4.4.0 lets the UA restore physical scroll for committed same-document Back
// traversals after VIX has synchronously rebuilt the target DOM. VIX snapshots
// remain the fallback for process/session recovery and non-Navigation-API paths.
if ('scrollRestoration' in history) history.scrollRestoration = 'auto';

// Cache-generation bridge. It exists only to prevent an old service-worker
// shell from being mixed with the 4.4.0 runtime after the runtime-generation change.
(() => {
  const CACHE_PREFIX = 'gual-vocabulary-index-';
  const EXPECTED_CACHE = `${CACHE_PREFIX}v4.4.0-runtime-correctness-20260810-1`;
  const SESSION_KEY = 'vocabulary-index:cache-bridge:4.4.0';
  if (!('caches' in globalThis)) return;

  caches.keys().then(async (keys) => {
    const stale = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== EXPECTED_CACHE);
    if (!stale.length) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Cache cleanup remains safe when sessionStorage is unavailable.
    }
    document.documentElement.style.visibility = 'hidden';
    await Promise.all(stale.map((key) => caches.delete(key)));
    location.replace(location.href);
  }).catch(() => {
    document.documentElement.style.visibility = '';
  });
})();
