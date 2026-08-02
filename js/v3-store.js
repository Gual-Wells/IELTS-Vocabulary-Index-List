import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, cleanStudyStampReferences, createCollection, createDomain, createEntry,
  createMembership, createStudyStamp, globalStudyStampKey, isPhraseText, normalizeDisplayText, normalizeEnglish, normalizeGlossHant,
  safeId, searchBackup, systemPhraseCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, tokenizeEnglish,
} from './v3-model.js';
import {
  commitChanges, exportBackup, getSetting, initializeDatabase, readSnapshot, redo as dbRedo,
  replaceWithBackup, replaceWithCanonicalSeed, setLastPositionSetting, setSettings, undo as dbUndo,
} from './v3-db.js';

const listeners = new Set();
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('gual-vocabulary-index-v3') : null;
const instanceId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
let state = null;
let reloadPromise = null;

function clone(value) {
  return structuredClone(value);
}

function backupFromState() {
  if (!state) throw new Error('Store 尚未初始化');
  return {
    schemaVersion: 4,
    appVersion: '3.3.1',
    exportedAt: new Date().toISOString(),
    domains: clone(state.domains),
    collections: clone(state.collections),
    entries: clone(state.entries),
    memberships: clone(state.memberships),
    phraseTokens: clone(state.phraseTokens),
    pins: clone(state.pins),
    annotations: clone(state.annotations),
    studyStamps: clone(state.studyStamps),
    settings: clone(state.settings),
  };
}

