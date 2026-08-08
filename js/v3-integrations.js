// @ts-check
import { SYSTEM_GLOBAL_CONTENT_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_WORDS_ID } from './v3-model.js';

export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';
export const CHATGPT_SHORTCUT_NAME = 'AI查询';
export const ENTRY_CONTEXT_FORMAT = 'vix-entry-context';
export const ENTRY_CONTEXT_VERSION = 2;
const COLLINS_KEY_STORAGE = 'gualVocabulary.collinsApiKey';
const COLLINS_BASE_URL = 'https://api.collinsdictionary.com/api/v1';
const MAX_CONTEXT_RELATIONS = 16;

function clean(value) { return String(value ?? '').trim(); }

export function getCollinsApiKey() { return localStorage.getItem(COLLINS_KEY_STORAGE) || ''; }
export function setCollinsApiKey(value) {
  const key = clean(value);
  if (key) localStorage.setItem(COLLINS_KEY_STORAGE, key);
  else localStorage.removeItem(COLLINS_KEY_STORAGE);
}

function isGlobalCollection(collectionId) {
  return [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collectionId);
}

function preferredMembership(state, entry, requestedCollectionId = '') {
  const memberships = (state.membershipsByEntry.get(entry.id) || [])
    .map((membership) => ({ membership, collection: state.collectionById.get(membership.collectionId) }))
    .filter((item) => item.collection?.type === 'normal' && !item.collection.hidden && state.visibleEntryIdsByCollection.get(item.collection.id)?.has(entry.id))
    .sort((a, b) => Number(a.collection.order || 0) - Number(b.collection.order || 0) || a.collection.name.localeCompare(b.collection.name));
  return memberships.find((item) => item.collection.id === requestedCollectionId)?.collection || memberships[0]?.collection || null;
}

/** Build the intentionally compact context sent through iOS Shortcuts. */
export function createEntryContext(state, entry, collectionId, options = {}) {
  if (!state || !entry || !collectionId) throw new Error('无法生成条目上下文');
  const selectedCollection = state.collectionById.get(collectionId);
  if (!selectedCollection) throw new Error('当前词表不存在');
  const domain = state.domainById.get(entry.domainId);
  if (!domain) throw new Error('当前独立域不存在');
  const ordinary = preferredMembership(state, entry, selectedCollection.type === 'normal' ? selectedCollection.id : '');
  const related = (state.relatedEntriesByEntry.get(entry.id) || []).slice(0, MAX_CONTEXT_RELATIONS);
  const sameText = (state.entriesByNormalizedText.get(entry.normalizedText) || []).filter((candidate) => candidate.id !== entry.id);
  return {
    format: ENTRY_CONTEXT_FORMAT,
    version: ENTRY_CONTEXT_VERSION,
    generatedAt: new Date().toISOString(),
    application: { name: 'Vocabulary Index', version: clean(options.appVersion) },
    subject: {
      entryId: entry.id,
      text: entry.text,
      kind: entry.kind,
      contentType: entry.contentType || '',
      partsOfSpeech: Array.isArray(entry.partsOfSpeech) ? entry.partsOfSpeech : [],
      glossHant: entry.glossHant || '',
      glossSource: entry.glossSource || '',
      domain: { id: domain.id, name: domain.name, contentMode: domain.contentMode || 'structured' },
      collection: ordinary ? { id: ordinary.id, name: ordinary.name } : { id: selectedCollection.id, name: selectedCollection.name },
      projectedFromTotal: selectedCollection.type !== 'normal' || isGlobalCollection(collectionId),
    },
    relations: related.map((target) => {
      const targetDomain = state.domainById.get(target.domainId);
      const targetCollection = preferredMembership(state, target);
      return {
        entryId: target.id,
        text: target.text,
        kind: target.kind,
        contentType: target.contentType || '',
        domain: targetDomain?.name || '',
        collection: targetCollection?.name || '',
      };
    }),
    relationCount: (state.relatedEntriesByEntry.get(entry.id) || []).length,
    crossDomainSameText: sameText.length ? {
      warning: '存在跨独立域同形条目；当前查询只针对本具体 Entry。',
      domains: [...new Set(sameText.map((candidate) => state.domainById.get(candidate.domainId)?.name || candidate.domainId))].slice(0, 8),
    } : null,
    exclusions: ['PIN', '学习日期', 'AI 标注', '全量 Membership', '原始关系组件', '全库同形对象'],
  };
}

