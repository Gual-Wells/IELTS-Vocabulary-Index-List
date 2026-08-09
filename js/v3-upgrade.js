// Cache-generation bridge. It exists only to prevent an old service-worker
// shell from being mixed with the 4.2.0 runtime during a major content break.
(() => {
  const CACHE_PREFIX = 'gual-vocabulary-index-';
  const EXPECTED_CACHE = `${CACHE_PREFIX}v4.2.0-native-sticky-navigation-20260809-1`;
  const SESSION_KEY = 'vocabulary-index:cache-bridge:4.2.0';
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