function buildState(snapshot) {
  const backup = canonicalizeBackup({ schemaVersion: 4, appVersion: '3.3.1', exportedAt: new Date().toISOString(), ...snapshot });
  const domains = backup.domains.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const collections = backup.collections.sort((a, b) => {
    if (a.domainId !== b.domainId) return a.domainId.localeCompare(b.domainId);
    return a.order - b.order || a.name.localeCompare(b.name);
  });
  const projection = buildProjection(backup);
  const visibleEntryIdsByCollection = new Map([...projection.entries()].map(([collectionId, entries]) => [collectionId, new Set(entries.map((entry) => entry.id))]));
  const entryById = new Map(backup.entries.map((item) => [item.id, item]));
  const globalPhraseByNormalizedText = new Map((projection.get(SYSTEM_GLOBAL_PHRASES_ID) || []).map((item) => [item.normalizedText, item]));
  const wordsByDomainText = new Map();
  const wordsByNormalizedText = new Map();
  const phrasesByNormalizedText = new Map();
  for (const entry of backup.entries) {
    if (entry.kind === 'phrase') {
      const phrases = phrasesByNormalizedText.get(entry.normalizedText) || [];
      phrases.push(entry);
      phrasesByNormalizedText.set(entry.normalizedText, phrases);
      continue;
    }
    wordsByDomainText.set(`${entry.domainId}:${entry.normalizedText}`, entry);
    const list = wordsByNormalizedText.get(entry.normalizedText) || [];
    list.push(entry);
    wordsByNormalizedText.set(entry.normalizedText, list);
  }
  const phraseTokensByPhrase = groupBy(backup.phraseTokens, (item) => item.phraseId);
  const phrasesByDomainToken = new Map();
  for (const token of backup.phraseTokens) {
    const phrase = entryById.get(token.phraseId);
    if (!phrase) continue;
    const key = `${token.domainId}:${token.normalizedToken}`;
    const list = phrasesByDomainToken.get(key) || [];
    if (!list.some((item) => item.id === phrase.id)) list.push(phrase);
    phrasesByDomainToken.set(key, list);
  }
  const relatedPhrasesByEntry = new Map();
  for (const entry of backup.entries) {
    if (entry.kind !== 'word') continue;
    const list = [...(phrasesByDomainToken.get(`${entry.domainId}:${entry.normalizedText}`) || [])]
      .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
    relatedPhrasesByEntry.set(entry.id, list);
  }
  const phraseComponentsByEntry = new Map();
  for (const entry of backup.entries) {
    if (entry.kind !== 'phrase') continue;
    const tokens = [...(phraseTokensByPhrase.get(entry.id) || [])].sort((a, b) => a.tokenIndex - b.tokenIndex);
    phraseComponentsByEntry.set(entry.id, tokens.map((token) => ({
      ...token,
      entry: wordsByDomainText.get(`${entry.domainId}:${token.normalizedToken}`) || null,
    })));
  }
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  collectionById.set(SYSTEM_GLOBAL_WORDS_ID, { id: SYSTEM_GLOBAL_WORDS_ID, domainId: '', name: '全局词汇总表', label: '', type: 'system-global-words', order: -2, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  collectionById.set(SYSTEM_GLOBAL_PHRASES_ID, { id: SYSTEM_GLOBAL_PHRASES_ID, domainId: '', name: '全局短语总表', label: '', type: 'system-global-phrases', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  for (const domain of domains) {
    collectionById.set(systemDomainWordsCollectionId(domain.id), { id: systemDomainWordsCollectionId(domain.id), domainId: domain.id, name: '词汇总表', label: '', type: 'system-domain-words', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  }
  return {
    ...backup,
    domains,
    collections,
    projection,
    visibleEntryIdsByCollection,
    revision: Number(snapshot.settings?.dataRevision || 0),
    domainById: new Map(domains.map((item) => [item.id, item])),
    collectionById,
    entryById,
    wordsByNormalizedText,
    phrasesByNormalizedText,
    globalPhraseByNormalizedText,
    relatedPhrasesByEntry,
    phraseComponentsByEntry,
    membershipsByEntry: groupBy(backup.memberships, (item) => item.entryId),
    membershipsByCollection: groupBy(backup.memberships, (item) => item.collectionId),
    pinByEntry: new Map(backup.pins.map((item) => [item.entryId, item])),
    annotationByEntry: new Map(backup.annotations.map((item) => [item.entryId, item])),
    studyStampByKey: new Map(backup.studyStamps.map((item) => [item.key, item])),
  };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) || [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function emit(type, detail = null) {
  for (const listener of listeners) listener({ type, detail, state });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  if (!state) throw new Error('Store 尚未初始化');
  return state;
}

export async function reloadStore(type = 'reload') {
  if (reloadPromise) return reloadPromise;
  reloadPromise = (async () => {
    const snapshot = await readSnapshot();
    state = buildState(snapshot);
    emit(type);
    return state;
  })().finally(() => { reloadPromise = null; });
  return reloadPromise;
}

export async function initializeStore() {
  const migration = await initializeDatabase();
  await reloadStore('initialize');
  if (channel) {
    channel.onmessage = async (event) => {
      if (event.data?.instanceId === instanceId) return;
      if (Number(event.data?.revision || 0) <= Number(state?.revision || 0)) return;
      await reloadStore('external-change');
    };
  }
  return migration;
}

function broadcast(revision) {
  channel?.postMessage({ instanceId, revision });
}

function mapById(items, key = 'id') {
  return new Map(items.map((item) => [item[key], item]));
}

function removeEntryStudyReferences(draft, entry) {
  if (!entry) return;
  const remainingAggregate = draft.entries.some((item) => item.id !== entry.id
    && item.kind === entry.kind && item.normalizedText === entry.normalizedText);
  const globalKey = globalStudyStampKey(entry.kind, entry.normalizedText);
  draft.studyStamps = draft.studyStamps.filter((item) => {
    if (item.scope === 'entry') return item.entryId !== entry.id;
    if (item.scope === 'global' && item.key === globalKey) return remainingAggregate;
    return true;
  });
}

function migrateGlobalStudyStampOnRename(draft, beforeEntry, afterEntry) {
  if (!beforeEntry || !afterEntry || beforeEntry.normalizedText === afterEntry.normalizedText) return;
  const oldKey = globalStudyStampKey(beforeEntry.kind, beforeEntry.normalizedText);
  const oldStamp = draft.studyStamps.find((item) => item.key === oldKey);
  if (!oldStamp) return;
  const oldAggregateStillExists = draft.entries.some((item) => item.id !== beforeEntry.id
    && item.kind === beforeEntry.kind && item.normalizedText === beforeEntry.normalizedText);
  if (oldAggregateStillExists) return;
  const newKey = globalStudyStampKey(afterEntry.kind, afterEntry.normalizedText);
  const existingNew = draft.studyStamps.find((item) => item.key === newKey);
  draft.studyStamps = draft.studyStamps.filter((item) => item.key !== oldKey);
  if (!existingNew) {
    draft.studyStamps.push({
      ...oldStamp,
      key: newKey,
      kind: afterEntry.kind,
      normalizedText: afterEntry.normalizedText,
      reviewedAt: new Date().toISOString(),
      revision: Number(oldStamp.revision || 0) + 1,
    });
  }
}

function jsonEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function sourceLabelParts(value) {
  return normalizeDisplayText(value)
    .split(/\s*(?:,|\/|;|，|、)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeSourceLabels(...values) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    for (const part of sourceLabelParts(value)) {
      const key = part.toLocaleLowerCase('en');
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(part);
    }
  }
  return result.join(', ');
}

function diffArray(store, beforeItems, afterItems, key = 'id') {
  const before = mapById(beforeItems, key);
  const after = mapById(afterItems, key);
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changes = [];
  for (const id of keys) {
    const left = before.get(id) ?? null;
    const right = after.get(id) ?? null;
    if (!jsonEqual(left, right)) changes.push({ store, key: id, before: left, after: right });
  }
  return changes;
}

function diffSettings(before, after) {
  const ignored = new Set(['dataRevision', 'historyPointer', 'historySequence', 'schemaVersion', 'appVersion', 'initialized']);
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];
  for (const key of keys) {
    if (ignored.has(key)) continue;
    const left = Object.prototype.hasOwnProperty.call(before || {}, key) ? { key, value: clone(before[key]) } : null;
    const right = Object.prototype.hasOwnProperty.call(after || {}, key) ? { key, value: clone(after[key]) } : null;
    if (!jsonEqual(left, right)) changes.push({ store: 'settings', key, before: left, after: right });
  }
  return changes;
}

function diffBackup(before, after) {
  return [
    ...diffArray('domains', before.domains, after.domains),
    ...diffArray('collections', before.collections, after.collections),
    ...diffArray('entries', before.entries, after.entries),
    ...diffArray('memberships', before.memberships, after.memberships),
    ...diffArray('phraseTokens', before.phraseTokens, after.phraseTokens),
    ...diffArray('pins', before.pins, after.pins),
    ...diffArray('annotations', before.annotations, after.annotations, 'entryId'),
    ...diffArray('studyStamps', before.studyStamps, after.studyStamps, 'key'),
    ...diffSettings(before.settings, after.settings),
  ];
}

function normalizeSoftReferences(backup) {
  const projection = buildProjection(backup);
  const entryById = mapById(backup.entries);
  const collectionById = mapById(backup.collections);
  backup.pins = backup.pins.flatMap((pin) => {
    let entry = entryById.get(pin.entryId);
    if (!entry) return [];
    let collectionId = pin.contextCollectionId;
    if (!(projection.get(collectionId) || []).some((item) => item.id === entry.id)) {
      if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) {
        const representative = (projection.get(collectionId) || [])
          .find((item) => item.kind === entry.kind && item.normalizedText === entry.normalizedText);
        if (representative) entry = representative;
      }
      if (!(projection.get(collectionId) || []).some((item) => item.id === entry.id)) {
        collectionId = [...projection.entries()].find(([id, list]) => {
          const collection = collectionById.get(id);
          return collection?.domainId === entry.domainId && list.some((item) => item.id === entry.id);
        })?.[0] || '';
      }
    }
    if (!collectionId) return [];
    return [{ ...pin, id: safeId('pin', entry.id), entryId: entry.id, domainId: entry.domainId, contextCollectionId: collectionId }];
  });

  const lastPositions = { ...(backup.settings?.lastPositions || {}) };
  for (const [key, entryId] of Object.entries(lastPositions)) {
    const parts = key.split(':');
    const collectionId = parts.length >= 5 ? parts.slice(2, -2).join(':') : parts.slice(2).join(':');
    if ((projection.get(collectionId) || []).some((item) => item.id === entryId)) continue;
    const oldEntry = entryById.get(entryId);
    if (oldEntry && [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) {
      const representative = (projection.get(collectionId) || [])
        .find((item) => item.kind === oldEntry.kind && item.normalizedText === oldEntry.normalizedText);
      if (representative) {
        lastPositions[key] = representative.id;
        continue;
      }
    }
    delete lastPositions[key];
  }
  const validCollectionIds = new Set(projection.keys());
  const viewModes = Object.fromEntries(Object.entries(backup.settings?.viewModes || {})
    .filter(([collectionId]) => validCollectionIds.has(collectionId)));
  const calendarMonths = Object.fromEntries(Object.entries(backup.settings?.calendarMonths || {})
    .filter(([key]) => validCollectionIds.has(key.slice(0, key.lastIndexOf(':')))));
  backup.settings = { ...backup.settings, lastPositions, viewModes, calendarMonths };
  cleanStudyStampReferences(backup);
  return backup;
}

async function mutate(label, mutator, retry = true) {
  const before = backupFromState();
  const draft = clone(before);
  await mutator(draft);
  draft.phraseTokens = draft.entries.flatMap(buildPhraseTokens);
  normalizeSoftReferences(draft);
  const after = canonicalizeBackup(draft);
  const changes = diffBackup(before, after);
  if (!changes.length) return state;
  try {
    const revision = await commitChanges(changes, { label, expectedRevision: state.revision });
    await reloadStore('mutation');
    broadcast(revision);
    return state;
  } catch (error) {
    if (retry && String(error?.message || error).includes('另一实例')) {
      await reloadStore('sync');
      return mutate(label, mutator, false);
    }
    throw error;
  }
}

function nextOrder(items) {
  return items.length ? Math.max(...items.map((item) => Number(item.order || 0))) + 1 : 0;
}

export async function addDomain(name, { glossEnabled = false } = {}) {
  return mutate('新增词域', (draft) => {
    const normalized = normalizeEnglish(name);
    if (draft.domains.some((item) => normalizeEnglish(item.name) === normalized)) throw new Error('词域名称已存在');
    const domain = createDomain({ name, glossEnabled, order: nextOrder(draft.domains) });
    draft.domains.push(domain);
    draft.collections.push(createCollection({
      domainId: domain.id, name: '短语总表', type: 'system-phrases', order: Number.MAX_SAFE_INTEGER,
    }));
  });
}

export async function renameDomain(domainId, name) {
  return mutate('重命名词域', (draft) => {
    const domain = draft.domains.find((item) => item.id === domainId);
    if (!domain) throw new Error('词域不存在');
    const normalized = normalizeEnglish(name);
    if (!normalized) throw new Error('词域名称不能为空');
    if (draft.domains.some((item) => item.id !== domainId && normalizeEnglish(item.name) === normalized)) throw new Error('词域名称已存在');
    const updated = createDomain({ ...domain, name, updatedAt: new Date().toISOString() });
    Object.assign(domain, updated);
  });
}

export async function setDomainGlossEnabled(domainId, enabled) {
  return mutate(enabled ? '启用繁体释义' : '关闭繁体释义', (draft) => {
    const domain = draft.domains.find((item) => item.id === domainId);
    if (!domain) throw new Error('词域不存在');
    domain.glossEnabled = Boolean(enabled);
    domain.updatedAt = new Date().toISOString();
  });
}

export async function addCollection(domainId, name, label = '') {
  return mutate('新增词表', (draft) => {
    const domain = draft.domains.find((item) => item.id === domainId);
    if (!domain) throw new Error('词域不存在');
    const normalized = normalizeEnglish(name);
    const siblings = draft.collections.filter((item) => item.domainId === domainId);
    if (siblings.some((item) => normalizeEnglish(item.name) === normalized)) throw new Error('该词域已有同名词表');
    draft.collections.push(createCollection({ domainId, name, label, order: nextOrder(siblings) }));
  });
}

export async function renameCollection(collectionId, name, label = '') {
  return mutate('重命名词表', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    if (collection.type === 'system-phrases') throw new Error('系统短语表不可重命名');
    const normalized = normalizeEnglish(name);
    if (draft.collections.some((item) => item.id !== collectionId && item.domainId === collection.domainId && normalizeEnglish(item.name) === normalized)) {
      throw new Error('该词域已有同名词表');
    }
    const updated = createCollection({ ...collection, name, label, updatedAt: new Date().toISOString() });
    Object.assign(collection, updated);
  });
}

export async function moveCollection(collectionId, direction) {
  return mutate('调整词表优先级', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection || collection.type !== 'normal') throw new Error('普通词表不存在');
    const siblings = draft.collections.filter((item) => item.domainId === collection.domainId && item.type === 'normal')
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((item) => item.id === collectionId);
    const targetIndex = index + (direction < 0 ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= siblings.length) return;
    const target = siblings[targetIndex];
    const oldOrder = collection.order;
    collection.order = target.order;
    target.order = oldOrder;
    collection.updatedAt = target.updatedAt = new Date().toISOString();
  });
}


export async function reorderCollections(domainId, orderedIds) {
  return mutate('调整词表顺序', (draft) => {
    const siblings = draft.collections.filter((item) => item.domainId === domainId && item.type === 'normal' && !item.hidden);
    const expected = new Set(siblings.map((item) => item.id));
    const order = [...orderedIds].filter((id) => expected.has(id));
    for (const item of siblings) if (!order.includes(item.id)) order.push(item.id);
    const now = new Date().toISOString();
    order.forEach((id, index) => {
      const collection = siblings.find((item) => item.id === id);
      if (!collection) return;
      collection.order = index;
      collection.updatedAt = now;
    });
  });
}

export async function reorderDomains(orderedIds) {
  return mutate('调整词域顺序', (draft) => {
    const expected = new Set(draft.domains.map((item) => item.id));
    const order = [...orderedIds].filter((id) => expected.has(id));
    for (const item of draft.domains) if (!order.includes(item.id)) order.push(item.id);
    const now = new Date().toISOString();
    order.forEach((id, index) => {
      const domain = draft.domains.find((item) => item.id === id);
      if (!domain) return;
      domain.order = index;
      domain.updatedAt = now;
    });
  });
}

export async function deleteCollection(collectionId) {
  return mutate('删除词表', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    if (collection.type === 'system-phrases') throw new Error('系统短语表不可删除');
    draft.collections = draft.collections.filter((item) => item.id !== collectionId);
    const affectedEntryIds = new Set(draft.memberships.filter((item) => item.collectionId === collectionId).map((item) => item.entryId));
    draft.memberships = draft.memberships.filter((item) => item.collectionId !== collectionId);
    for (const entryId of affectedEntryIds) removeOrphanWord(draft, entryId);
  });
}

function removeOrphanWord(draft, entryId) {
  const entry = draft.entries.find((item) => item.id === entryId);
  if (!entry || entry.kind === 'phrase') return;
  const collectionById = mapById(draft.collections);
  const hasNormal = draft.memberships.some((item) => item.entryId === entryId && collectionById.get(item.collectionId)?.type === 'normal');
  if (hasNormal) return;
  draft.entries = draft.entries.filter((item) => item.id !== entryId);
  draft.memberships = draft.memberships.filter((item) => item.entryId !== entryId);
  draft.pins = draft.pins.filter((item) => item.entryId !== entryId);
  draft.annotations = draft.annotations.filter((item) => item.entryId !== entryId);
  removeEntryStudyReferences(draft, entry);
}

export async function deleteDomain(domainId) {
  return mutate('删除词域', (draft) => {
    if (domainId === 'domain_general_english') throw new Error('默认通用英语词域不可删除');
    if (!draft.domains.some((item) => item.id === domainId)) throw new Error('词域不存在');
    const collectionIds = new Set(draft.collections.filter((item) => item.domainId === domainId).map((item) => item.id));
    const entryIds = new Set(draft.entries.filter((item) => item.domainId === domainId).map((item) => item.id));
    draft.domains = draft.domains.filter((item) => item.id !== domainId);
    draft.collections = draft.collections.filter((item) => !collectionIds.has(item.id));
    draft.entries = draft.entries.filter((item) => !entryIds.has(item.id));
    draft.memberships = draft.memberships.filter((item) => !entryIds.has(item.entryId));
    draft.pins = draft.pins.filter((item) => !entryIds.has(item.entryId));
    draft.annotations = draft.annotations.filter((item) => !entryIds.has(item.entryId));
    draft.studyStamps = draft.studyStamps.filter((item) => item.scope !== 'entry' || !entryIds.has(item.entryId));
    cleanStudyStampReferences(draft);
  });
}

function upsertEntryInDraft(draft, collection, item, sourceOrder) {
  const domain = draft.domains.find((candidate) => candidate.id === collection.domainId);
  const text = normalizeDisplayText(item?.text || item?.word || '');
  const normalized = normalizeEnglish(text);
  if (!normalized) return null;
  if (collection.type === 'system-phrases' && !isPhraseText(text)) throw new Error(`系统短语表不能导入普通词：${text}`);
  let entry = draft.entries.find((candidate) => candidate.domainId === collection.domainId && candidate.normalizedText === normalized);
  if (!entry) {
    entry = createEntry({
      domainId: collection.domainId,
      text,
      glossHant: domain?.glossEnabled ? normalizeGlossHant(item?.glossHant || item?.gloss || '') : '',
      glossSource: item?.glossSource || 'import',
    });
    draft.entries.push(entry);
  } else if (domain?.glossEnabled && (item?.glossHant || item?.gloss)) {
    entry.glossHant = normalizeGlossHant(item.glossHant || item.gloss);
    entry.glossSource = normalizeDisplayText(item?.glossSource || 'import');
    entry.updatedAt = new Date().toISOString();
  }
  if (collection.type === 'normal') {
    let membership = draft.memberships.find((candidate) => candidate.entryId === entry.id && candidate.collectionId === collection.id);
    if (!membership) {
      membership = createMembership({
        entryId: entry.id,
        collectionId: collection.id,
        sourceLabel: item?.sourceLabel || item?.pos || '',
        sourceOrder,
      });
      draft.memberships.push(membership);
    } else {
      const nextLabel = normalizeDisplayText(item?.sourceLabel || item?.pos || '');
      const updated = createMembership({
        ...membership,
        sourceLabel: mergeSourceLabels(membership.sourceLabel, nextLabel),
        sourceOrder,
        updatedAt: new Date().toISOString(),
      });
      Object.assign(membership, updated);
    }
  }
  return entry;
}

export async function importEntries(collectionId, items, { mode = 'merge' } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('没有可导入内容');
  return mutate(mode === 'replace' ? '替换词表导入' : '合并词表导入', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    if (mode === 'replace') {
      if (collection.type === 'normal') {
        const affected = new Set(draft.memberships.filter((item) => item.collectionId === collectionId).map((item) => item.entryId));
        draft.memberships = draft.memberships.filter((item) => item.collectionId !== collectionId);
        for (const entryId of affected) removeOrphanWord(draft, entryId);
      } else {
        const imported = new Set(items.map((item) => normalizeEnglish(item?.text || item?.word || '')).filter(Boolean));
        const sourcedPhraseIds = new Set(draft.memberships.map((item) => item.entryId));
        // The system phrase collection is a derived view of every phrase in the domain.
        // Replace mode may remove only system-only phrases; phrases still sourced by a normal
        // collection must remain visible and must never lose their Membership records.
        const removed = new Set(draft.entries
          .filter((item) => item.domainId === collection.domainId && item.kind === 'phrase'
            && !sourcedPhraseIds.has(item.id) && !imported.has(item.normalizedText))
          .map((item) => item.id));
        draft.entries = draft.entries.filter((item) => !removed.has(item.id));
        draft.pins = draft.pins.filter((item) => !removed.has(item.entryId));
        draft.annotations = draft.annotations.filter((item) => !removed.has(item.entryId));
        draft.studyStamps = draft.studyStamps.filter((item) => item.scope !== 'entry' || !removed.has(item.entryId));
        cleanStudyStampReferences(draft);
      }
    }
    const mergedItems = new Map();
    for (const item of items) {
      const normalized = normalizeEnglish(item?.text || item?.word || '');
      if (!normalized) continue;
      const previous = mergedItems.get(normalized);
      if (!previous) {
        mergedItems.set(normalized, { ...item, sourceLabel: item?.sourceLabel || item?.pos || '' });
        continue;
      }
      mergedItems.set(normalized, {
        ...previous,
        sourceLabel: mergeSourceLabels(previous?.sourceLabel || previous?.pos || '', item?.sourceLabel || item?.pos || ''),
        gloss: previous?.gloss || previous?.glossHant || item?.gloss || item?.glossHant || '',
      });
    }
    [...mergedItems.values()].forEach((item, index) => upsertEntryInDraft(draft, collection, item, index));
  });
}

export async function addEntry(collectionId, text, { sourceLabel = '', gloss = '', glossSource = 'manual' } = {}) {
  let resultingId = null;
  await mutate('新增内容', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    const domain = draft.domains.find((item) => item.id === collection.domainId);
    const normalized = normalizeEnglish(text);
    if (!normalized) throw new Error('内容不能为空');
    if (collection.type === 'system-phrases' && !isPhraseText(text)) {
      throw new Error('短语表只能新增短语');
    }
    let entry = draft.entries.find((item) => item.domainId === collection.domainId && item.normalizedText === normalized);
    if (!entry) {
      entry = createEntry({
        domainId: collection.domainId,
        text,
        glossHant: domain?.glossEnabled ? normalizeGlossHant(gloss) : '',
        glossSource,
      });
      draft.entries.push(entry);
    } else if (domain?.glossEnabled && gloss && !entry.glossHant) {
      entry.glossHant = normalizeGlossHant(gloss);
      entry.glossSource = normalizeDisplayText(glossSource || 'manual');
      entry.updatedAt = new Date().toISOString();
    }
    resultingId = entry.id;
    if (collection.type === 'normal') {
      const existing = draft.memberships.find((item) => item.entryId === entry.id && item.collectionId === collection.id);
      if (!existing) {
        const sourceOrder = nextOrder(draft.memberships.filter((item) => item.collectionId === collection.id));
        draft.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceLabel, sourceOrder }));
      } else if (sourceLabel) {
        existing.sourceLabel = mergeSourceLabels(existing.sourceLabel, sourceLabel);
        existing.updatedAt = new Date().toISOString();
      }
    }
  });
  return getState().entryById.get(resultingId);
}

