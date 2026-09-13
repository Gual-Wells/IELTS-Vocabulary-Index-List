// @ts-check

const URL_KEY = 'gualVocabulary.bridgeUrl';
const DEVICE_TOKEN_KEY = 'gualVocabulary.bridgeDeviceToken';
const FILE_CATALOG_KEY = 'gualVocabulary.bridgeFileCatalog.v1';
const REQUEST_TIMEOUT_MS = 20000;
const FILE_REQUEST_TIMEOUT_MS = 12000;

export class BridgeError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.status = status;
    this.details = details;
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
  if (url.username || url.password || url.search || url.hash) {
    throw new BridgeError('configuration', 'Bridge 地址不能包含凭据或参数');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

function cleanCatalog(value, expectedUrl = '') {
  if (!value || typeof value !== 'object' || value.protocol !== 'vix-bridge-file-catalog-cache/1') return null;
  if (expectedUrl && value.bridgeUrl !== expectedUrl) return null;
  return {
    protocol: value.protocol,
    bridgeUrl: String(value.bridgeUrl || ''),
    instanceId: String(value.instanceId || ''),
    catalogRevision: Number(value.catalogRevision || 0),
    savedAt: String(value.savedAt || ''),
    files: Array.isArray(value.files) ? value.files.filter((item) => item?.runId).map((item) => ({ ...item })) : [],
  };
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
  const previousUrl = localStorage.getItem(URL_KEY) || '';
  const previousToken = localStorage.getItem(DEVICE_TOKEN_KEY) || '';
  localStorage.setItem(URL_KEY, nextUrl);
  localStorage.setItem(DEVICE_TOKEN_KEY, nextToken);
  if ((previousUrl && previousUrl !== nextUrl) || (previousToken && previousToken !== nextToken)) {
    localStorage.removeItem(FILE_CATALOG_KEY);
  }
  return getBridgeConfig();
}

export function clearBridgeConfig() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(DEVICE_TOKEN_KEY);
  localStorage.removeItem(FILE_CATALOG_KEY);
}

export function getCachedMirrorFileCatalog(config = null) {
  const selected = config || getBridgeConfig();
  let url = '';
  try { url = normalizedUrl(selected.url); } catch { return null; }
  try { return cleanCatalog(JSON.parse(localStorage.getItem(FILE_CATALOG_KEY) || 'null'), url); }
  catch { return null; }
}

export function cacheMirrorFileCatalog(payload, config = null) {
  const selected = config || getBridgeConfig();
  const url = normalizedUrl(selected.url);
  const catalog = cleanCatalog({
    protocol: 'vix-bridge-file-catalog-cache/1',
    bridgeUrl: url,
    instanceId: payload?.instanceId || '',
    catalogRevision: payload?.catalogRevision || 0,
    savedAt: new Date().toISOString(),
    files: Array.isArray(payload?.files) ? payload.files : [],
  }, url);
  if (!catalog) return null;
  try { localStorage.setItem(FILE_CATALOG_KEY, JSON.stringify(catalog)); } catch {}
  return catalog;
}

