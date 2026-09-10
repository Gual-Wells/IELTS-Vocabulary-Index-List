const MIRROR_CONNECTION_KEY = 'vix.personal-mirror.connection';
const REQUEST_TIMEOUT_MS = 20000;

export class MirrorServiceError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'MirrorServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function normalizedOrigin(value) {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new MirrorServiceError('configuration', 'Personal Mirror 地址无效'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new MirrorServiceError('configuration', 'Personal Mirror 必须使用 HTTPS');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new MirrorServiceError('configuration', 'Personal Mirror 地址不能包含凭据或参数');
  }
  return url.origin;
}

function personalMirrorApiConfig() {
  try {
    const value = JSON.parse(localStorage.getItem(MIRROR_CONNECTION_KEY) || '{}');
    const url = normalizedOrigin(value.siteOrigin || 'https://vix-personal-mirror.tydw.chatgpt.site');
    const token = typeof value.token === 'string' && value.token.startsWith('vixm_') ? value.token : '';
    if (!token) throw new MirrorServiceError('configuration', '请先连接 Personal Mirror');
    return { url, token };
  } catch (error) {
    if (error instanceof MirrorServiceError) throw error;
    throw new MirrorServiceError('configuration', 'Personal Mirror 配置无效');
  }
}

async function request(path, { method = 'GET', body = null, signal = null, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const { url, token } = personalMirrorApiConfig();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(body == null ? {} : { 'content-type': 'application/json' }),
      },
      body: body == null ? null : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const upstream = payload?.error;
      throw new MirrorServiceError(
        upstream?.code || upstream || 'request',
        upstream?.message || `Personal Mirror 请求失败（HTTP ${response.status}）`,
        response.status,
        upstream || null,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof MirrorServiceError) throw error;
    if (signal?.aborted) throw new MirrorServiceError('cancelled', '请求已取消');
    if (controller.signal.aborted) throw new MirrorServiceError('timeout', 'Personal Mirror 请求超时');
    throw new MirrorServiceError('network', '无法连接 Personal Mirror');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function saveGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new MirrorServiceError('configuration', '请填写 Groq API Key');
  return request('/api/groq/settings', { ...options, method: 'PUT', body: { apiKey: key } });
}

export function validateGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new MirrorServiceError('configuration', '请填写 Groq API Key');
  return request('/api/groq/settings/validate', { ...options, method: 'POST', body: { apiKey: key } });
}

export function deleteGroqSecret(options = {}) {
  return request('/api/groq/settings', { ...options, method: 'DELETE' });
}

export function getGroqModels(options = {}) {
  return request('/api/groq/models', options);
}

export function requestGroqCompletion(body, options = {}) {
  return request('/api/groq/chat', { ...options, method: 'POST', body });
}

export function requestSpeech(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) throw new MirrorServiceError('configuration', '发音文本为空');
  const { model, voice, ...requestOptions } = options;
  return request('/api/groq/speech', {
    ...requestOptions,
    method: 'POST',
    body: { text: value, ...(model ? { model } : {}), ...(voice ? { voice } : {}) },
  });
}
