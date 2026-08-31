// @ts-check
import { SYSTEM_GLOBAL_CONTENT_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_WORDS_ID } from './v3-model.js';

export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';
export const CHATGPT_SHORTCUT_NAME = 'AI查询';
export const ENTRY_CONTEXT_FORMAT = 'vix-entry-context';
export const ENTRY_CONTEXT_VERSION = 2;
export { getCollinsApiKey, setCollinsApiKey, queryCollins } from './v3-collins.js';
const MAX_CONTEXT_RELATIONS = 16;

function clean(value) { return String(value ?? '').trim(); }

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