export async function addPhraseForWord(entryId, phraseText, options = {}, collectionId = '') {
  const current = getState();
  const word = current.entryById.get(entryId);
  if (!word || word.kind !== 'word') throw new Error('目标普通词不存在');
  const containsWord = tokenizeEnglish(phraseText).some((token) => normalizeEnglish(token) === word.normalizedText);
  if (!containsWord) throw new Error('短语必须包含当前词的精确词元');
  const collection = current.collectionById.get(collectionId);
  const targetCollectionId = collection?.type === 'normal' && collection.domainId === word.domainId
    ? collection.id
    : systemPhraseCollectionId(word.domainId);
  return addEntry(targetCollectionId, phraseText, options);
}

export async function editEntry(entryId, updates, expectedUpdatedAt) {
  return mutate('编辑内容', (draft) => {
    const entry = draft.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error('内容不存在');
    if (expectedUpdatedAt && entry.updatedAt !== expectedUpdatedAt) throw new Error('内容已在其他实例更新，请重新打开后再编辑');
    const domain = draft.domains.find((item) => item.id === entry.domainId);
    const nextGloss = domain?.glossEnabled ? normalizeGlossHant(updates.gloss ?? entry.glossHant) : entry.glossHant;
    const candidate = createEntry({
      ...entry,
      text: updates.text ?? entry.text,
      glossHant: nextGloss,
      glossSource: nextGloss ? normalizeDisplayText(updates.glossSource || entry.glossSource || 'manual') : '',
      updatedAt: new Date().toISOString(),
    });
    const collision = draft.entries.find((item) => item.id !== entry.id && item.domainId === entry.domainId && item.normalizedText === candidate.normalizedText);
    if (collision) throw new Error('同一词域内已有该内容');
    const textChanged = candidate.normalizedText !== entry.normalizedText;
    if (candidate.kind === 'word' && !draft.memberships.some((item) => item.entryId === entry.id)) {
      throw new Error('系统短语不能直接改成普通词；请先在普通词表中新增该词。');
    }
    const beforeEntry = { ...entry };
    Object.assign(entry, candidate);
    if (textChanged) migrateGlobalStudyStampOnRename(draft, beforeEntry, entry);
    if (textChanged) draft.annotations = draft.annotations.filter((item) => item.entryId !== entry.id);
    if (entry.kind === 'word') removeOrphanWord(draft, entry.id);
  });
}

