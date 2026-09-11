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

function localMirrorEnabled() {
  try {
    const value = JSON.parse(localStorage.getItem(MIRROR_CONNECTION_KEY) || '{}');
    return value.disabled !== true;
  } catch {
    return true;
  }
}

async function request(path, { method = 'GET', body = null, signal = null, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  if (!localMirrorEnabled()) throw new MirrorServiceError('configuration', '此设备已断开 Personal Mirror');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method,
      headers: {
        accept: 'application/json',
        ...(body == null ? {} : { 'content-type': 'application/json' }),
      },
      body: body == null ? null : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const upstream = payload?.error;
      const message = response.status === 401
        ? 'Cloudflare Access 会话已失效，请重新打开 VIX 完成验证'
        : upstream?.message || `Personal Mirror 请求失败（HTTP ${response.status}）`;
      throw new MirrorServiceError(
        upstream?.code || upstream || (response.status === 401 ? 'access-required' : 'request'),
        message,
        response.status,
        upstream || null,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof MirrorServiceError) throw error;
    if (signal?.aborted) throw new MirrorServiceError('cancelled', '请求已取消');
    if (controller.signal.aborted) throw new MirrorServiceError('timeout', 'Personal Mirror 请求超时');
    throw new MirrorServiceError('network', '无法连接 Cloudflare Mirror Gateway');
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
  if (value.length > 200) throw new MirrorServiceError('speech-input-too-long', 'Groq Orpheus 单次发音最多 200 个字符');
  const { model, voice, ...requestOptions } = options;
  return request('/api/groq/speech', {
    ...requestOptions,
    method: 'POST',
    body: { text: value, ...(model ? { model } : {}), ...(voice ? { voice } : {}) },
  });
}
