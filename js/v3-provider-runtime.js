// Provider transport owns cancellation through body decoding, never VIX data.
export class ProviderError extends Error {
  constructor(code, message, { status = 0, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function cancelledError() {
  return new ProviderError('cancelled', '查询已取消');
}

export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}

export function objectValue(value, field = 'result') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProviderError('invalid-response', `返回内容格式不正确（${field}）`);
  }
  return value;
}

export function textValue(value, field, { empty = false, max = 2000 } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) {
    throw new ProviderError('invalid-response', `返回内容格式不正确（${field}）`);
  }
  return value.trim();
}

export function arrayValue(value, field, max = 32) {
  if (!Array.isArray(value) || value.length > max) {
    throw new ProviderError('invalid-response', `返回内容格式不正确（${field}）`);
  }
  return value;
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(cancelledError());
  return new Promise((resolve, reject) => {
    const onAbort = () => { clearTimeout(timer); reject(cancelledError()); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function httpError(provider, response, serverCode = '') {
  const status = response.status;
  const html = /\btext\/html\b/i.test(response.headers.get('Content-Type') || '');
  const challenge = response.headers.get('cf-mitigated') === 'challenge';
  const accessSession = ['access_required', 'access_invalid'].includes(serverCode);
  const upstreamAuthorization = serverCode === 'upstream_authorization';
  const upstreamChallenge = serverCode === 'upstream_challenge';
  const upstreamNetwork = serverCode === 'upstream_network';
  const upstreamFormat = serverCode === 'upstream_format';
  const upstreamRedirect = serverCode === 'upstream_redirect';
  const upstreamRateLimit = serverCode === 'upstream_rate_limit';
  const code = accessSession ? 'access-session' : upstreamAuthorization ? 'upstream-authorization'
    : upstreamChallenge ? 'upstream-challenge' : upstreamNetwork ? 'upstream-network'
      : upstreamFormat ? 'upstream-format' : upstreamRedirect ? 'upstream-redirect'
        : upstreamRateLimit ? 'rate-limit' : ['access_not_configured', 'not_configured'].includes(serverCode) ? 'configuration'
    : challenge ? 'access-challenge' : status === 403 && html ? 'access-blocked'
    : status === 401 || status === 403 ? 'authorization' : status === 404 ? 'not-found'
    : status === 429 ? 'rate-limit' : status >= 500 ? 'unavailable' : 'request';
  const descriptions = {
    'upstream-challenge': 'Collins 官方防护拦截了 VIX 服务器请求；这不是本机登录或刷新问题',
    'upstream-network': 'VIX 已进入私域服务，但服务器无法连接 Collins 官方接口',
    'upstream-format': 'Collins 官方返回了网页而不是 API JSON',
    'upstream-redirect': 'Collins 官方接口发生了非预期重定向',
    authorization: status === 403 ? '访问被拒绝，请核对账号授权与服务访问策略；不能仅据此判断密钥无效'
      : '密钥无效或未获授权，请检查设置与账号授权',
    'access-session': 'VIX 私域登录会话未传入 API，请刷新页面或重新登录 Cloudflare Access',
    'upstream-authorization': '服务端 Collins Secret 无效或未获当前词典授权',
    configuration: 'VIX 私域服务尚未完成 Access 校验配置',
    'access-challenge': '接口返回了服务验证页，尚未进入 API；请向服务商确认 API 访问条件',
    'access-blocked': '访问被拒绝并返回网页，尚未取得 API JSON；请核对服务访问条件',
    'not-found': '未找到匹配词条或所选资源已不可用',
    'rate-limit': '请求额度或速率受限，请稍后再试',
    unavailable: '服务暂时不可用，请稍后再试',
    request: '请求未被接受，请检查模型或词典设置',
  };
  return new ProviderError(code, `${provider}：${descriptions[code]}（HTTP ${status}）`, {
    status, retryAfterMs: parseRetryAfter(response.headers.get('Retry-After')),
  });
}

async function readServerErrorCode(response) {
  if (!/\bapplication\/json\b/i.test(response.headers.get('Content-Type') || '')) return '';
  const declaredLength = Number(response.headers.get('Content-Length') || 0);
  if (declaredLength > 8192) return '';
  try {
    const payload = await response.json();
    return typeof payload?.error?.code === 'string' ? payload.error.code.slice(0, 80) : '';
  } catch {
    return '';
  }
}

/** No response bodies, keys or request URLs are logged or retained. */
export async function fetchProviderJson(url, options = {}, {
  provider = 'Provider', signal = null, timeoutMs = 45000, retries = 0,
  retryBaseMs = 700, maxRetryDelayMs = 30000, onState = (_state) => {}, credentials = 'omit',
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw cancelledError();
    const controller = new AbortController();
    let timedOut = false;
    let onAbort;
    let timer;
    const interrupted = new Promise((_, reject) => {
      onAbort = () => { controller.abort(); reject(cancelledError()); };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ProviderError('timeout', `${provider}：请求超时，请重试`));
      }, timeoutMs);
    });
    let failure;
    try {
      onState('requesting');
      const payload = await Promise.race([interrupted, (async () => {
        const response = await fetch(url, {
          ...options, signal: controller.signal, cache: 'no-store', credentials,
          referrerPolicy: 'no-referrer', redirect: 'error',
        });
        if (signal?.aborted) throw cancelledError();
        if (!response.ok) {
          const error = httpError(provider, response, await readServerErrorCode(response));
          try { await response.body?.cancel(); } catch { /* Preserve the typed HTTP failure. */ }
          throw error;
        }
        if (/\btext\/html\b/i.test(response.headers.get('Content-Type') || '')) {
          try { await response.body?.cancel(); } catch { /* Do not expose the returned page. */ }
          throw new ProviderError('invalid-response', `${provider}：接口返回了网页而非 JSON，请核对接入地址与服务验证要求`);
        }
        try { return await response.json(); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          throw new ProviderError('invalid-response', `${provider}：响应不是有效 JSON`);
        }
      })()]);
      if (signal?.aborted) throw cancelledError();
      return payload;
    } catch (error) {
      failure = signal?.aborted ? cancelledError() : timedOut
        ? new ProviderError('timeout', `${provider}：请求超时，请重试`)
        : error instanceof ProviderError ? error
          : new ProviderError('network', provider === 'Collins'
            ? 'Collins：无法连接 VIX 同源服务；请检查部署、网络或服务状态'
            : `${provider}：网络连接失败或浏览器跨域访问受限`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    const delay = Math.max(failure.retryAfterMs, Math.min(8000, retryBaseMs * (2 ** attempt)));
    if (attempt >= retries || !['network', 'timeout', 'rate-limit', 'unavailable'].includes(failure.code)
      || delay > maxRetryDelayMs) throw failure;
    onState('retrying');
    await wait(delay, signal);
  }
}

/** A single UI transaction. Ready is reachable only after the executor validates/decodes. */
export function createProviderSession(onState = (_state, _error = null) => {}) {
  const controller = new AbortController();
  let state = 'idle';
  let closed = false;
  const update = (next, error = null) => {
    if (closed) return;
    state = next;
    onState(next, error);
  };
  return {
    controller,
    get state() { return state; },
    async run(execute) {
      if (closed || state !== 'idle') throw cancelledError();
      try {
        update('requesting');
        const result = await execute(controller.signal, (next) => update(next));
        if (closed || controller.signal.aborted) throw cancelledError();
        update('ready');
        return result;
      } catch (error) {
        const failure = controller.signal.aborted ? cancelledError() : error;
        update(failure?.code === 'cancelled' ? 'cancelled' : failure?.code === 'not-found' ? 'empty' : 'error', failure);
        throw failure;
      }
    },
    cancel() {
      if (closed) return;
      controller.abort();
      update('cancelled');
      closed = true;
    },
    dispose() { controller.abort(); closed = true; onState = () => {}; },
  };
}
