import {
  AI_CHECK_BATCH_SIZE, DEFAULT_GROQ_MODEL, GROQ_BASE_URL, GROQ_KEY_STORAGE, GROQ_MODEL_STORAGE, POS_ORDER,
} from './constants.js';
import { normalizeWord, parsePos } from './utils.js';


function readLocalStorage(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; }
  catch { return fallback; }
}

function writeLocalStorage(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (error) {
    throw new Error(`无法保存浏览器设置：${error?.message || error}`);
  }
}

export function getGroqConfig() {
  return {
    key: readLocalStorage(GROQ_KEY_STORAGE, ''),
    model: readLocalStorage(GROQ_MODEL_STORAGE, DEFAULT_GROQ_MODEL) || DEFAULT_GROQ_MODEL,
  };
}

export function saveGroqConfig({ key, model }) {
  const cleanKey = String(key ?? '').trim();
  const cleanModel = String(model ?? '').trim() || DEFAULT_GROQ_MODEL;
  writeLocalStorage(GROQ_KEY_STORAGE, cleanKey);
  writeLocalStorage(GROQ_MODEL_STORAGE, cleanModel);
  return { key: cleanKey, model: cleanModel };
}

export function clearGroqKey() {
  writeLocalStorage(GROQ_KEY_STORAGE, '');
}

function requireConfig() {
  const config = getGroqConfig();
  if (!config.key) throw new Error('请先在设置中保存 Groq API Key');
  return config;
}

function linkedAbortController(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('请求超时', 'TimeoutError')), timeoutMs);
  const externalAbort = () => controller.abort(externalSignal.reason ?? new DOMException('请求已取消', 'AbortError'));
  if (externalSignal) {
    if (externalSignal.aborted) externalAbort();
    else externalSignal.addEventListener('abort', externalAbort, { once: true });
  }
  return {
    controller,
    cleanup() {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', externalAbort);
    },
  };
}

/**
 * @param {string} path
 * @param {RequestInit} options
 * @param {{signal?: AbortSignal, timeoutMs?: number}} config
 */