async function bridgeRequest(path, {
  method = 'GET', body = null, signal = null, timeoutMs = REQUEST_TIMEOUT_MS, config = null,
} = {}) {
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
        'x-vix-device-token': deviceToken,
        'x-vix-client': 'vix-web',
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
      throw new BridgeError(
        payload?.error?.code || 'request',
        payload?.error?.message || `Bridge 请求失败（HTTP ${response.status}）`,
        response.status,
        payload?.error || null,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    if (signal?.aborted) throw new BridgeError('cancelled', '请求已取消');
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

async function testBridgeConfigOnce(config, options = {}) {
  const { probeGroq = true, ...requestOptions } = options;
  const status = await bridgeRequest('/v1/status', { ...requestOptions, config });
  if (probeGroq && status?.groqState === 'master_key_mismatch') {
    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 与已保存的 Groq Key 不匹配，请重新保存 Groq Key', 409);
  }
  if (probeGroq && status?.groqState === 'unreadable') {
    throw new BridgeError('groq_secret_unreadable', 'Groq Key 无法解密，请在 Bridge 中重新保存', 409);
  }
  if (status?.ttsState === 'master_key_mismatch') {
    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 已变更并与保存的 Google TTS Key 不匹配，请重新保存语音 Key', 409);
  }
  if (status?.ttsState === 'unreadable') {
    throw new BridgeError('tts_secret_unreadable', 'Google TTS Key 无法解密，请在 Bridge 中重新保存', 409);
  }
  if (!probeGroq || !status?.groq) return status;
  const models = await bridgeRequest('/v1/groq/models', { ...requestOptions, config });
  const groqModels = Array.isArray(models?.data) ? models.data : [];
  return { ...status, groqReachable: true, groqModelCount: groqModels.length, groqModels };
}

function iosSchemeCredentialRecoveryCandidate(value) {
  const token = String(value || '').trim();
  if (!/^[a-z]:/.test(token)) return '';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export async function testBridgeConfig(config, options = {}) {
  try {
    return await testBridgeConfigOnce(config, options);
  } catch (error) {
    const recoveredDeviceToken = iosSchemeCredentialRecoveryCandidate(config?.deviceToken);
    if (!(error instanceof BridgeError) || error.status !== 401 || !recoveredDeviceToken) throw error;
    const recoveredConfig = { ...config, deviceToken: recoveredDeviceToken };
    const result = await testBridgeConfigOnce(recoveredConfig, options);
    return { ...result, recoveredDeviceToken };
  }
}

export function uploadMirrorContext(context, options = {}) {
  return bridgeRequest('/v1/context', { ...options, method: 'PUT', body: context, timeoutMs: 60000 });
}

export function getMirrorInbox(options = {}) {
  return bridgeRequest('/v1/inbox', { timeoutMs: FILE_REQUEST_TIMEOUT_MS, ...options });
}

export async function listMirrorFiles(options = {}) {
  const payload = await bridgeRequest('/v1/files', { timeoutMs: FILE_REQUEST_TIMEOUT_MS, ...options });
  cacheMirrorFileCatalog(payload, options.config || null);
  return payload;
}

export function getMirrorFile(runId, options = {}) {
  return bridgeRequest('/v1/files/' + encodeURIComponent(runId), { timeoutMs: FILE_REQUEST_TIMEOUT_MS, ...options });
}

export async function deleteMirrorFile(runId, options = {}) {
  const payload = await bridgeRequest('/v1/files/' + encodeURIComponent(runId), { ...options, method: 'DELETE' });
  const cached = getCachedMirrorFileCatalog(options.config || null);
  if (cached) cacheMirrorFileCatalog({ ...cached, files: cached.files.filter((item) => item.runId !== runId) }, options.config || null);
  return payload;
}

export function saveMirrorFileRecord(runId, record, options = {}) {
  return bridgeRequest('/v1/files/' + encodeURIComponent(runId) + '/record', { ...options, method: 'PUT', body: record });
}

export function acknowledgeMirrorRun(runId, options = {}) {
  return bridgeRequest(`/v1/runs/${encodeURIComponent(runId)}/ack`, { ...options, method: 'POST', body: {} });
}

export function saveGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Groq API Key');
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'PUT', body: { apiKey: key } });
}

export function validateGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Groq API Key');
  return bridgeRequest('/v1/settings/groq/validate', { ...options, method: 'POST', body: { apiKey: key } });
}

export function deleteGroqSecret(options = {}) {
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'DELETE' });
}

export function saveTtsSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Google Cloud TTS API Key');
  return bridgeRequest('/v1/settings/tts', { ...options, method: 'PUT', body: { apiKey: key } });
}

export function validateTtsSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Google Cloud TTS API Key');
  return bridgeRequest('/v1/settings/tts/validate', { ...options, method: 'POST', body: { apiKey: key } });
}

export function deleteTtsSecret(options = {}) {
  return bridgeRequest('/v1/settings/tts', { ...options, method: 'DELETE' });
}

export function requestSpeech(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) throw new BridgeError('configuration', '发音文本为空');
  return bridgeRequest('/v1/tts/synthesize', { ...options, method: 'POST', body: { text: value } });
}

export function getGroqModels(options = {}) {
  return bridgeRequest('/v1/groq/models', options);
}

export function requestGroqCompletion(body, options = {}) {
  return bridgeRequest('/v1/groq/chat', { ...options, method: 'POST', body });
}
