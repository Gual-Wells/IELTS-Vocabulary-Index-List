// @ts-check

import { APP_VERSION } from '../../js/v5-version.js';

const COLLINS_BASE = 'https://api.collinsdictionary.com/api/v1';
const COLLINS_CODES = new Set(['american-learner', 'american']);
const SESSION_PROTOCOL = 'vix-session-capsule/2';
const MAX_SESSION_BYTES = 12 * 1024 * 1024;
const MAX_RESULT_BYTES = 2 * 1024 * 1024;
const CHUNK_CHARS = 60_000;
const CAPABILITY_PROTOCOL = 'vix-runtime-capabilities/1';
const HEALTH_PROTOCOL = 'vix-runtime-health/1';

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
      ...extra,
    },
  });
}

function error(code, message, status = 400) {
  return json({ error: { code, message } }, status);
}

function bearer(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return match?.[1] || '';
}

async function bodyJson(request, limit) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > limit) throw new Response(null, { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) throw new Response(null, { status: 413 });
  try { return JSON.parse(text); }
  catch { throw new Response(null, { status: 400 }); }
}

function randomToken(prefix) {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validSessionRequest(value) {
  return value && typeof value === 'object' && value.protocol === SESSION_PROTOCOL && value.kind === 'vix-match-request'
    && typeof value.sessionId === 'string' && /^vixs_[a-f0-9]{36}$/.test(value.sessionId)
    && typeof value.sourceCorpusHash === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.sourceCorpusHash)
    && typeof value.matchCorpusHash === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.matchCorpusHash)
    && Number.isSafeInteger(value.requestSequence) && value.requestSequence > 0
    && Array.isArray(value.corpus) && value.corpus.every((row, index) => row?.slot === index + 1 && !Object.hasOwn(row, 'id'));
}

function validSessionResult(value, session) {
  return value && typeof value === 'object' && value.protocol === SESSION_PROTOCOL && value.kind === 'vix-match-result'
    && value.sessionId === session.sessionId
    && value.sourceCorpusHash === session.sourceCorpusHash
    && value.matchCorpusHash === session.matchCorpusHash
    && value.requestSequence === session.requestSequence
    && Array.isArray(value.matchedSlots)
    && value.matchedSlots.every((slot) => Number.isSafeInteger(slot) && slot >= 1 && slot <= session.corpusCount)
    && new Set(value.matchedSlots).size === value.matchedSlots.length;
}

async function collinsLookup(request, env) {
  if (!env.COLLINS_ACCESS_KEY) return error('not_configured', '服务端尚未配置 Collins Secret', 503);
  let input;
  try { input = await bodyJson(request, 8 * 1024); }
  catch (response) { return response instanceof Response ? response : error('invalid_json', '请求 JSON 无效'); }
  const query = typeof input?.query === 'string' ? input.query.trim() : '';
  const dictionaryCode = typeof input?.dictionaryCode === 'string' ? input.dictionaryCode.trim() : '';
  if (!query || query.length > 240) return error('invalid_query', '查询内容无效');
  if (!COLLINS_CODES.has(dictionaryCode)) return error('invalid_dictionary', '词典不在 VIX 固定 Registry 中');

  const ledgerId = env.USAGE_LEDGER.idFromName('collins-global');
  const ledger = env.USAGE_LEDGER.get(ledgerId);
  const allowance = await ledger.fetch('https://usage.internal/consume', {
    method: 'POST', headers: { 'x-limit': String(env.COLLINS_MONTHLY_LIMIT || 1000) },
  });
  if (!allowance.ok) return error('budget_exhausted', 'Collins 本月硬额度已用完', 429);

  const upstream = new URL(`${COLLINS_BASE}/dictionaries/${encodeURIComponent(dictionaryCode)}/search/first/`);
  upstream.searchParams.set('q', query);
  upstream.searchParams.set('format', 'html');
  let response;
  try {
    response = await fetch(upstream, {
      method: 'GET',
      headers: { 'accept': 'application/json', 'accessKey': env.COLLINS_ACCESS_KEY },
      redirect: 'error',
    });
  } catch {
    return error('upstream_network', 'Collins 上游连接失败', 502);
  }
  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* no body retention */ }
    const code = [401, 403].includes(response.status) ? 'upstream_authorization' : 'upstream_http';
    return error(code, `Collins 上游返回 HTTP ${response.status}`, response.status === 404 ? 404 : 502);
  }
  if (!/application\/json/i.test(response.headers.get('content-type') || '')) {
    try { await response.body?.cancel(); } catch { /* no body retention */ }
    return error('upstream_format', 'Collins 上游未返回 JSON', 502);
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, private, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function createSession(request, env) {
  let capsule;
  try { capsule = await bodyJson(request, MAX_SESSION_BYTES); }
  catch (response) { return response instanceof Response ? response : error('invalid_json', 'Session JSON 无效'); }
  if (!validSessionRequest(capsule)) return error('invalid_session', 'Session Capsule 合同无效');
  const expiry = Date.parse(capsule.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 2 * 60 * 60 * 1000) return error('invalid_expiry', 'Session expiry 无效');
  const ownerToken = randomToken('owner');
  const readToken = randomToken('read');
  const writeToken = randomToken('write');
  const id = env.SESSION_OBJECT.idFromName(capsule.sessionId);
  const object = env.SESSION_OBJECT.get(id);
  const stored = await object.fetch('https://session.internal/create', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-owner-hash': await tokenHash(ownerToken),
      'x-read-hash': await tokenHash(readToken),
      'x-write-hash': await tokenHash(writeToken),
    },
    body: JSON.stringify(capsule),
  });
  if (!stored.ok) return error('session_conflict', 'Session 已存在或无法保存', stored.status);
  return json({
    sessionId: capsule.sessionId,
    ownerToken, readToken, writeToken,
    exchangePath: `/api/vix/sessions/${encodeURIComponent(capsule.sessionId)}`,
    expiresAt: capsule.expiresAt,
  }, 201);
}

