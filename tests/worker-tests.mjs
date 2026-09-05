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
    version: '5.0.0-alpha.9',
    deployment: 'private-worker',
    capabilities: { collins: true, sessionBridge: true },
  });
  const health = await apiFetch(new Request('https://vix.test/api/health'), env);
  const body = await health.json();
  assert.equal(body.protocol, 'vix-runtime-health/1');
  assert.equal(body.version, '5.0.0-alpha.9');
  assert.equal(body.status, 'ok');
  assert.deepEqual(body.checks, { assets: true, collinsSecret: true, usageLedger: true, sessionStore: true });
  assert.ok(!JSON.stringify(body).includes('server-secret'));
});

test('Collins bridge relies on the outer Access boundary, validates the registry, and makes one identified upstream request', async () => {
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
    assert.equal(target.pathname, '/api/v1/dictionaries/american-learner/search/first');
    assert.equal(target.searchParams.get('q'), 'abandon');
    assert.equal(options.headers.accessKey, 'server-secret');
    assert.match(options.headers['user-agent'], /^Vocabulary-Index\/5\.0\.0-alpha\.9 /);
    assert.equal(options.redirect, 'manual');
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
  const rejectedError = (await rejected.json()).error;
  assert.equal(rejectedError.code, 'upstream_authorization');
  assert.deepEqual(rejectedError.diagnostics, {
    upstreamStatus: 401, contentType: '', challenged: false, cfRay: '',
    attempts: 1, strategy: 'vix-service', firstFailure: '',
  });
});

test('Collins identifies an upstream Cloudflare challenge without retaining its HTML', async () => {
  const warnings = [];
  const userAgents = [];
  const originalWarn = console.warn;
  console.warn = (value) => warnings.push(String(value));
  globalThis.fetch = async (_url, options) => {
    userAgents.push(options.headers['user-agent']);
    return new Response('<html>challenge</html>', {
      status: 403,
      headers: { 'content-type': 'text/html; charset=UTF-8', 'cf-mitigated': 'challenge', 'cf-ray': 'safe-ray-id' },
    });
  };
  let response;
  try {
    response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'emission', dictionaryCode: 'american-learner' }),
    }), workerEnv());
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(response.status, 502);
  const failure = (await response.json()).error;
  assert.equal(failure.code, 'upstream_challenge');
  assert.equal(failure.message, 'Collins 官方防护拦截了服务器请求');
  assert.deepEqual(failure.diagnostics, {
    upstreamStatus: 403, contentType: 'text/html', challenged: true, cfRay: 'safe-ray-id',
    attempts: 2, strategy: 'cloudflare-workers', firstFailure: 'challenge',
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"challenged":true/);
  assert.match(warnings[0], /"cfRay":"safe-ray-id"/);
  assert.match(warnings[0], /"attempts":2/);
  assert.match(warnings[0], /"strategy":"cloudflare-workers"/);
  assert.doesNotMatch(warnings[0], /emission|server-secret|challenge<\/html>/);
  assert.deepEqual(userAgents, [
    'Vocabulary-Index/5.0.0-alpha.9 (+https://github.com/Gual-Wells/IELTS-Vocabulary-Index-List)',
    'Cloudflare-Workers',
  ]);
});

test('Collins retries one challenged request with the fallback server identity without consuming the ledger twice', async () => {
  let ledgerCalls = 0;
  const requests = [];
  const notices = [];
  const originalInfo = console.info;
  console.info = (value) => notices.push(String(value));
  const env = workerEnv({
    USAGE_LEDGER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { ledgerCalls++; return new Response('{}', { status: 200 }); } }),
    },
  });
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), userAgent: options.headers['user-agent'], accessKey: options.headers.accessKey });
    if (requests.length === 1) {
      return new Response('<html>challenge</html>', {
        status: 403,
        headers: { 'content-type': 'text/html', 'cf-mitigated': 'challenge', 'cf-ray': 'first-ray' },
      });
    }
    return new Response(JSON.stringify({ entryId: 'one', entryContent: '<p>entry</p>' }), {
      headers: { 'content-type': 'application/json', 'cf-ray': 'second-ray' },
    });
  };
  let response;
  try {
    response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'earnest', dictionaryCode: 'american-learner' }),
    }), env);
  } finally {
    console.info = originalInfo;
  }
  assert.equal(response.status, 200);
  assert.equal(ledgerCalls, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].userAgent, 'Vocabulary-Index/5.0.0-alpha.9 (+https://github.com/Gual-Wells/IELTS-Vocabulary-Index-List)');
  assert.equal(requests[1].userAgent, 'Cloudflare-Workers');
  assert.ok(requests.every((item) => item.accessKey === 'server-secret'));
  assert.ok(requests.every((item) => !item.url.includes('server-secret')));
  assert.equal(notices.length, 1);
  assert.match(notices[0], /"event":"collins_upstream_recovered"/);
  assert.match(notices[0], /"firstCfRay":"first-ray"/);
  assert.match(notices[0], /"cfRay":"second-ray"/);
  assert.doesNotMatch(notices[0], /earnest|server-secret|challenge<\/html>/);
});

test('Collins retries an unlabelled HTML 403 once and keeps one ledger charge', async () => {
  let ledgerCalls = 0;
  let upstreamCalls = 0;
  const env = workerEnv({
    USAGE_LEDGER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { ledgerCalls++; return new Response('{}', { status: 200 }); } }),
    },
  });
  globalThis.fetch = async () => {
    upstreamCalls++;
    if (upstreamCalls === 1) return new Response('<html>blocked</html>', {
      status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cf-ray': 'first-html-ray' },
    });
    return new Response(JSON.stringify({ entryId: 'one', entryContent: '<p>entry</p>' }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'earnest', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(response.status, 200);
  assert.equal(upstreamCalls, 2);
  assert.equal(ledgerCalls, 1);
});

test('Collins distinguishes JSON permission denial from an HTML edge block', async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { 'content-type': 'application/json', 'cf-ray': 'json-ray' },
    });
  };
  let response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'earnest', dictionaryCode: 'american-learner' }),
  }), workerEnv());
  let failure = (await response.json()).error;
  assert.equal(failure.code, 'upstream_forbidden');
  assert.equal(failure.diagnostics.upstreamStatus, 403);
  assert.equal(failure.diagnostics.contentType, 'application/json');
  assert.equal(upstreamCalls, 1, 'JSON permission failures are not retried');

  upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response('<html>edge block</html>', {
      status: 403, headers: { 'content-type': 'text/html', 'cf-ray': `html-ray-${upstreamCalls}` },
    });
  };
  response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'earnest', dictionaryCode: 'american-learner' }),
  }), workerEnv());
  failure = (await response.json()).error;
  assert.equal(failure.code, 'upstream_blocked');
  assert.equal(failure.diagnostics.attempts, 2);
  assert.equal(failure.diagnostics.strategy, 'cloudflare-workers');
  assert.equal(failure.diagnostics.firstFailure, 'html-403');
  assert.equal(upstreamCalls, 2);
});

test('Collins does not follow an unexpected redirect with the server secret', async () => {
  globalThis.fetch = async () => new Response(null, {
    status: 302, headers: { location: 'https://invalid.example/' },
  });
  const response = await apiFetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'emission', dictionaryCode: 'american' }),
  }), workerEnv());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, 'upstream_redirect');
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

test('static asset responses receive the alpha9 security envelope', async () => {
  const response = await worker.fetch(new Request('https://vix.test/index.html'), workerEnv());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/api\.groq\.com/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});