export async function editEntryInCollection(entryId, collectionId, updates, expectedUpdatedAt) {
  return mutate('编辑内容与词性', (draft) => {
    const entry = draft.entries.find((item) => item.id === entryId);
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!entry || !collection) throw new Error('内容或词表不存在');
    if (entry.domainId !== collection.domainId) throw new Error('内容与词表不属于同一词域');
    if (expectedUpdatedAt && entry.updatedAt !== expectedUpdatedAt) throw new Error('内容已在其他实例更新，请重新打开后再编辑');
    const domain = draft.domains.find((item) => item.id === entry.domainId);
    const nextGloss = domain?.glossEnabled ? normalizeGlossHant(updates.gloss ?? entry.glossHant) : entry.glossHant;
    const candidate = createEntry({
      ...entry,
      text: updates.text ?? entry.text,
      glossHant: nextGloss,
      glossSource: nextGloss ? normalizeDisplayText(updates.glossSource || entry.glossSource || 'manual') : '',
      updatedAt: new Date().toISOString(),
    });
    const collision = draft.entries.find((item) => item.id !== entry.id && item.domainId === entry.domainId && item.normalizedText === candidate.normalizedText);
    if (collision) throw new Error('同一词域内已有该内容');
    const textChanged = candidate.normalizedText !== entry.normalizedText;
    const beforeEntry = { ...entry };
    Object.assign(entry, candidate);
    if (textChanged) migrateGlobalStudyStampOnRename(draft, beforeEntry, entry);
    if (textChanged) draft.annotations = draft.annotations.filter((item) => item.entryId !== entry.id);
    if (collection.type === 'normal') {
      const membership = draft.memberships.find((item) => item.entryId === entryId && item.collectionId === collectionId);
      if (!membership) throw new Error('当前词表没有该内容的来源关系');
      membership.sourceLabel = normalizeDisplayText(updates.sourceLabel ?? membership.sourceLabel);
      membership.updatedAt = new Date().toISOString();
    }
    if (entry.kind === 'word') removeOrphanWord(draft, entry.id);
  });
}

