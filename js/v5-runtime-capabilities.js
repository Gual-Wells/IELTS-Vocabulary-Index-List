import { APP_VERSION } from './v5-version.js';

export const RUNTIME_CAPABILITY_PROTOCOL = 'vix-runtime-capabilities/1';

const STATIC_RUNTIME = Object.freeze({
  protocol: RUNTIME_CAPABILITY_PROTOCOL,
  version: APP_VERSION,
  deployment: 'static',
  capabilities: Object.freeze({ collins: false, sessionBridge: false }),
});

let currentRuntime = STATIC_RUNTIME;
let detectionPromise = null;

function normalizedRuntime(value) {
  if (!value || typeof value !== 'object' || value.protocol !== RUNTIME_CAPABILITY_PROTOCOL) return null;
  return Object.freeze({
    protocol: RUNTIME_CAPABILITY_PROTOCOL,
    version: typeof value.version === 'string' ? value.version : '',
    deployment: value.deployment === 'private-worker' ? 'private-worker' : 'static',
    capabilities: Object.freeze({
      collins: value.capabilities?.collins === true,
      sessionBridge: value.capabilities?.sessionBridge === true,
    }),
  });
}

export function getRuntimeCapabilities() {
  return currentRuntime;
}

export function hasRuntimeCapability(name) {
  return currentRuntime.capabilities?.[name] === true;
}

export function detectRuntimeCapabilities({ timeoutMs = 2500 } = {}) {
  if (detectionPromise) return detectionPromise;
  detectionPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(new URL('../api/capabilities', import.meta.url), {
        method: 'GET',
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok || !/\bapplication\/json\b/i.test(response.headers.get('content-type') || '')) return currentRuntime;
      const detected = normalizedRuntime(await response.json());
      if (detected) currentRuntime = detected;
    } catch {
      // GitHub Pages intentionally has no API runtime. Static is the safe default.
    } finally {
      clearTimeout(timer);
    }
    return currentRuntime;
  })();
  return detectionPromise;
}

