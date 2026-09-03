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

function encodePart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function accessFixture() {
  const pair = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  Object.assign(publicJwk, { kid: 'test-key', alg: 'RS256', use: 'sig' });
  async function token(overrides = {}) {
    const header = encodePart({ alg: 'RS256', kid: publicJwk.kid, typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const payload = encodePart({
      iss: 'https://vix-tests.cloudflareaccess.com', aud: ['vix-audience'],
      iat: now - 10, nbf: now - 10, exp: now + 300, email: 'test@example.invalid',
      ...overrides,
    });
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${payload}`),
    );
    return `${header}.${payload}.${Buffer.from(signature).toString('base64url')}`;
  }
  return { publicJwk, token };
}

test.after(() => { globalThis.fetch = originalFetch; });

test('Collins bridge requires Access, validates registry, hides the secret and makes one upstream request', async () => {
  let ledgerCalls = 0;
  let upstreamCalls = 0;
  let jwksCalls = 0;
  const access = await accessFixture();
  const env = {
    ALLOW_UNPROTECTED_LOCAL: 'false', COLLINS_ACCESS_KEY: 'server-secret', COLLINS_MONTHLY_LIMIT: '10',
    TEAM_DOMAIN: 'https://vix-tests.cloudflareaccess.com', POLICY_AUD: 'vix-audience',
    USAGE_LEDGER: {
      idFromName: (name) => name,
      get: () => ({ fetch: async () => { ledgerCalls++; return new Response('{}', { status: 200 }); } }),
    },
  };
  globalThis.fetch = async (url, options) => {
    const target = url instanceof URL ? url : new URL(url);
    if (target.hostname === 'vix-tests.cloudflareaccess.com') {
      jwksCalls++;
      return new Response(JSON.stringify({ keys: [access.publicJwk] }), { headers: { 'content-type': 'application/json' } });
    }
    upstreamCalls++;
    assert.equal(target.hostname, 'api.collinsdictionary.com');
    assert.equal(target.pathname, '/api/v1/dictionaries/american-learner/search/first/');
    assert.equal(target.searchParams.get('q'), 'abandon');
    assert.equal(options.headers.accessKey, 'server-secret');
    return new Response(JSON.stringify({ entryId: 'one', entryContent: '<p>entry</p>' }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const unauthenticated = await worker.fetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(unauthenticated.status, 401);
  assert.equal(ledgerCalls, 0);
  assert.equal(upstreamCalls, 0);

  const spoofed = await worker.fetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'cf-access-jwt-assertion': 'fixture', 'cf-access-authenticated-user-email': 'spoof@example.invalid' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(spoofed.status, 401);
  assert.equal(jwksCalls, 0);

  const cookieAuthenticated = await worker.fetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { cookie: `unrelated=1; CF_Authorization=${await access.token()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(cookieAuthenticated.status, 200);
  assert.equal(ledgerCalls, 1);
  assert.equal(upstreamCalls, 1);
  assert.equal(jwksCalls, 1);

  const authenticated = await worker.fetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'cf-access-jwt-assertion': await access.token(), 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  }), env);
  assert.equal(authenticated.status, 200);
  assert.equal(ledgerCalls, 2);
  assert.equal(upstreamCalls, 2);
  assert.equal(jwksCalls, 1);
  assert.equal(authenticated.headers.get('cache-control'), 'no-store, private, max-age=0');
  assert.ok(!(await authenticated.text()).includes('server-secret'));

  const invalid = await worker.fetch(new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'cf-access-jwt-assertion': await access.token(), 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'abandon', dictionaryCode: '../other' }),
  }), env);
  assert.equal(invalid.status, 400);
  assert.equal(ledgerCalls, 2);
  assert.equal(upstreamCalls, 2);
});

test('platform Access context is accepted only for the configured audience', async () => {
  const access = await accessFixture();
  let upstreamCalls = 0;
  globalThis.fetch = async (url) => {
    if (new URL(url).hostname === 'vix-tests.cloudflareaccess.com') {
      return new Response(JSON.stringify({ keys: [access.publicJwk] }), { headers: { 'content-type': 'application/json' } });
    }
    upstreamCalls++;
    return new Response(JSON.stringify({ entryId: 'one', entryContent: '<p>entry</p>' }), { headers: { 'content-type': 'application/json' } });
  };
  const env = {
    ALLOW_UNPROTECTED_LOCAL: 'false', COLLINS_ACCESS_KEY: 'server-secret', COLLINS_MONTHLY_LIMIT: '10',
    TEAM_DOMAIN: 'https://vix-tests.cloudflareaccess.com', POLICY_AUD: 'vix-audience',
    USAGE_LEDGER: { idFromName: (name) => name, get: () => ({ fetch: async () => new Response('{}') }) },
  };
  const request = () => new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'thread', dictionaryCode: 'american' }),
  });
  assert.equal((await worker.fetch(request(), env, { access: { aud: 'wrong-audience' } })).status, 401);
  assert.equal((await worker.fetch(request(), env, { access: { aud: 'vix-audience' } })).status, 200);
  assert.equal(upstreamCalls, 1);
});

test('Access JWT validation fails closed for placeholders and wrong application audience', async () => {
  const access = await accessFixture();
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [access.publicJwk] }), {
    headers: { 'content-type': 'application/json' },
  });
  const request = (token) => new Request('https://vix.test/api/collins/lookup', {
    method: 'POST', headers: token ? { 'cf-access-jwt-assertion': token } : {},
    body: JSON.stringify({ query: 'abandon', dictionaryCode: 'american-learner' }),
  });
  const placeholder = await worker.fetch(request('anything'), {
    ALLOW_UNPROTECTED_LOCAL: 'false', TEAM_DOMAIN: 'https://YOUR_TEAM.cloudflareaccess.com',
    POLICY_AUD: 'YOUR_ACCESS_APPLICATION_AUD_TAG',
  });
  assert.equal(placeholder.status, 503);

  const wrongAudience = await worker.fetch(request(await access.token({ aud: ['other-app'] })), {
    ALLOW_UNPROTECTED_LOCAL: 'false', TEAM_DOMAIN: 'https://vix-tests.cloudflareaccess.com', POLICY_AUD: 'vix-audience',
  });
  assert.equal(wrongAudience.status, 401);
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

test('static asset responses receive the alpha4 security envelope', async () => {
  const response = await worker.fetch(new Request('https://vix.test/index.html'), {
    ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }) },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/api\.groq\.com/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});
