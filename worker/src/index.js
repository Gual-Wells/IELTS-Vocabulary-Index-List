// @ts-check

import { authorizeAccess } from './access-jwt.js';

const MIRROR_SERVICE_PROTOCOL = 'vix-mirror-service/1';
const GATEWAY_PROTOCOL = 'vix-mirror-gateway/1';
const CONFIG_KEY = 'gateway-config';
const MAX_BOOTSTRAP_BYTES = 16 * 1024;
const PROXY_PREFIXES = ['/api/mirror/', '/api/groq/'];

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

function error(code, message, status = 400, details = null) {
  return json({ error: { code, message, ...(details == null ? {} : { details }) } }, status);
}

async function requireAccess(request, env, executionContext) {
  const authorization = await authorizeAccess(request, env, executionContext);
  if (authorization.ok) return null;
  if (authorization.code === 'access_not_configured') {
    return error('access_not_configured', 'Cloudflare Access 尚未配置', authorization.status);
  }
  return error(authorization.code, '需要有效的 Cloudflare Access 会话', authorization.status);
}

function safeOrigin(value, expectedOrigin = '') {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
    if (expectedOrigin && url.origin !== expectedOrigin) return '';
    return url.origin;
  } catch {
    return '';
  }
}

async function readJsonBody(request, maxBytes = MAX_BOOTSTRAP_BYTES) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Response(null, { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new Response(null, { status: 413 });
  try { return JSON.parse(text); }
  catch { throw new Response(null, { status: 400 }); }
}

function gatewayObject(env) {
  const id = env.MIRROR_GATEWAY.idFromName('personal-mirror');
  return env.MIRROR_GATEWAY.get(id);
}

function proxyHeaders(request, path) {
  const headers = new Headers();
  for (const name of ['accept', 'content-type', 'if-match', 'if-none-match', 'x-vix-sync-reason']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-vix-upstream-path', path);
  return headers;
}

function copyUpstreamHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of source.entries()) {
    const lower = name.toLowerCase();
    if (lower === 'set-cookie' || lower === 'content-length' || lower === 'content-encoding' || lower === 'transfer-encoding') continue;
    if (lower === 'content-type' || lower === 'etag' || lower === 'last-modified' || lower === 'retry-after'
      || lower.startsWith('x-mirror-') || lower.startsWith('x-ratelimit-')) {
      headers.set(name, value);
    }
  }
  headers.set('cache-control', 'no-store, max-age=0');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

function staticSecurity(response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const gatewayRoute = url.pathname.startsWith('/api/mirror-gateway/');
    const proxiedRoute = PROXY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

    if (gatewayRoute || proxiedRoute) {
      const accessFailure = await requireAccess(request, env, executionContext);
      if (accessFailure) return accessFailure;
      const object = gatewayObject(env);

      if (url.pathname === '/api/mirror-gateway/status' && request.method === 'GET') {
        const internal = new URL('https://mirror.internal/status');
        if (url.searchParams.get('probe') === '1') internal.searchParams.set('probe', '1');
        return object.fetch(internal, { method: 'GET' });
      }

      if (url.pathname === '/api/mirror-gateway/bootstrap' && request.method === 'POST') {
        return object.fetch('https://mirror.internal/bootstrap', {
          method: 'POST',
          headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
          body: request.body,
        });
      }

      if (url.pathname === '/api/mirror-gateway/reset' && request.method === 'DELETE') {
        return object.fetch('https://mirror.internal/reset', { method: 'DELETE' });
      }

      if (gatewayRoute) return error('not_found', 'Gateway 路径不存在', 404);

      if (url.pathname === '/api/mirror/pair') {
        return error('managed_by_gateway', 'Cloudflare Gateway 模式不在浏览器中撤销上游 capability', 409);
      }

      return object.fetch('https://mirror.internal/proxy', {
        method: request.method,
        headers: proxyHeaders(request, `${url.pathname}${url.search}`),
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      });
    }

    if (url.pathname.startsWith('/api/')) return error('not_found', 'API 路径不存在', 404);
    return staticSecurity(await env.ASSETS.fetch(request));
  },
};

export class MirrorGatewayState {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async configuration() {
    const value = await this.ctx.storage.get(CONFIG_KEY);
    if (!value || typeof value !== 'object') return null;
    if (!safeOrigin(value.upstreamOrigin, safeOrigin(this.env.MIRROR_UPSTREAM_ORIGIN))) return null;
    if (typeof value.token !== 'string' || !value.token.startsWith('vixm_')) return null;
    return value;
  }

