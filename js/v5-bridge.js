// @ts-check

const URL_KEY = 'gualVocabulary.bridgeUrl';
const DEVICE_TOKEN_KEY = 'gualVocabulary.bridgeDeviceToken';
const REQUEST_TIMEOUT_MS = 45000;

export class BridgeError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.status = status;
  }
}

function normalizedUrl(value) {
  const input = String(value || '').trim().replace(/\/+$/, '');
  if (!input) return '';
  let url;
  try { url = new URL(input); }
  catch { throw new BridgeError('configuration', 'Bridge 地址无效'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new BridgeError('configuration', 'Bridge 必须使用 HTTPS');
  }
  if (url.username || url.password || url.search || url.hash) throw new BridgeError('configuration', 'Bridge 地址不能包含凭据或参数');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function getBridgeConfig() {
  return {
    url: localStorage.getItem(URL_KEY) || '',
    deviceToken: localStorage.getItem(DEVICE_TOKEN_KEY) || '',
  };
}

export function bridgeConfigured() {
  const config = getBridgeConfig();
  return Boolean(config.url && config.deviceToken);
}

export function setBridgeConfig({ url, deviceToken }) {
  const nextUrl = normalizedUrl(url);
  const nextToken = String(deviceToken || '').trim();
  if (!nextUrl || !nextToken) throw new BridgeError('configuration', '请填写 Bridge 地址和 Device Token');
  localStorage.setItem(URL_KEY, nextUrl);
  localStorage.setItem(DEVICE_TOKEN_KEY, nextToken);
  return getBridgeConfig();
}

export function clearBridgeConfig() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(DEVICE_TOKEN_KEY);
}

async function bridgeRequest(path, { method = 'GET', body = null, signal = null, timeoutMs = REQUEST_TIMEOUT_MS, config = null } = {}) {
  const selected = config || getBridgeConfig();
  const url = normalizedUrl(selected.url);
  const deviceToken = String(selected.deviceToken || '').trim();
  if (!url || !deviceToken) throw new BridgeError('configuration', 'Bridge 尚未配置');
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${deviceToken}`,
        ...(body == null ? {} : { 'content-type': 'application/json' }),
      },
      body: body == null ? null : JSON.stringify(body),
      cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BridgeError(payload?.error?.code || 'request', payload?.error?.message || `Bridge 请求失败（HTTP ${response.status}）`, response.status);
    }
    return payload;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    if (signal?.aborted) throw new BridgeError('cancelled', '操作已取消');
    if (controller.signal.aborted) throw new BridgeError('timeout', 'Bridge 请求超时');
    throw new BridgeError('network', '无法连接 Bridge');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function testBridge(options = {}) {
  return bridgeRequest('/v1/status', options);
}

export async function testBridgeConfig(config, options = {}) {
  const { probeGroq = true, ...requestOptions } = options;
  const status = await bridgeRequest('/v1/status', { ...requestOptions, config });
  if (probeGroq && status?.groqState === 'master_key_mismatch') {
    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 与已保存的 Groq Key 不匹配，请重新保存 Groq Key', 409);
  }
  if (probeGroq && status?.groqState === 'unreadable') {
    throw new BridgeError('groq_secret_unreadable', 'Groq Key 无法解密，请在 Bridge 中重新保存', 409);
  }
  if (!probeGroq || !status?.groq) return status;
  const models = await bridgeRequest('/v1/groq/models', { ...requestOptions, config });
  const groqModels = Array.isArray(models?.data) ? models.data : [];
  return { ...status, groqReachable: true, groqModelCount: groqModels.length, groqModels };
}

export function uploadMirrorContext(context, options = {}) {
  return bridgeRequest('/v1/context', { ...options, method: 'PUT', body: context });
}

export function getMirrorInbox(options = {}) {
  return bridgeRequest('/v1/inbox', options);
}

export function acknowledgeMirrorRun(runId, options = {}) {
  return bridgeRequest(`/v1/runs/${encodeURIComponent(runId)}/ack`, { ...options, method: 'POST', body: {} });
}

export function saveGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Groq API Key');
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'PUT', body: { apiKey: key } });
}

export function deleteGroqSecret(options = {}) {
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'DELETE' });
}

export function getGroqModels(options = {}) {
  return bridgeRequest('/v1/groq/models', options);
}

export function requestGroqCompletion(body, options = {}) {
  return bridgeRequest('/v1/groq/chat', { ...options, method: 'POST', body });
}