export async function removeEntryFromCollection(entryId, collectionId) {
  return mutate('移除词表来源', (draft) => {
    const membership = draft.memberships.find((item) => item.entryId === entryId && item.collectionId === collectionId);
    if (!membership) return;
    draft.memberships = draft.memberships.filter((item) => item.id !== membership.id);
    removeOrphanWord(draft, entryId);
  });
}

export async function deleteEntry(entryId) {
  return mutate('删除内容', (draft) => {
    const entry = draft.entries.find((item) => item.id === entryId);
    draft.entries = draft.entries.filter((item) => item.id !== entryId);
    draft.memberships = draft.memberships.filter((item) => item.entryId !== entryId);
    draft.pins = draft.pins.filter((item) => item.entryId !== entryId);
    draft.annotations = draft.annotations.filter((item) => item.entryId !== entryId);
    removeEntryStudyReferences(draft, entry);
  });
}

export async function togglePin(entryId, contextCollectionId, retry = true) {
  const existing = state.pinByEntry.get(entryId) || null;
  const entry = state.entryById.get(entryId);
  if (!entry) throw new Error('内容不存在');
  if (!state.visibleEntryIdsByCollection.get(contextCollectionId)?.has(entryId)) throw new Error('PIN 上下文不可见');
  let after = null;
  if (!existing || existing.contextCollectionId !== contextCollectionId) {
    const siblingPins = state.pins.filter((item) => item.contextCollectionId === contextCollectionId);
    after = {
      id: existing?.id || safeId('pin', entryId), entryId, domainId: entry.domainId, contextCollectionId,
      order: siblingPins.length ? Math.max(...siblingPins.map((item) => Number(item.order || 0))) + 1 : 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
  }
  const key = existing?.id || after.id;
  try {
    const revision = await commitChanges([{ store: 'pins', key, before: existing ? clone(existing) : null, after: after ? clone(after) : null }], {
      label: '切换 PIN', expectedRevision: state.revision,
    });
    state.pins = existing
      ? (after ? state.pins.map((item) => item.entryId === entryId ? after : item) : state.pins.filter((item) => item.entryId !== entryId))
      : [...state.pins, after];
    state.pinByEntry = new Map(state.pins.map((item) => [item.entryId, item]));
    state.revision = revision;
    state.settings.dataRevision = revision;
    emit('mutation', { kind: 'pin', entryId, contextCollectionId, moved: Boolean(existing && after) });
    broadcast(revision);
    return state;
  } catch (error) {
    if (retry && String(error?.message || error).includes('另一实例')) {
      await reloadStore('sync');
      return togglePin(entryId, contextCollectionId, false);
    }
    throw error;
  }
}

export async function setLastPosition(domainId, collectionId, entryId, { mode = 'alphabet', section = 'main' } = {}) {
  if (!state.visibleEntryIdsByCollection.get(collectionId)?.has(entryId)) return false;
  const key = `lastPosition:${domainId}:${collectionId}:${mode}:${section}`;
  const next = await setLastPositionSetting(key, entryId);
  state.settings.lastPositions = next;
  return true;
}

export function getLastPosition(domainId, collectionId, { mode = 'alphabet', section = 'main' } = {}) {
  const positions = state.settings.lastPositions || {};
  const key = `lastPosition:${domainId}:${collectionId}:${mode}:${section}`;
  const legacyKey = `lastPosition:${domainId}:${collectionId}`;
  const entryId = positions[key] || (mode === 'alphabet' && section === 'main' ? positions[legacyKey] : null) || null;
  if (!entryId) return null;
  const entry = state.entryById.get(entryId);
  if (!entry || !state.visibleEntryIdsByCollection.get(collectionId)?.has(entryId)) return null;
  if (section === 'word' && entry.kind !== 'word') return null;
  if (section === 'phrase' && entry.kind !== 'phrase') return null;
  return entryId;
}

export function getViewMode(collectionId) {
  return state.settings.viewModes?.[collectionId] === 'date' ? 'date' : 'alphabet';
}

export async function setViewMode(collectionId, mode) {
  if (!['alphabet', 'date'].includes(mode)) throw new Error('无效浏览模式');
  const next = { ...(state.settings.viewModes || {}), [collectionId]: mode };
  await setSettings({ viewModes: next });
  state.settings.viewModes = next;
  emit('view-mode', { collectionId, mode });
  return mode;
}

export function getCalendarMonth(collectionId, section = 'main') {
  const key = `${collectionId}:${section}`;
  return state.settings.calendarMonths?.[key] || '';
}

export async function setCalendarMonth(collectionId, section, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error('日历月份无效');
  const key = `${collectionId}:${section}`;
  const next = { ...(state.settings.calendarMonths || {}), [key]: month };
  await setSettings({ calendarMonths: next });
  state.settings.calendarMonths = next;
  emit('calendar-month', { collectionId, section, month });
  return month;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function studyStampKeyFor(entry, collectionId) {
  if (!entry) return '';
  if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) return `global:${entry.kind}:${entry.normalizedText}`;
  return `entry:${entry.id}`;
}

export function getStudyStamp(entry, collectionId) {
  return state.studyStampByKey.get(studyStampKeyFor(entry, collectionId)) || null;
}

export async function refreshStudyDate(entryId, collectionId, retry = true) {
  const entry = state.entryById.get(entryId);
  if (!entry || !state.visibleEntryIdsByCollection.get(collectionId)?.has(entryId)) throw new Error('内容不可见');
  const key = studyStampKeyFor(entry, collectionId);
  const existing = state.studyStampByKey.get(key) || null;
  const scope = key.startsWith('global:') ? 'global' : 'entry';
  const after = createStudyStamp({
    key,
    scope,
    entryId: scope === 'entry' ? entry.id : '',
    kind: scope === 'global' ? entry.kind : '',
    normalizedText: scope === 'global' ? entry.normalizedText : '',
    reviewDateKey: localDateKey(),
    reviewedAt: new Date().toISOString(),
    revision: Number(existing?.revision || 0) + 1,
  });
  try {
    const revision = await commitChanges([{ store: 'studyStamps', key, before: existing ? clone(existing) : null, after: clone(after) }], {
      label: '刷新学习日期', expectedRevision: state.revision,
    });
    state.studyStamps = existing
      ? state.studyStamps.map((item) => item.key === key ? after : item)
      : [...state.studyStamps, after];
    state.studyStampByKey.set(key, after);
    state.revision = revision;
    state.settings.dataRevision = revision;
    emit('mutation', { kind: 'study-date', entryId, collectionId, key });
    broadcast(revision);
    return after;
  } catch (error) {
    if (retry && String(error?.message || error).includes('另一实例')) {
      await reloadStore('sync');
      return refreshStudyDate(entryId, collectionId, false);
    }
    throw error;
  }
}

export function getPinsForCollection(collectionId) {
  const visibleIds = state.visibleEntryIdsByCollection.get(collectionId) || new Set();
  return state.pins
    .filter((item) => item.contextCollectionId === collectionId && visibleIds.has(item.entryId))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0)
      || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      || a.entryId.localeCompare(b.entryId));
}