async function groqFetch(path, options = {}, { signal, timeoutMs = 30000 } = {}) {
  const { key } = requireConfig();
  const linked = linkedAbortController(signal, timeoutMs);
  try {
    const response = await fetch(`${GROQ_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(options.headers ?? {}),
      },
      signal: linked.controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `Groq 请求失败（HTTP ${response.status}）`;
      throw new Error(message);
    }
    return payload;
  } finally {
    linked.cleanup();
  }
}

async function requestJson({ system, user, signal, maxTokens = 1200, temperature = 0.15 }) {
  const { model } = requireConfig();
  const payload = await groqFetch('/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  }, { signal, timeoutMs: 45000 });
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq 返回内容为空');
  try { return JSON.parse(content); }
  catch { throw new Error('Groq 未返回有效 JSON'); }
}

export async function fetchAvailableModels(signal) {
  const payload = await groqFetch('/models', { method: 'GET', headers: {} }, { signal, timeoutMs: 20000 });
  const excluded = /(whisper|guard|tts|orpheus|audio|safeguard)/i;
  return (payload?.data ?? [])
    .filter((model) => model?.id && model.active !== false && !excluded.test(model.id))
    .map((model) => model.id)
    .sort((a, b) => a.localeCompare(b));
}

export async function getChineseSearchCandidates(query, signal) {
  const data = await requestJson({
    signal,
    maxTokens: 500,
    system: [
      '你是英语词典检索辅助器。用户输入中文概念，你只负责给出可能对应的英语词典 headword 或常见固定短语。',
      '不得给出中文释义、解释、例句或 Markdown。必须返回 JSON：{"candidates":["word", "phrase"]}。',
      '候选 8 至 24 个，按匹配可能性排序；优先词典原形，包含常见英式拼写变体。',
    ].join('\n'),
    user: String(query).slice(0, 500),
  });
  const values = Array.isArray(data?.candidates) ? data.candidates : [];
  return [...new Set(values.map((item) => String(item).trim().slice(0, 160)).filter(Boolean))].slice(0, 30);
}

export async function suggestVocabulary(query, signal) {
  const data = await requestJson({
    signal,
    maxTokens: 850,
    system: [
      '你是英语词汇候选生成器。只返回英语词汇或常见固定短语及词性，不返回释义、例句或说明。',
      `允许的词性标签只有：${POS_ORDER.join('、')}。`,
      '必须返回 JSON：{"items":[{"word":"example","pos":["n.","v."]}]}。',
      '返回 3 至 12 项；使用词典原形；不要返回同一个词的大小写变体或屈折变化重复项。',
    ].join('\n'),
    user: String(query).slice(0, 800),
  });
  const items = [];
  const seen = new Set();
  for (const raw of Array.isArray(data?.items) ? data.items : []) {
    const word = String(raw?.word ?? '').trim().slice(0, 160);
    const key = normalizeWord(word);
    if (!word || seen.has(key)) continue;
    try {
      const pos = parsePos(Array.isArray(raw.pos) ? raw.pos.join(', ') : raw.pos);
      if (!pos.length) continue;
      seen.add(key);
      items.push({ word, pos });
    } catch { /* 丢弃不合法候选 */ }
  }
  return items.slice(0, 16);
}

export async function checkVocabularyBatch(entries, signal) {
  const compact = entries.slice(0, AI_CHECK_BATCH_SIZE).map((entry) => ({
    id: entry.id, word: entry.word, pos: entry.pos,
  }));
  const data = await requestJson({
    signal,
    maxTokens: 1800,
    system: [
      '你是严格的英语词典校对器。只核查两件事：英文 headword/短语的拼写；给定词性标签是否适用于该词。',
      '不要评价释义、级别、频率、用法熟练度、大小写风格或词表归属。不要修改数据。',
      `合法词性标签：${POS_ORDER.join('、')}。`,
      '仅返回确实可疑的项目。必须返回 JSON：',
      '{"issues":[{"entryId":"原 id","spelling":{"incorrect":true,"suggestion":"正确拼写或空字符串"},"pos":{"incorrect":true,"suggestion":["n."]},"reason":"简短理由"}]}',
      '如果只有拼写问题，则 pos.incorrect=false；如果只有词性问题，则 spelling.incorrect=false。完全正确的词不要出现在 issues 中。',
    ].join('\n'),
    user: JSON.stringify({ entries: compact }),
  });
  const allowedIds = new Set(compact.map((item) => item.id));
  const issues = [];
  const seenIssueIds = new Set();
  for (const raw of Array.isArray(data?.issues) ? data.issues : []) {
    const entryId = String(raw?.entryId ?? '');
    if (!allowedIds.has(entryId) || seenIssueIds.has(entryId)) continue;
    const spellingIncorrect = Boolean(raw?.spelling?.incorrect);
    let posIncorrect = Boolean(raw?.pos?.incorrect);
    if (!spellingIncorrect && !posIncorrect) continue;
    let suggestedPos = [];
    if (posIncorrect) {
      try { suggestedPos = parsePos(Array.isArray(raw.pos?.suggestion) ? raw.pos.suggestion.join(', ') : raw.pos?.suggestion); }
      catch { suggestedPos = []; }
      if (!suggestedPos.length) posIncorrect = false;
    }
    if (!spellingIncorrect && !posIncorrect) continue;
    seenIssueIds.add(entryId);
    issues.push({
      entryId,
      spelling: spellingIncorrect ? { incorrect: true, suggestion: String(raw.spelling?.suggestion ?? '').trim().slice(0, 160) } : { incorrect: false, suggestion: '' },
      pos: posIncorrect ? { incorrect: true, suggestion: suggestedPos } : { incorrect: false, suggestion: [] },
      reason: String(raw?.reason ?? '').trim().slice(0, 500),
    });
  }
  return issues;
}
