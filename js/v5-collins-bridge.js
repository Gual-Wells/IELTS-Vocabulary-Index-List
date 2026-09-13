// @ts-check
import { getBridgeConfig } from './v5-bridge.js';

const REQUEST_TIMEOUT_MS = 20000;
const DICTIONARY_KEY = 'gualVocabulary.collinsDictionaryCode';

export const COLLINS_DICTIONARY_OPTIONS = Object.freeze([
  Object.freeze({
    code: 'american-learner',
    label: 'Collins COBUILD Advanced Learner’s Dictionary – American English',
    shortLabel: 'COBUILD Advanced American',
  }),
  Object.freeze({
    code: 'american',
    label: 'Webster’s New World College Dictionary (5th Edition) – American English',
    shortLabel: 'Webster’s New World College Dictionary 5e',
  }),
]);

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

function normalizedDictionaryCode(value, { fallback = true } = {}) {
  const code = String(value || '').trim().toLowerCase();
  if (COLLINS_DICTIONARY_OPTIONS.some((item) => item.code === code)) return code;
  return fallback && !code ? COLLINS_DICTIONARY_OPTIONS[0].code : '';
}

export function getCollinsDictionaryPreference() {
  return normalizedDictionaryCode(localStorage.getItem(DICTIONARY_KEY)) || COLLINS_DICTIONARY_OPTIONS[0].code;
}

export function setCollinsDictionaryPreference(value) {
  const code = normalizedDictionaryCode(value, { fallback: false });
  if (!code) throw new CollinsBridgeError('configuration', 'Collins 目标词典无效');
  localStorage.setItem(DICTIONARY_KEY, code);
  return code;
}

function dictionaryFromOptions(options = {}) {
  const code = normalizedDictionaryCode(options.dictionaryCode || getCollinsDictionaryPreference());
  if (!code) throw new CollinsBridgeError('configuration', 'Collins 目标词典无效');
  return code;
}

function requestOptions(options = {}) {
  const { dictionaryCode: _dictionaryCode, ...rest } = options;
  return rest;
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
  const code = dictionaryFromOptions(options);
  return bridgeRequest('/v1/collins/lookup', {
    ...requestOptions(options), method: 'POST', body: { text: value, dictionaryCode: code },
  });
}
export function saveCollinsSecret(apiKey, options = {}) {
  const value = String(apiKey || '').trim();
  if (!value) throw new CollinsBridgeError('configuration', '请填写 Collins API Key');
  const code = dictionaryFromOptions(options);
  return bridgeRequest('/v1/settings/collins', {
    ...requestOptions(options), method: 'PUT', body: { apiKey: value, dictionaryCode: code },
  });
}
export function validateCollinsSecret(apiKey, options = {}) {
  const value = String(apiKey || '').trim();
  if (!value) throw new CollinsBridgeError('configuration', '请填写 Collins API Key');
  const code = dictionaryFromOptions(options);
  return bridgeRequest('/v1/settings/collins/validate', {
    ...requestOptions(options), method: 'POST', body: { apiKey: value, dictionaryCode: code },
  });
}
export function deleteCollinsSecret(options = {}) {
  return bridgeRequest('/v1/settings/collins', { ...requestOptions(options), method: 'DELETE' });
}
