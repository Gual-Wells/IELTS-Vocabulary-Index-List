import assert from 'node:assert/strict';
import test from 'node:test';

import worker, { SessionObject, UsageLedger } from '../worker/src/index.js';

const originalFetch = globalThis.fetch;
const sessionId = `vixs_${'a'.repeat(36)}`;
const hashA = `sha256:${'1'.repeat(64)}`;
const hashB = `sha256:${'2'.repeat(64)}`;

function memoryStorage() {
  const values = new Map();
  return {
    values,
    async get(key) {
      if (Array.isArray(key)) return new Map(key.filter((item) => values.has(item)).map((item) => [item, values.get(item)]));
      return values.get(key);
    },
    async put(key, value) {
      if (typeof key === 'object' && value === undefined) for (const [name, item] of Object.entries(key)) values.set(name, item);
      else values.set(key, value);
    },
    async delete(key) { values.delete(key); },
    async deleteAll() { values.clear(); },
    async setAlarm(value) { values.set('__alarm', value); },
  };
}

function capsule() {
  return {
    protocol: 'vix-session-capsule/2', kind: 'vix-match-request', sessionId,
    sourceCorpusHash: hashA, matchCorpusHash: hashB, requestSequence: 1,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    corpus: [{ slot: 1, text: 'abandon' }, { slot: 2, text: 'ability' }],
  };
}

function workerEnv(overrides = {}) {
  return {
    COLLINS_ACCESS_KEY: 'server-secret',
    COLLINS_MONTHLY_LIMIT: '10',
    ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }) },
    USAGE_LEDGER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => new Response('{}', { status: 200 }) }),
    },
    SESSION_OBJECT: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => new Response('{}', { status: 200 }) }),
    },
    ...overrides,
  };
}

function apiFetch(request, env) {
  return worker.fetch(request, env, {});
}

test.after(() => { globalThis.fetch = originalFetch; });

test('API routes rely on the outer Worker-level Access boundary instead of unavailable Static Assets ctx.access', async () => {
  const response = await worker.fetch(new Request('https://vix.test/api/health'), workerEnv(), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).protocol, 'vix-runtime-health/1');
});

test('runtime capability and health endpoints describe the stable private Worker without secrets', async () => {
  const env = workerEnv();
  const capabilities = await apiFetch(new Request('https://vix.test/api/capabilities'), env);
  assert.equal(capabilities.status, 200);
  assert.deepEqual(await capabilities.json(), {
    protocol: 'vix-runtime-capabilities/1',
    version: '5.0.0-alpha.6',
    deployment: 'private-worker',
    capabilities: { collins: true, sessionBridge: true },
  });
  const health = await apiFetch(new Request('https://vix.test/api/health'), env);
  const body = await health.json();
  assert.equal(body.protocol, 'vix-runtime-health/1');
  assert.equal(body.version, '5.0.0-alpha.6');
  assert.equal(body.status, 'ok');
  assert.deepEqual(body.checks, { assets: true, collinsSecret: true, usageLedger: true, sessionStore: true });
  assert.ok(!JSON.stringify(body).includes('server-secret'));
});

test('Collins bridge relies on the outer Access boundary, validates the registry, and makes one upstream request', async () => {
  let ledgerCalls = 0;
  let upstreamCalls = 0;
  const env = workerEnv({
    USAGE_LEDGER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { ledgerCalls++; return new Response('{}', { status: 200 }); } }),
    },
  });
  globalThis.fetch = async (url, options) => {
    upstreamCalls++;
    const target = url instanceof URL ? url : new URL(url);
    assert.equal(target.hostname, 'api.collinsdictionary.com');
    assert.equal(target.pathname, '/api/v1/dictionaries/american-learner/search/first/');
    assert.equal(target.searchParams.get('q'), 'abandon');
    assert.equal(options.headers.accessKey, 'server-secret');
    return new Response(JSON.stringify({ entryId: 'one', entryContent: '<p>entry</p>' }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(response.status, 200);
  assert.equal(ledgerCalls, 1);
  assert.equal(upstreamCalls, 1);
  assert.equal(response.headers.get('cache-control'), 'no-store, private, max-age=0');
  assert.ok(!(await response.text()).includes('server-secret'));

  const invalid = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: '../other' }),
  }), env);
  assert.equal(invalid.status, 400);
  assert.equal(ledgerCalls, 1);
  assert.equal(upstreamCalls, 1);
});

test('Collins reports missing and rejected server credentials distinctly', async () => {
  const missing = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', body: JSON.stringify({ query: 'thread', dictionaryCode: 'american' }),
  }), workerEnv({ COLLINS_ACCESS_KEY: '' }));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error.code, 'not_configured');

  globalThis.fetch = async () => new Response(null, { status: 401 });
  const rejected = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'thread', dictionaryCode: 'american' }),
  }), workerEnv());
  assert.equal(rejected.status, 502);
  assert.equal((await rejected.json()).error.code, 'upstream_authorization');
});

test('UsageLedger enforces a monthly hard limit', async () => {
  const storage = memoryStorage();
  const ledger = new UsageLedger({ storage });
  const request = () => new Request('https://usage.internal/consume', { method: 'POST', headers: { 'x-limit': '2' } });
  assert.equal((await ledger.fetch(request())).status, 200);
  assert.equal((await ledger.fetch(request())).status, 200);
  assert.equal((await ledger.fetch(request())).status, 429);
  assert.equal(storage.values.get('usage').count, 2);
});

test('SessionObject stores slot-only requests and accepts one bound result with capability hashes', async () => {
  const storage = memoryStorage();
  const object = new SessionObject({ storage });
  const requestCapsule = capsule();
  const created = await object.fetch(new Request('https://session.internal/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-owner-hash': 'owner', 'x-read-hash': 'read', 'x-write-hash': 'write' },
    body: JSON.stringify(requestCapsule),
  }));
  assert.equal(created.status, 201);
  const storedText = [...storage.values.entries()].filter(([key]) => key.startsWith('request:')).map(([, value]) => value).join('');
  assert.ok(!storedText.includes('entryId'));

  const denied = await object.fetch(new Request('https://session.internal/request', { headers: { 'x-token-hash': 'wrong' } }));
  assert.equal(denied.status, 401);
  const read = await object.fetch(new Request('https://session.internal/request', { headers: { 'x-token-hash': 'read' } }));
  assert.equal(read.status, 200);
  assert.deepEqual((await read.json()).corpus.map((row) => row.slot), [1, 2]);

  const result = {
    protocol: 'vix-session-capsule/2', kind: 'vix-match-result', sessionId,
    sourceCorpusHash: hashA, matchCorpusHash: hashB, requestSequence: 1, matchedSlots: [2],
  };
  const written = await object.fetch(new Request('https://session.internal/result', {
    method: 'POST', headers: { 'x-token-hash': 'write', 'content-type': 'application/json' }, body: JSON.stringify(result),
  }));
  assert.equal(written.status, 204);
  const repeated = await object.fetch(new Request('https://session.internal/result', {
    method: 'POST', headers: { 'x-token-hash': 'write', 'content-type': 'application/json' }, body: JSON.stringify(result),
  }));
  assert.equal(repeated.status, 401);
  const ownerRead = await object.fetch(new Request('https://session.internal/result', { headers: { 'x-token-hash': 'owner' } }));
  assert.equal(ownerRead.status, 200);
  assert.deepEqual(await ownerRead.json(), result);
});

test('static asset responses receive the alpha6 security envelope', async () => {
  const response = await worker.fetch(new Request('https://vix.test/index.html'), workerEnv());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/api\.groq\.com/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});
