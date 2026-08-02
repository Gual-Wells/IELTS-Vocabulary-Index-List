// @ts-check
import { SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_WORDS_ID } from './v3-model.js';

export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';
export const CHATGPT_SHORTCUT_NAME = 'AI查询';
export const ENTRY_CONTEXT_FORMAT = 'vix-entry-context';
export const ENTRY_CONTEXT_VERSION = 1;

function cloneRecord(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function sortById(items) {
  return [...items].sort((a, b) => String(a.id || a.key || '').localeCompare(String(b.id || b.key || '')));
}

function sourceKeysForEntry(entry) {
  const value = String(entry?.glossSource || '').trim();
  return value ? value.split(/[+,/|;\s]+/).filter(Boolean) : [];
}

function matchingInstances(state, entry, collectionId) {
  if (![SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) return [entry];
  const source = entry.kind === 'phrase'
    ? (state.phrasesByNormalizedText.get(entry.normalizedText) || [])
    : (state.wordsByNormalizedText.get(entry.normalizedText) || []);
  return [...source].sort((a, b) => Number(state.domainById.get(a.domainId)?.order || 0)
    - Number(state.domainById.get(b.domainId)?.order || 0)
    || String(a.id).localeCompare(String(b.id)));
}

/**
 * Build a normalized, JSON-safe snapshot for one first-level row.
 * The selected entry instances and their direct relation targets are exported as
 * complete records once, while relation edges refer to IDs to avoid URL bloat.
 */
export function createEntryContext(state, entry, collectionId, options = {}) {
  if (!state || !entry || !collectionId) throw new Error('无法生成条目上下文');
  const currentCollection = state.collectionById.get(collectionId);
  if (!currentCollection) throw new Error('当前词表不存在');
  const isGlobal = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId);
  const instances = matchingInstances(state, entry, collectionId);
  if (!instances.length) throw new Error('当前条目没有可导出的独立域实例');

  const domainMap = new Map();
  const collectionMap = new Map();
  const membershipMap = new Map();
  const tokenMap = new Map();
  const pinMap = new Map();
  const annotationMap = new Map();
  const studyMap = new Map();
  const relations = [];
  const sourceKeys = new Set();

  const addDomain = (domainId) => {
    const domain = state.domainById.get(domainId);
    if (domain) domainMap.set(domain.id, domain);
  };
  const addCollection = (collection) => {
    if (!collection) return;
    collectionMap.set(collection.id, collection);
    if (collection.domainId) addDomain(collection.domainId);
  };
  const addMemberships = (entryId, includeRecords = true) => {
    const result = [];
    for (const membership of state.membershipsByEntry.get(entryId) || []) {
      const collection = state.collectionById.get(membership.collectionId);
      if (includeRecords) membershipMap.set(`${membership.entryId}\u0000${membership.collectionId}`, membership);
      addCollection(collection);
      result.push({
        membershipId: `${membership.entryId}:${membership.collectionId}`,
        collectionId: membership.collectionId,
        collectionName: collection?.name || '',
        collectionType: collection?.type || '',
        domainId: collection?.domainId || '',
      });
    }
    return result;
  };
  const entrySummary = (candidate) => {
    if (!candidate) return null;
    sourceKeysForEntry(candidate).forEach((key) => sourceKeys.add(key));
    addDomain(candidate.domainId);
    return {
      id: candidate.id,
      domainId: candidate.domainId,
      kind: candidate.kind,
      text: candidate.text,
      normalizedText: candidate.normalizedText,
      glossHant: candidate.glossHant || '',
      glossSource: candidate.glossSource || '',
      memberships: addMemberships(candidate.id, false),
    };
  };

  addCollection(currentCollection);
  for (const instance of instances) {
    addDomain(instance.domainId);
    sourceKeysForEntry(instance).forEach((key) => sourceKeys.add(key));
    addMemberships(instance.id, true);
    const pin = state.pinByEntry.get(instance.id);
    const annotation = state.annotationByEntry.get(instance.id);
    const stamp = state.studyStampByKey.get(`entry:${instance.id}`);
    if (pin) pinMap.set(instance.id, pin);
    if (annotation) annotationMap.set(instance.id, annotation);
    if (stamp) studyMap.set(stamp.key, stamp);

    if (instance.kind === 'word') {
      for (const phrase of state.relatedPhrasesByEntry.get(instance.id) || []) {
        relations.push({
          type: 'related-phrase',
          sourceEntryId: instance.id,
          target: entrySummary(phrase),
        });
      }
    } else {
      for (const component of state.phraseComponentsByEntry.get(instance.id) || []) {
        const token = {
          id: component.id,
          phraseId: component.phraseId,
          domainId: component.domainId,
          token: component.token,
          normalizedToken: component.normalizedToken,
          tokenIndex: component.tokenIndex,
        };
        tokenMap.set(token.id, token);
        relations.push({
          type: 'component-word',
          sourceEntryId: instance.id,
          tokenId: component.id,
          target: entrySummary(component.entry),
        });
      }
    }
  }

  if (isGlobal) {
    const globalStamp = state.studyStampByKey.get(`global:${entry.kind}:${entry.normalizedText}`);
    if (globalStamp) studyMap.set(globalStamp.key, globalStamp);
  }

  const sourceCatalog = (state.settings?.contentSources || [])
    .filter((source) => sourceKeys.has(String(source.key || '')))
    .map(cloneRecord);

  return {
    format: ENTRY_CONTEXT_FORMAT,
    version: ENTRY_CONTEXT_VERSION,
    generatedAt: new Date().toISOString(),
    application: { name: 'Vocabulary Index', version: String(options.appVersion || '') },
    currentView: {
      collectionId,
      domainId: currentCollection.domainId || null,
      mode: String(options.viewMode || 'alphabet'),
      section: String(options.section || (entry.kind === 'phrase' ? 'phrase' : 'word')),
    },
    subject: isGlobal ? {
      scope: 'global-aggregate',
      kind: entry.kind,
      text: entry.text,
      normalizedText: entry.normalizedText,
      aggregateKey: `global:${entry.kind}:${entry.normalizedText}`,
      instanceEntryIds: instances.map((item) => item.id),
    } : {
      scope: 'domain-entry',
      kind: entry.kind,
      text: entry.text,
      normalizedText: entry.normalizedText,
      entryId: entry.id,
      domainId: entry.domainId,
      instanceEntryIds: [entry.id],
    },
    domains: sortById([...domainMap.values()]).map(cloneRecord),
    collections: sortById([...collectionMap.values()]).map(cloneRecord),
    entries: instances.map(cloneRecord),
    memberships: [...membershipMap.values()]
      .sort((a, b) => `${a.entryId}\u0000${a.collectionId}`.localeCompare(`${b.entryId}\u0000${b.collectionId}`))
      .map(cloneRecord),
    phraseTokens: sortById([...tokenMap.values()]).map(cloneRecord),
    relations,
    pins: sortById([...pinMap.values()]).map(cloneRecord),
    annotations: sortById([...annotationMap.values()]).map(cloneRecord),
    studyStamps: [...studyMap.values()].sort((a, b) => String(a.key).localeCompare(String(b.key))).map(cloneRecord),
    sources: sourceCatalog,
    exclusions: [
      'Groq API Key',
      'unrelated entries',
      'application-wide settings',
      'undo and redo history',
      'saved browsing positions outside the current view',
    ],
  };
}

export function buildOxfordLookupUrl(text) {
  const query = String(text || '').trim();
  if (!query) throw new Error('没有可查询的英文');
  return `${OXFORD_LOOKUP_SCHEME}?q=${encodeURIComponent(query)}`;
}

export function buildChatGPTPrompt(context) {
  if (!context || context.format !== ENTRY_CONTEXT_FORMAT) throw new Error('条目上下文格式无效');
  return [
    '请为以下 Vocabulary Index 一级条目创建一次独立查询。',
    '请使用网页搜索及权威原始资料，根据条目所属独立域和普通表判断语境，核查当前含义、繁体中文译法、典型用法或技术场景、相关概念以及可能过时或不准确的信息。重要事实请提供来源。',
    '不要修改或省略原始 JSON；先给出核查结论，再给出对现有条目数据的修订建议。',
    '',
    JSON.stringify(context),
  ].join('\n');
}

export function buildChatGPTShortcutUrl(prompt, shortcutName = CHATGPT_SHORTCUT_NAME) {
  const text = String(prompt || '');
  if (!text.trim()) throw new Error('没有可发送给 ChatGPT 的内容');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(text)}`;
}
