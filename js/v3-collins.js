import { ProviderError, fetchProviderJson, objectValue, textValue, arrayValue } from './v3-provider-runtime.js';

const KEY_STORAGE = 'gualVocabulary.collinsApiKey';
const DICTIONARY_STORAGE = 'gualVocabulary.collinsDictionaryCode';
const BASE_URL = 'https://api.collinsdictionary.com/api/v1';

export function getCollinsApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setCollinsApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE);
}
export function getCollinsDictionary() { return localStorage.getItem(DICTIONARY_STORAGE) || ''; }
export function validateDictionaryCode(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) {
    throw new ProviderError('configuration', '请在设置中明确选择或填写 Collins 词典代码');
  }
  return value;
}
export function setCollinsDictionary(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  if (code) localStorage.setItem(DICTIONARY_STORAGE, validateDictionaryCode(code));
  else localStorage.removeItem(DICTIONARY_STORAGE);
}

function collinsFetch(path, { apiKey = getCollinsApiKey(), signal = null, onState = (_state) => {} } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new ProviderError('configuration', '请先在设置中配置 Collins API Key');
  // Preserve 4.7.3's HTTPS accesskey compatibility; never echo URL/key or silently
  // switch authentication. Live account/CORS verification remains an external gate.
  const url = new URL(BASE_URL + path);
  url.searchParams.set('accesskey', apiKey.trim());
  return fetchProviderJson(url.href, { method: 'GET', headers: { Accept: 'application/json' } },
    { provider: 'Collins', signal, timeoutMs: 20000, retries: 0, onState });
}

/** Explicit settings action only. Returned catalog lives in the settings frame. */
export async function refreshCollinsDictionaries(options = {}) {
  const payload = await collinsFetch('/dictionaries', options);
  const rows = Array.isArray(payload) ? payload : objectValue(payload).dictionaries;
  const seen = new Set();
  return arrayValue(rows, 'dictionaries', 500).map((value) => {
    const d = objectValue(value, 'dictionary');
    const code = validateDictionaryCode(textValue(d.dictionaryCode, 'dictionaryCode', { max: 100 }));
    if (seen.has(code)) throw new ProviderError('invalid-response', 'Collins 返回了重复词典代码');
    seen.add(code);
    return { code, name: textValue(d.dictionaryName, 'dictionaryName', { max: 300 }) };
  });
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
  const code = validateDictionaryCode(dictionaryCode);
  const payload = await collinsFetch(`/dictionaries/${encodeURIComponent(code)}/search/first?q=${encodeURIComponent(query)}&format=html`, { signal, onState });
  return decodeCollinsEntry(payload, query, code);
}
