// @ts-check
import { getBridgeConfig } from './v5-bridge.js';

const REQUEST_TIMEOUT_MS = 20000;

export class CollinsBridgeError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'CollinsBridgeError';
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
  catch { throw new CollinsBridgeError('configuration', 'Bridge 地址无效'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new CollinsBridgeError('configuration', 'Bridge 必须使用 HTTPS');
  return url.origin + url.pathname.replace(/\/+$/, '');
}

function iosCredentialRecoveryCandidate(value) {
  const token = String(value || '').trim();
  if (!/^[a-z]:/.test(token)) return '';
  return token.charAt(0).toUpperCase() + token.slice(1);
}

async function requestOnce(path, { method = 'GET', body = null, signal = null, config = null } = {}) {
  const selected = config || getBridgeConfig();
  const url = normalizedUrl(selected.url);
  const deviceToken = String(selected.deviceToken || '').trim();
  if (!url || !deviceToken) throw new CollinsBridgeError('configuration', 'Bridge 尚未配置');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        accept: 'application/json', authorization: `Bearer ${deviceToken}`,
        'x-vix-device-token': deviceToken, 'x-vix-client': 'vix-web',
        ...(body == null ? {} : { 'content-type': 'application/json' }),
      },
      body: body == null ? null : JSON.stringify(body), cache: 'no-store', credentials: 'omit',
      redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new CollinsBridgeError(
      payload?.error?.code || 'request',
      payload?.error?.message || `Collins Bridge 请求失败（HTTP ${response.status}）`,
      response.status, payload?.error || null,
    );
    return payload;
  } catch (error) {
    if (error instanceof CollinsBridgeError) throw error;
    if (signal?.aborted) throw new CollinsBridgeError('cancelled', '请求已取消');
    if (controller.signal.aborted) throw new CollinsBridgeError('timeout', 'Collins Bridge 请求超时');
    throw new CollinsBridgeError('network', '无法连接 Bridge');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function bridgeRequest(path, options = {}) {
  try { return await requestOnce(path, options); }
  catch (error) {
    const config = options.config || getBridgeConfig();
    const recovered = iosCredentialRecoveryCandidate(config?.deviceToken);
    if (!(error instanceof CollinsBridgeError) || error.status !== 401 || !recovered) throw error;
    return requestOnce(path, { ...options, config: { ...config, deviceToken: recovered } });
  }
}

export function requestCollinsLookup(text, options = {}) {
  const value = String(text || '').trim();
  if (!value) throw new CollinsBridgeError('configuration', 'Collins 查询文本为空');
  return bridgeRequest('/v1/collins/lookup', { ...options, method: 'POST', body: { text: value } });
}
export function saveCollinsSecret(apiKey, options = {}) {
  const value = String(apiKey || '').trim();
  if (!value) throw new CollinsBridgeError('configuration', '请填写 Collins API Key');
  return bridgeRequest('/v1/settings/collins', { ...options, method: 'PUT', body: { apiKey: value } });
}
export function validateCollinsSecret(apiKey, options = {}) {
  const value = String(apiKey || '').trim();
  if (!value) throw new CollinsBridgeError('configuration', '请填写 Collins API Key');
  return bridgeRequest('/v1/settings/collins/validate', { ...options, method: 'POST', body: { apiKey: value } });
}
export function deleteCollinsSecret(options = {}) {
  return bridgeRequest('/v1/settings/collins', { ...options, method: 'DELETE' });
}