export function buildOxfordLookupUrl(text) {
  const query = clean(text);
  if (!query) throw new Error('没有可查询的英文');
  return `${OXFORD_LOOKUP_SCHEME}?q=${encodeURIComponent(query)}`;
}

export function buildChatGPTPrompt(context) {
  if (!context || context.format !== ENTRY_CONTEXT_FORMAT || context.version !== ENTRY_CONTEXT_VERSION) throw new Error('条目上下文格式无效');
  return [
    '请核查并解释以下 Vocabulary Index 学习条目。根据其具体独立域、词表和直接关系判断语境；给出简洁准确的繁体中文解释、典型用法，并指出现有释义明显不准确或过时时的修订建议。需要外部事实时优先权威来源。',
    '这是一个具体 Entry；不要把跨独立域同形条目自动合并。',
    JSON.stringify(context),
  ].join('\n');
}

export function buildChatGPTShortcutUrl(prompt, shortcutName = CHATGPT_SHORTCUT_NAME) {
  const text = clean(prompt);
  if (!text) throw new Error('没有可发送给 ChatGPT 的内容');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(text)}`;
}

export function buildCollinsExternalUrl(text) {
  const query = clean(text).toLocaleLowerCase('en').replace(/\s+/g, '-');
  if (!query) throw new Error('没有可查询的英文');
  return `https://www.collinsdictionary.com/dictionary/english/${encodeURIComponent(query)}`;
}

async function collinsFetch(path, key, signal) {
  const joiner = path.includes('?') ? '&' : '?';
  const response = await fetch(`${COLLINS_BASE_URL}${path}${joiner}accesskey=${encodeURIComponent(key)}`, {
    method: 'GET', signal, headers: { Accept: 'application/json' }, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Collins 请求失败（HTTP ${response.status}）`);
  return response.json();
}

function dictionaryScore(dictionary) {
  const text = `${dictionary?.dictionaryName || ''} ${dictionary?.name || ''} ${dictionary?.dictionaryCode || ''}`.toLocaleLowerCase('en');
  if (/traditional.*chinese|chinese.*traditional|english.*chinese/.test(text)) return 30;
  if (/cobuild/.test(text)) return 25;
  if (/advanced.*learner|learner/.test(text)) return 20;
  if (/english/.test(text)) return 10;
  return 0;
}

function htmlToText(html) {
  const value = clean(html);
  if (!value) return '';
  if (typeof DOMParser === 'function') {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    return clean(doc.body?.textContent || '').replace(/\s+/g, ' ');
  }
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** Direct Collins API query. A network/CORS error is intentionally surfaced so UI can offer website fallback. */
export async function queryCollins(text, { signal = null } = {}) {
  const query = clean(text);
  if (!query) throw new Error('没有可查询的英文');
  const key = getCollinsApiKey();
  if (!key) throw new Error('请先配置 Collins API Key');
  const dictionariesPayload = await collinsFetch('/dictionaries', key, signal);
  const dictionaries = Array.isArray(dictionariesPayload) ? dictionariesPayload : Array.isArray(dictionariesPayload?.dictionaries) ? dictionariesPayload.dictionaries : [];
  const candidates = [...dictionaries].sort((a, b) => dictionaryScore(b) - dictionaryScore(a));
  if (!candidates.length) throw new Error('Collins API Key 没有返回可用词典');
  let lastError = null;
  for (const dictionary of candidates.slice(0, 6)) {
    const code = clean(dictionary?.dictionaryCode || dictionary?.code || dictionary?.id);
    if (!code) continue;
    try {
      const search = await collinsFetch(`/dictionaries/${encodeURIComponent(code)}/search/first?q=${encodeURIComponent(query)}`, key, signal);
      const entryId = clean(search?.entryId || search?.id || search?.entry?.entryId || search?.entry?.id);
      if (!entryId) continue;
      const entry = await collinsFetch(`/dictionaries/${encodeURIComponent(code)}/entries/${encodeURIComponent(entryId)}`, key, signal);
      const html = clean(entry?.entryContent || entry?.content || entry?.entry?.entryContent || entry?.entry?.content);
      const resultText = htmlToText(html);
      if (!resultText) continue;
      return {
        provider: 'Collins', query, dictionaryCode: code,
        dictionaryName: clean(dictionary?.dictionaryName || dictionary?.name || code),
        entryId, text: resultText,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error('Collins 未找到该条目');
}