export async function setNumberMode(mode) {
  if (!['none', 'group', 'global'].includes(mode)) throw new Error('无效序号模式');
  if (state.settings.numberMode === mode) return false;
  const revision = await setSettings({ numberMode: mode }, { expectedRevision: state.revision, bumpRevision: true });
  await reloadStore('settings');
  broadcast(revision);
  return true;
}

async function commitAnnotationSet(nextAnnotations, label, detail = {}, retry = true, expectedRevision = null) {
  if (expectedRevision != null && Number(state.revision) !== Number(expectedRevision)) return state;
  const sanitized = nextAnnotations.filter((item) => {
    const entry = state.entryById.get(item.entryId);
    return entry && entry.domainId === item.domainId;
  });
  const before = new Map(state.annotations.map((item) => [item.entryId, item]));
  const after = new Map(sanitized.map((item) => [item.entryId, item]));
  const ids = new Set([...before.keys(), ...after.keys()]);
  const changes = [];
  for (const entryId of ids) {
    const left = before.get(entryId) || null;
    const right = after.get(entryId) || null;
    if (!jsonEqual(left, right)) changes.push({ store: 'annotations', key: entryId, before: left ? clone(left) : null, after: right ? clone(right) : null });
  }
  if (!changes.length) return state;
  try {
    const revision = await commitChanges(changes, { label, expectedRevision: state.revision });
    state.annotations = [...after.values()].sort((a, b) => a.domainId.localeCompare(b.domainId) || a.entryId.localeCompare(b.entryId));
    state.annotationByEntry = new Map(state.annotations.map((item) => [item.entryId, item]));
    state.revision = revision;
    state.settings.dataRevision = revision;
    emit('annotation-change', { ...detail, entryIds: [...ids] });
    broadcast(revision);
    return state;
  } catch (error) {
    if (retry && String(error?.message || error).includes('另一实例')) {
      await reloadStore('sync');
      if (expectedRevision != null && Number(state.revision) !== Number(expectedRevision)) return state;
      return commitAnnotationSet(nextAnnotations, label, detail, false, expectedRevision);
    }
    throw error;
  }
}

