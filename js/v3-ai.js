const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const KEY_STORAGE = 'gualVocabulary.groqApiKey';
const MODEL_STORAGE = 'gualVocabulary.groqModel';
const CATALOG_STORAGE = 'gualVocabulary.groqModelCatalog';
const ACTIVE_STORAGE = 'gualVocabulary.groqModelActiveCatalog';
const UPDATED_STORAGE = 'gualVocabulary.groqModelCatalogUpdatedAt';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 45000;
const MAX_BATCH_SIZE = 32;
const TARGET_INPUT_TOKENS = 1050;

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || '';
}

export function setApiKey(value) {
  const key = String(value || '').trim();
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

export function getSelectedModel() {
  return localStorage.getItem(MODEL_STORAGE) || '';
}

export function selectModel(modelId) {
  const value = String(modelId || '').trim();
  if (value) localStorage.setItem(MODEL_STORAGE, value);
  else localStorage.removeItem(MODEL_STORAGE);
}

export function getModelCatalog() {
  const historical = readJson(CATALOG_STORAGE, []);
  const active = new Set(readJson(ACTIVE_STORAGE, []));
  const selected = getSelectedModel();
  const ids = [...new Set([...historical, ...active, ...(selected ? [selected] : [])])].sort();
  return ids.map((id) => ({ id, active: active.has(id), selected: id === selected }));
}

export function getModelCatalogUpdatedAt() {
  return localStorage.getItem(UPDATED_STORAGE) || '';
}

function requireKey() {
  const key = getApiKey();
  if (!key) throw new Error('请先配置 Groq API Key');
  return key;
}

function parseRetryAfter(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, time - now) : 0;
}

export { parseRetryAfter };

function classifyRetry(response, error) {
  if (error?.name === 'AbortError') return { retry: true, message: '请求超时' };
  if (error && !response) return { retry: true, message: '网络连接失败' };
  if (response?.status === 429) return { retry: true, message: 'Groq 请求过于频繁' };
  if (response?.status >= 500) return { retry: true, message: `Groq 服务暂时不可用（${response.status}）` };
  if (response?.status === 401 || response?.status === 403) return { retry: false, message: 'Groq API Key 无效或权限不足' };
  return { retry: false, message: response ? `Groq 请求失败（HTTP ${response.status}）` : String(error?.message || error || '请求失败') };
}

function abortError(message = '请求已取消') {
  try { return new DOMException(message, 'AbortError'); } catch { const error = new Error(message); error.name = 'AbortError'; return error; }
}