async function sessionExchange(request, env, sessionId, operation) {
  if (!/^vixs_[a-f0-9]{36}$/.test(sessionId)) return error('invalid_session', 'Session ID 无效');
  const id = env.SESSION_OBJECT.idFromName(sessionId);
  const object = env.SESSION_OBJECT.get(id);
  const target = new URL(`https://session.internal/${operation}`);
  const headers = new Headers({ 'x-token-hash': await tokenHash(bearer(request)) });
  let body;
  if (request.method === 'POST') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_RESULT_BYTES) return error('too_large', 'Result Capsule 过大', 413);
    body = request.body;
    headers.set('content-type', request.headers.get('content-type') || 'application/json');
  }
  const response = await object.fetch(target, { method: request.method, headers, body });
  const outgoing = new Headers(response.headers);
  outgoing.set('cache-control', 'no-store, max-age=0');
  outgoing.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, headers: outgoing });
}

function staticSecurity(response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.groq.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Worker-level Cloudflare Access is the sole authentication boundary.
    // Workers Static Assets uses an internal router that enforces Access but
    // does not forward ctx.access to this Worker, so duplicating that check
    // here would reject every correctly authenticated API request.
    if (request.method === 'GET' && url.pathname === '/api/capabilities') {
      return json({
        protocol: CAPABILITY_PROTOCOL,
        version: APP_VERSION,
        deployment: 'private-worker',
        capabilities: {
          collins: Boolean(env.COLLINS_ACCESS_KEY && env.USAGE_LEDGER),
          sessionBridge: Boolean(env.SESSION_OBJECT),
        },
      });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const checks = {
        assets: Boolean(env.ASSETS),
        collinsSecret: Boolean(env.COLLINS_ACCESS_KEY),
        usageLedger: Boolean(env.USAGE_LEDGER),
        sessionStore: Boolean(env.SESSION_OBJECT),
      };
      return json({
        protocol: HEALTH_PROTOCOL,
        version: APP_VERSION,
        status: Object.values(checks).every(Boolean) ? 'ok' : 'degraded',
        checks,
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/collins/lookup') return collinsLookup(request, env);
    if (request.method === 'POST' && url.pathname === '/api/vix/sessions') return createSession(request, env);
    const match = /^\/api\/vix\/sessions\/([^/]+)\/(request|result)$/.exec(url.pathname);
    if (match) {
      if (match[2] === 'request' && request.method === 'GET') return sessionExchange(request, env, decodeURIComponent(match[1]), 'request');
      if (match[2] === 'result' && ['GET', 'POST'].includes(request.method)) return sessionExchange(request, env, decodeURIComponent(match[1]), 'result');
      return error('method_not_allowed', '方法不允许', 405);
    }
    if (url.pathname.startsWith('/api/')) return error('not_found', 'API 路径不存在', 404);
    return staticSecurity(await env.ASSETS.fetch(request));
  },
};

export class UsageLedger {
  constructor(ctx) { this.ctx = ctx; }

  async fetch(request) {
    if (new URL(request.url).pathname !== '/consume' || request.method !== 'POST') return new Response(null, { status: 404 });
    const limit = Math.max(1, Math.min(1_000_000, Number(request.headers.get('x-limit') || 1000)));
    const month = new Date().toISOString().slice(0, 7);
    const current = await this.ctx.storage.get('usage');
    const count = current?.month === month ? Number(current.count || 0) : 0;
    if (count >= limit) return json({ allowed: false, month, count, limit }, 429);
    await this.ctx.storage.put('usage', { month, count: count + 1 });
    return json({ allowed: true, month, count: count + 1, limit });
  }
}

export class SessionObject {
  constructor(ctx) { this.ctx = ctx; }

  async writeLarge(prefix, value) {
    const text = JSON.stringify(value);
    const count = Math.ceil(text.length / CHUNK_CHARS);
    const records = { [`${prefix}:count`]: count };
    for (let index = 0; index < count; index += 1) records[`${prefix}:${index}`] = text.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS);
    await this.ctx.storage.put(records);
  }

  async readLarge(prefix) {
    const count = Number(await this.ctx.storage.get(`${prefix}:count`) || 0);
    if (!count) return null;
    const keys = Array.from({ length: count }, (_, index) => `${prefix}:${index}`);
    const chunks = await this.ctx.storage.get(keys);
    return JSON.parse(keys.map((key) => chunks.get(key) || '').join(''));
  }

  async authorized(request, key) {
    const expected = await this.ctx.storage.get(key);
    const supplied = request.headers.get('x-token-hash') || '';
    return Boolean(expected && supplied && expected === supplied);
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/create' && request.method === 'POST') {
      if (await this.ctx.storage.get('manifest')) return new Response(null, { status: 409 });
      const capsule = await request.json();
      if (!validSessionRequest(capsule)) return new Response(null, { status: 400 });
      const manifest = {
        sessionId: capsule.sessionId,
        sourceCorpusHash: capsule.sourceCorpusHash,
        matchCorpusHash: capsule.matchCorpusHash,
        requestSequence: capsule.requestSequence,
        corpusCount: capsule.corpus.length,
        expiresAt: capsule.expiresAt,
      };
      await this.ctx.storage.put({
        manifest,
        ownerHash: request.headers.get('x-owner-hash'),
        readHash: request.headers.get('x-read-hash'),
        writeHash: request.headers.get('x-write-hash'),
      });
      await this.writeLarge('request', capsule);
      await this.ctx.storage.setAlarm(Date.parse(capsule.expiresAt));
      return new Response(null, { status: 201 });
    }
    const manifest = await this.ctx.storage.get('manifest');
    if (!manifest || Date.now() > Date.parse(manifest.expiresAt)) return error('expired', 'Session 不存在或已过期', 404);
    if (path === '/request' && request.method === 'GET') {
      if (!(await this.authorized(request, 'readHash'))) return error('unauthorized', 'read capability 无效', 401);
      return json(await this.readLarge('request'));
    }
    if (path === '/result' && request.method === 'POST') {
      if (!(await this.authorized(request, 'writeHash'))) return error('unauthorized', 'write capability 无效', 401);
      if (await this.ctx.storage.get('result:count')) return error('already_written', 'write capability 已使用', 409);
      let result;
      try { result = await bodyJson(request, MAX_RESULT_BYTES); }
      catch (response) { return response instanceof Response ? response : error('invalid_json', 'Result JSON 无效'); }
      if (!validSessionResult(result, manifest)) return error('invalid_result', 'Result Capsule 与 Session 不一致');
      await this.writeLarge('result', result);
      await this.ctx.storage.delete('writeHash');
      return new Response(null, { status: 204 });
    }
    if (path === '/result' && request.method === 'GET') {
      if (!(await this.authorized(request, 'ownerHash'))) return error('unauthorized', 'owner capability 无效', 401);
      const result = await this.readLarge('result');
      return result ? json(result) : new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
    }
    return new Response(null, { status: 404 });
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}