  async probe(config) {
    try {
      const response = await fetch(`${config.upstreamOrigin}/api/mirror/capabilities`, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${config.token}` },
        cache: 'no-store',
        redirect: 'error',
      });
      const payload = await response.json().catch(() => null);
      return {
        healthy: response.ok && payload?.protocol === MIRROR_SERVICE_PROTOCOL,
        upstreamStatus: response.status,
        capabilities: response.ok && Array.isArray(payload?.capabilities) ? payload.capabilities : [],
      };
    } catch {
      return { healthy: false, upstreamStatus: 0, capabilities: [] };
    }
  }

  async status(request) {
    const config = await this.configuration();
    if (!config) {
      return json({ protocol: GATEWAY_PROTOCOL, configured: false, healthy: false, upstreamOrigin: safeOrigin(this.env.MIRROR_UPSTREAM_ORIGIN) });
    }
    const probe = new URL(request.url).searchParams.get('probe') === '1'
      ? await this.probe(config)
      : { healthy: true, upstreamStatus: 200, capabilities: [] };
    return json({
      protocol: GATEWAY_PROTOCOL,
      configured: true,
      healthy: probe.healthy,
      upstreamOrigin: config.upstreamOrigin,
      upstreamStatus: probe.upstreamStatus,
      capabilities: probe.capabilities,
      configuredAt: config.configuredAt || '',
      lastVerifiedAt: probe.healthy ? new Date().toISOString() : (config.lastVerifiedAt || ''),
    });
  }

  async bootstrap(request) {
    let input;
    try { input = await readJsonBody(request); }
    catch (response) { return response instanceof Response ? response : error('invalid_json', 'Bootstrap JSON 无效'); }

    const expected = safeOrigin(this.env.MIRROR_UPSTREAM_ORIGIN);
    const upstreamOrigin = safeOrigin(input?.siteOrigin || input?.upstreamOrigin, expected);
    const token = typeof input?.token === 'string' ? input.token.trim() : '';
    if (!expected) return error('upstream_not_configured', 'Worker 未配置 MIRROR_UPSTREAM_ORIGIN', 503);
    if (!upstreamOrigin || !token.startsWith('vixm_')) return error('invalid_bootstrap', 'Personal Mirror bootstrap 信息无效');

    const probe = await this.probe({ upstreamOrigin, token });
    if (!probe.healthy) {
      return error('upstream_authorization_failed', '旧 Personal Mirror capability 无效或上游不可达', probe.upstreamStatus || 502);
    }

    const now = new Date().toISOString();
    await this.ctx.storage.put(CONFIG_KEY, {
      upstreamOrigin,
      token,
      configuredAt: now,
      lastVerifiedAt: now,
    });
    return json({
      protocol: GATEWAY_PROTOCOL,
      configured: true,
      healthy: true,
      upstreamOrigin,
      capabilities: probe.capabilities,
      configuredAt: now,
      lastVerifiedAt: now,
    }, 201);
  }

  async reset() {
    await this.ctx.storage.delete(CONFIG_KEY);
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  }

  async proxy(request) {
    const config = await this.configuration();
    if (!config) return error('gateway_not_configured', 'Cloudflare Mirror Gateway 尚未初始化', 503);
    const path = request.headers.get('x-vix-upstream-path') || '';
    if (!PROXY_PREFIXES.some((prefix) => path.startsWith(prefix)) || /[\r\n]/.test(path)) {
      return error('invalid_upstream_path', '上游路径无效');
    }

    const upstreamHeaders = new Headers();
    for (const name of ['accept', 'content-type', 'if-match', 'if-none-match', 'x-vix-sync-reason']) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders.set(name, value);
    }
    upstreamHeaders.set('authorization', `Bearer ${config.token}`);

    let response;
    try {
      response = await fetch(`${config.upstreamOrigin}${path}`, {
        method: request.method,
        headers: upstreamHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
        cache: 'no-store',
        redirect: 'error',
      });
    } catch {
      return error('upstream_network', 'Personal Mirror 上游连接失败', 502);
    }

    const headers = copyUpstreamHeaders(response.headers);
    return new Response(request.method === 'HEAD' ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/status' && request.method === 'GET') return this.status(request);
    if (url.pathname === '/bootstrap' && request.method === 'POST') return this.bootstrap(request);
    if (url.pathname === '/reset' && request.method === 'DELETE') return this.reset();
    if (url.pathname === '/proxy') return this.proxy(request);
    return error('not_found', 'Mirror Gateway internal route not found', 404);
  }
}