function abortableDelay(milliseconds, signal = null) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    const onAbort = () => { clearTimeout(timer); reject(abortError()); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function groqFetch(path, options = {}, { retries = MAX_RETRIES, timeoutMs = REQUEST_TIMEOUT_MS, signal = null } = {}) {
  const key = requireKey();
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw abortError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    let response = null;
    try {
      const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) };
      for (const [header, value] of Object.entries(headers)) if (value == null) delete headers[header];
      response = await fetch(`${GROQ_BASE_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      if (response.ok) return response;
      const retry = classifyRetry(response, null);
      if (!retry.retry || attempt >= retries) {
        let detail = '';
        try { detail = String((await response.json())?.error?.message || ''); } catch {}
        throw new Error(detail ? `${retry.message}：${detail.slice(0, 240)}` : retry.message);
      }
      const headerDelay = parseRetryAfter(response.headers.get('Retry-After'));
      const delay = Math.max(headerDelay, Math.min(8000, 700 * (2 ** attempt)));
      await abortableDelay(delay, signal);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      const retry = classifyRetry(response, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!retry.retry || attempt >= retries) {
        if (lastError.message && !['Failed to fetch', 'Load failed'].includes(lastError.message)) throw lastError;
        throw new Error(retry.message);
      }
      await abortableDelay(Math.min(8000, 700 * (2 ** attempt)), signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }
  throw lastError || new Error('Groq 请求失败');
}

export async function refreshModels() {
  const response = await groqFetch('/models', { method: 'GET', headers: { 'Content-Type': undefined } });
  const payload = await response.json();
  const active = [...new Set((Array.isArray(payload?.data) ? payload.data : [])
    .map((item) => String(item?.id || '').trim()).filter(Boolean))].sort();
  if (!active.length) throw new Error('Groq 未返回可用模型');
  const historical = readJson(CATALOG_STORAGE, []);
  const selected = getSelectedModel();
  const merged = [...new Set([...historical, ...active, ...(selected ? [selected] : [])])].sort();
  writeJson(CATALOG_STORAGE, merged);
  writeJson(ACTIVE_STORAGE, active);
  localStorage.setItem(UPDATED_STORAGE, new Date().toISOString());
  if (!selected) selectModel(active[0]);
  return getModelCatalog();
}

function extractJson(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(raw); } catch {}
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) return JSON.parse(raw.slice(objectStart, objectEnd + 1));
  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) return JSON.parse(raw.slice(arrayStart, arrayEnd + 1));
  throw new Error('AI 返回内容不是有效 JSON');
}

export async function requestJson(messages, { temperature = 0.1, maxTokens = 1600, signal = null } = {}) {
  const model = getSelectedModel();
  if (!model) throw new Error('请先刷新并选择 Groq 模型');
  const request = async (withResponseFormat) => {
    const body = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (withResponseFormat) body.response_format = { type: 'json_object' };
    const response = await groqFetch('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    }, { signal });
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 未返回内容');
    return extractJson(content);
  };
  try {
    return await request(true);
  } catch (error) {
    const message = String(error?.message || error);
    if (!/response[_ -]?format|json[_ -]?object|unsupported|not support|不支持/i.test(message)) throw error;
    return request(false);
  }
}

export async function suggestSearchTerms(query) {
  const clean = String(query || '').trim();
  if (!clean) return [];
  const payload = await requestJson([
    {
      role: 'system',
      content: 'Convert one Chinese concept into concise English vocabulary search terms. Return one JSON object only. Do not explain.',
    },
    {
      role: 'user',
      content: `Chinese concept: ${clean}\nReturn {"terms":["term 1","term 2"]}. Use common dictionary headwords or short phrases, at most 12 terms, no duplicates.`,
    },
  ], { temperature: 0.1, maxTokens: 500 });
  const seen = new Set();
  const terms = [];
  for (const item of Array.isArray(payload?.terms) ? payload.terms : []) {
    const term = String(item || '').trim();
    const key = term.toLocaleLowerCase('en');
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= 12) break;
  }
  return terms;
}

export async function suggestEntries({ domainName, collectionName, instruction, existing = [], glossEnabled = false }) {
  const payload = await requestJson([
    {
      role: 'system',
      content: 'You generate concise English vocabulary candidates. Return one JSON object only. Do not use markdown.',
    },
    {
      role: 'user',
      content: `Domain: ${domainName}\nList: ${collectionName}\nTask: ${instruction}\nAlready present: ${existing.slice(0, 300).join(', ')}\nReturn {"entries":[{"text":"...","sourceLabel":"n.","gloss":"..."}]}. Use base/common forms, standard concise part-of-speech labels, and no duplicates. ${glossEnabled ? 'gloss may be Simplified or Traditional Chinese.' : 'Use an empty gloss.'}`,
    },
  ], { temperature: 0.25, maxTokens: 2200 });
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  return entries.map((item) => ({
    text: String(item?.text || '').trim(),
    sourceLabel: String(item?.sourceLabel || item?.pos || '').trim(),
    gloss: String(item?.gloss || '').trim(),
  })).filter((item) => item.text);
}

function estimateTokens(entries) {
  return entries.reduce((sum, entry) => sum + Math.ceil(String(entry.text || '').length / 3) + 6, 0);
}

export function createAiCheckBatches(entries) {
  const batches = [];
  let current = [];
  for (const entry of entries) {
    if (current.length && (current.length >= MAX_BATCH_SIZE || estimateTokens([...current, entry]) > TARGET_INPUT_TOKENS)) {
      batches.push(current);
      current = [];
    }
    current.push(entry);
  }
  if (current.length) batches.push(current);
  return batches;
}

export class AiCheckController {
  constructor() {
    this.paused = false;
    this.cancelled = false;
    this.waiters = [];
    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
  }
  pause() { this.paused = true; }
  resume() {
    this.paused = false;
    for (const resolve of this.waiters.splice(0)) resolve();
  }
  cancel() { this.cancelled = true; this.abortController.abort(); this.resume(); }
  async checkpoint() {
    if (this.cancelled) return false;
    if (this.paused) await new Promise((resolve) => this.waiters.push(resolve));
    return !this.cancelled;
  }
}

export async function checkEntries(entries, { controller = new AiCheckController(), onProgress = (_progress) => {}, onBatch = async (_issues, _batch) => {} } = {}) {
  const batches = createAiCheckBatches(entries);
  const annotations = [];
  for (let index = 0; index < batches.length; index += 1) {
    if (!(await controller.checkpoint())) break;
    const batch = batches[index];
    onProgress({ completed: index, total: batches.length, currentSize: batch.length });
    const payload = await requestJson([
      {
        role: 'system',
        content: 'Check English spelling, obvious text-format errors, and whether the supplied part-of-speech label is plausible for the headword. Return JSON only. Do not judge meaning, style, or harmless capitalization variants.',
      },
      {
        role: 'user',
        content: `Items:\n${batch.map((entry) => `${entry.id}\t${entry.text}\t${entry.sourceLabel || ''}`).join('\n')}\nReturn {"issues":[{"entryId":"...","suggestion":"...","posSuggestion":"...","reason":"..."}]}. Leave suggestion empty when spelling is correct. Leave posSuggestion empty when the label is acceptable. Omit fully correct items.`,
      },
    ], { temperature: 0, maxTokens: 1800, signal: controller.signal });
    const issues = (Array.isArray(payload?.issues) ? payload.issues : []).map((item) => {
      const suggestion = String(item?.suggestion || '').trim();
      const posSuggestion = String(item?.posSuggestion || item?.pos || '').trim();
      const rawReason = String(item?.reason || '').trim();
      const reason = [posSuggestion ? `词性建议：${posSuggestion}` : '', rawReason].filter(Boolean).join('；').slice(0, 240);
      return {
        entryId: String(item?.entryId || ''),
        spelling: { incorrect: Boolean(suggestion), suggestion },
        reason,
      };
    }).filter((item) => item.entryId && (item.spelling.suggestion || item.reason));
    annotations.push(...issues);
    await onBatch(issues, batch);
    onProgress({ completed: index + 1, total: batches.length, currentSize: batch.length });
  }
  return { annotations, cancelled: controller.cancelled, completedBatches: controller.cancelled ? undefined : batches.length, totalBatches: batches.length };
}
