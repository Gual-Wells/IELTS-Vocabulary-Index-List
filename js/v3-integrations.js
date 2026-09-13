// @ts-check
import { SYSTEM_GLOBAL_CONTENT_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_WORDS_ID } from './v3-model.js';

export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';
export const ENTRY_CONTEXT_FORMAT = 'vix-entry-context';
export const ENTRY_CONTEXT_VERSION = 2;
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

export function createEntryContext(state, entry, collectionId, options = {}) {
  if (!state || !entry || !collectionId) throw new Error('无法创建词条上下文');
  const selectedCollection = state.collectionById.get(collectionId);
  if (!selectedCollection) throw new Error('当前词表不存在');
  const domain = state.domainById.get(entry.domainId);
  if (!domain) throw new Error('当前词域不存在');
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
      warning: '存在跨词域同形条目；当前查询只针对本 Entry。',
      domains: [...new Set(sameText.map((candidate) => state.domainById.get(candidate.domainId)?.name || candidate.domainId))].slice(0, 8),
    } : null,
  };
}

export function buildOxfordLookupUrl(text) {
  const query = clean(text);
  if (!query) throw new Error('没有可查询的英文');
  return `${OXFORD_LOOKUP_SCHEME}?q=${encodeURIComponent(query)}`;
}
