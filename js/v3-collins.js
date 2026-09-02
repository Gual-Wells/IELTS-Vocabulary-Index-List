import { ProviderError, fetchProviderJson, objectValue, textValue } from './v3-provider-runtime.js';

const KEY_STORAGE = 'gualVocabulary.collinsApiKey';
const DICTIONARY_STORAGE = 'gualVocabulary.collinsDictionaryCode';
const BASE_URL = 'https://api.collinsdictionary.com/api/v1';

export const COLLINS_DICTIONARIES = Object.freeze([
  Object.freeze({ code: 'american-learner', name: 'Collins Cobuild Advanced American' }),
  Object.freeze({ code: 'american', name: "Webster's New World College Dictionary" }),
]);
/** @type {ReadonlySet<string>} */
const COLLINS_DICTIONARY_CODES = new Set(COLLINS_DICTIONARIES.map((dictionary) => dictionary.code));

export function getCollinsApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setCollinsApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE);
}
export function getCollinsDictionary() { return localStorage.getItem(DICTIONARY_STORAGE) || ''; }
export function validateDictionaryCode(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) {
    throw new ProviderError('configuration', 'Collins 词典选择无效，请在设置中重新选择');
  }
  return value;
}
export function validateSupportedCollinsDictionary(value) {
  const code = validateDictionaryCode(value);
  if (!COLLINS_DICTIONARY_CODES.has(code)) {
    throw new ProviderError('configuration', '请在设置中选择 VIX 支持的 Collins 词典');
  }
  return code;
}
export function setCollinsDictionary(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  if (code) localStorage.setItem(DICTIONARY_STORAGE, validateSupportedCollinsDictionary(code));
  else localStorage.removeItem(DICTIONARY_STORAGE);
}

function collinsFetch(path, { apiKey = getCollinsApiKey(), signal = null, onState = (_state) => {} } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ProviderError('configuration', '请先在设置中配置 Collins API Key');
  const url = new URL(BASE_URL + path);
  return fetchProviderJson(url.href, { method: 'GET', headers: {
    Accept: 'application/json', accessKey: apiKey.trim(),
  } },
    { provider: 'Collins', signal, timeoutMs: 20000, retries: 0, onState });
}

export function decodeCollinsEntry(payload, query, dictionaryCode) {
  const p = objectValue(payload, 'Collins entry');
  if (p.error || p.errorCode) throw new ProviderError('invalid-response', 'Collins 返回了错误内容');
  return { provider: 'Collins', query, dictionaryCode,
    entryId: textValue(p.entryId, 'entryId', { max: 500 }),
    entryContent: textValue(p.entryContent, 'entryContent', { max: 500000 }) };
}

/** One click = one upstream request. No enumeration, retries or follow-up entry fetch. */
export async function queryCollins(text, { signal = null, onState = (_state) => {}, dictionaryCode = getCollinsDictionary() } = {}) {
  const query = textValue(text, 'query', { max: 240 });
  const code = validateSupportedCollinsDictionary(dictionaryCode);
  const payload = await collinsFetch(`/dictionaries/${encodeURIComponent(code)}/search/first/?q=${encodeURIComponent(query)}&format=html`, { signal, onState });
  return decodeCollinsEntry(payload, query, code);
}
