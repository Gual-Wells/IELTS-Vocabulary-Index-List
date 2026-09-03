// 4.6.0 keeps browser history scroll state available as a first-pass hint, but
// VIX semantic positions are authoritative after dynamically rebuilt virtual
// layouts settle. Navigation API traversals opt into manual timing and invoke
// event.scroll() only after target geometry is prepared.
if ('scrollRestoration' in history) history.scrollRestoration = 'auto';

// Cache-generation bridge. Keep this identifier aligned with sw.js so the
// current unified runtime is not mistaken for an obsolete app shell.
(() => {
  const CACHE_PREFIX = 'gual-vocabulary-index-';
  const EXPECTED_CACHE = `${CACHE_PREFIX}v5.0.0-alpha.4-unified-runtime-20260904-1`;
  const SESSION_KEY = 'vocabulary-index:cache-bridge:5.0.0-alpha.4';
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