export async function replaceAnnotations(entryIds, annotations, { expectedEntries = [], expectedRevision = null } = {}) {
  const target = new Set(entryIds);
  const expected = new Map(expectedEntries.map((item) => [item.id, item]));
  const retained = state.annotations.filter((item) => !target.has(item.entryId));
  const now = new Date().toISOString();
  const next = [...retained];
  for (const annotation of annotations) {
    const entry = state.entryById.get(annotation.entryId);
    if (!entry || !target.has(entry.id)) continue;
    const snapshot = expected.get(entry.id);
    if (snapshot && (snapshot.updatedAt !== entry.updatedAt || snapshot.normalizedText !== entry.normalizedText)) continue;
    const suggestion = normalizeDisplayText(annotation?.spelling?.suggestion || annotation?.suggestion || '');
    const reason = normalizeDisplayText(annotation?.reason || '');
    if (!suggestion && !reason) continue;
    const existing = state.annotationByEntry.get(entry.id);
    next.push({
      entryId: entry.id,
      domainId: entry.domainId,
      spelling: { incorrect: Boolean(annotation?.spelling?.incorrect ?? suggestion), suggestion },
      reason,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
  }
  return commitAnnotationSet(next, '保存 AI 标注', { kind: 'batch' }, true, expectedRevision);
}

export async function dismissAnnotation(entryId) {
  return commitAnnotationSet(state.annotations.filter((item) => item.entryId !== entryId), '取消 AI 标注', { kind: 'dismiss' });
}

export async function clearAnnotationsForCollection(collectionId) {
  const visibleEntries = state.projection.get(collectionId) || [];
  if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) {
    const visibleKeys = new Set(visibleEntries.map((entry) => `${entry.kind}\u0000${entry.normalizedText}`));
    return commitAnnotationSet(state.annotations.filter((item) => {
      const entry = state.entryById.get(item.entryId);
      return !entry || !visibleKeys.has(`${entry.kind}\u0000${entry.normalizedText}`);
    }), '清空词表 AI 标注', { kind: 'clear-collection', collectionId });
  }
  const visibleIds = state.visibleEntryIdsByCollection.get(collectionId) || new Set();
  return commitAnnotationSet(state.annotations.filter((item) => !visibleIds.has(item.entryId)), '清空词表 AI 标注', { kind: 'clear-collection', collectionId });
}

export async function clearAllAnnotations() {
  return commitAnnotationSet([], '清空全部 AI 标注', { kind: 'clear-all' });
}

export function getVisibleEntries(collectionId) {
  return state.projection.get(collectionId) || [];
}

export function getRelatedPhrases(entryId) {
  return state.relatedPhrasesByEntry.get(entryId) || [];
}

export function getPhraseComponents(phraseId) {
  return state.phraseComponentsByEntry.get(phraseId) || [];
}

export function search(query, options) {
  return searchBackup({ entries: state.entries }, query, options);
}

export async function restoreBackup(input) {
  const revision = await replaceWithBackup(input, { expectedRevision: state.revision });
  await reloadStore('restore');
  broadcast(revision);
}

export async function resetToSeed() {
  const revision = await replaceWithCanonicalSeed({ expectedRevision: state.revision });
  await reloadStore('reset-seed');
  broadcast(revision);
}

export async function exportFullBackup() {
  return exportBackup();
}

export async function undo() {
  const result = await dbUndo(state.revision);
  if (!result) return false;
  await reloadStore('undo');
  broadcast(result.revision);
  return true;
}

export async function redo() {
  const result = await dbRedo(state.revision);
  if (!result) return false;
  await reloadStore('redo');
  broadcast(result.revision);
  return true;
}

export async function acknowledgeMigrationNotice() {
  await setSettings({ migrationNoticePending: false });
  await reloadStore('settings');
}
