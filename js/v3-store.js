import {
  buildRelationComponentsForEntries, buildProjection, canonicalizeBackup, cleanStudyStampReferences, createCollection, createDomain, createEntry,
  createMembership, createStudyStamp, isPhraseText, normalizeDisplayText, normalizeEnglish, normalizeGlossHant,
  relationEdgeSuppressed, safeId, searchBackup, systemPhraseCollectionId, systemDomainWordsCollectionId, systemDomainContentCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID, tokenizeEnglish, uniqueProjectionCount,
} from './v3-model.js';
import {
  commitChanges, exportBackup, getSetting, initializeDatabase, readSnapshot, recordHistoryOnly, redo as dbRedo,
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
    schemaVersion: 6,
    appVersion: '4.2.0',
    exportedAt: new Date().toISOString(),
    domains: clone(state.domains),
    collections: clone(state.collections),
    entries: clone(state.entries),
    memberships: clone(state.memberships),
    relationComponents: clone(state.relationComponents),
    pins: clone(state.pins),
    annotations: clone(state.annotations),
    studyStamps: clone(state.studyStamps),
    settings: clone(state.settings),
  };
}

let lowLevelRelationLexemes = new Set();
let lowLevelLexemeLoadPromise = null;

async function ensureLowLevelLexemes() {
  if (lowLevelLexemeLoadPromise) return lowLevelLexemeLoadPromise;
  lowLevelLexemeLoadPromise = fetch(new URL('../data/relation-low-level-lexemes.json', import.meta.url), { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : [])
    .then((items) => {
      lowLevelRelationLexemes = new Set((Array.isArray(items) ? items : items?.items || [])
        .map((item) => normalizeEnglish(typeof item === 'string' ? item : item?.normalizedText || item?.text || '')).filter(Boolean));
      return lowLevelRelationLexemes;
    })
    .catch(() => lowLevelRelationLexemes);
  return lowLevelLexemeLoadPromise;
}

function buildState(snapshot) {
  const backup = canonicalizeBackup({ schemaVersion: 6, appVersion: '4.2.0', exportedAt: new Date().toISOString(), ...snapshot });
  const domains = backup.domains.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const collections = backup.collections.sort((a, b) => {
    if (a.domainId !== b.domainId) return a.domainId.localeCompare(b.domainId);
    return a.order - b.order || a.name.localeCompare(b.name);
  });
  const projection = buildProjection(backup);
  const visibleEntryIdsByCollection = new Map([...projection.entries()].map(([collectionId, entries]) => [collectionId, new Set(entries.map((entry) => entry.id))]));
  const entryById = new Map(backup.entries.map((item) => [item.id, item]));
  const domainById = new Map(domains.map((item) => [item.id, item]));
  const entriesByNormalizedText = new Map();
  const wordsByNormalizedText = new Map();
  const phrasesByNormalizedText = new Map();
  const contentByNormalizedText = new Map();
  for (const entry of backup.entries) {
    const all = entriesByNormalizedText.get(entry.normalizedText) || [];
    all.push(entry); entriesByNormalizedText.set(entry.normalizedText, all);
    const target = entry.kind === 'word' ? wordsByNormalizedText : entry.kind === 'phrase' ? phrasesByNormalizedText : contentByNormalizedText;
    const list = target.get(entry.normalizedText) || [];
    list.push(entry); target.set(entry.normalizedText, list);
  }

  const rawAdjacency = new Map(backup.entries.map((entry) => [entry.id, new Set()]));
  const componentsByEntry = groupBy(backup.relationComponents, (item) => item.sourceEntryId);
  for (const component of backup.relationComponents) {
    const source = entryById.get(component.sourceEntryId);
    if (!source) continue;
    for (const target of entriesByNormalizedText.get(component.normalizedText) || []) {
      if (target.id === source.id) continue;
      rawAdjacency.get(source.id)?.add(target.id);
      rawAdjacency.get(target.id)?.add(source.id);
    }
  }
  const closeLow = backup.settings.closeLowLevelRelations !== false;
  const effectiveAdjacency = new Map();
  const rawRelationsByEntry = new Map();
  const relatedEntriesByEntry = new Map();
  const edgeSuppressed = (left, right) => relationEdgeSuppressed(left, right, {
    domainById, lowLevelLexemes: lowLevelRelationLexemes, closeLowLevelRelations: closeLow,
  });
  for (const entry of backup.entries) {
    const raw = [...(rawAdjacency.get(entry.id) || [])].map((id) => entryById.get(id)).filter(Boolean)
      .sort((a,b) => a.normalizedText.localeCompare(b.normalizedText,'en') || a.id.localeCompare(b.id));
    rawRelationsByEntry.set(entry.id, raw);
    const effective = raw.filter((target) => !edgeSuppressed(entry, target));
    effectiveAdjacency.set(entry.id, new Set(effective.map((target) => target.id)));
    relatedEntriesByEntry.set(entry.id, effective);
  }

  const collectionById = new Map(collections.map((item) => [item.id, item]));
  collectionById.set(SYSTEM_GLOBAL_WORDS_ID, { id: SYSTEM_GLOBAL_WORDS_ID, domainId: '', name: '全局词汇总表', label: '', type: 'system-global-words', order: -3, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  collectionById.set(SYSTEM_GLOBAL_PHRASES_ID, { id: SYSTEM_GLOBAL_PHRASES_ID, domainId: '', name: '全局短语总表', label: '', type: 'system-global-phrases', order: -2, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  collectionById.set(SYSTEM_GLOBAL_CONTENT_ID, { id: SYSTEM_GLOBAL_CONTENT_ID, domainId: '', name: '全局非结构总表', label: '', type: 'system-global-content', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
  for (const domain of domains) {
    if (domain.contentMode === 'nonStructured') {
      collectionById.set(systemDomainContentCollectionId(domain.id), { id: systemDomainContentCollectionId(domain.id), domainId: domain.id, name: '内容总表', label: '', type: 'system-domain-content', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
    } else {
      collectionById.set(systemDomainWordsCollectionId(domain.id), { id: systemDomainWordsCollectionId(domain.id), domainId: domain.id, name: '词汇总表', label: '', type: 'system-domain-words', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });
    }
  }
  const globalConflictKeys = new Set();
  for (const [normalizedText, list] of entriesByNormalizedText) {
    const byKind = new Map();
    for (const entry of list) { const arr=byKind.get(entry.kind)||[]; arr.push(entry); byKind.set(entry.kind,arr); }
    for (const [kind, kindEntries] of byKind) if (new Set(kindEntries.map((entry)=>entry.domainId)).size > 1) globalConflictKeys.add(`${kind}\u0000${normalizedText}`);
  }
  const projectionUniqueCounts = new Map([...projection.entries()].map(([collectionId, list]) => [collectionId, uniqueProjectionCount(list)]));
  return {
    ...backup, domains, collections, projection, visibleEntryIdsByCollection,
    revision: Number(snapshot.settings?.dataRevision || 0),
    domainById, collectionById, entryById, entriesByNormalizedText,
    wordsByNormalizedText, phrasesByNormalizedText, contentByNormalizedText,
    globalConflictKeys, projectionUniqueCounts,
    relationComponentsByEntry: componentsByEntry,
    rawRelationsByEntry, relatedEntriesByEntry, effectiveAdjacency,
    // Compatibility views used by older call sites while UI is migrated to generic relations.
    relatedPhrasesByEntry: new Map(backup.entries.map((entry) => [entry.id, (relatedEntriesByEntry.get(entry.id) || []).filter((target) => target.kind === 'phrase')])),
    phraseComponentsByEntry: componentsByEntry,
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
    await ensureLowLevelLexemes();
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
  draft.studyStamps = draft.studyStamps.filter((item) => item.entryId !== entry.id);
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
    ...diffArray('relationComponents', before.relationComponents, after.relationComponents),
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
      const previousCollection = collectionById.get(collectionId);
      const candidates = [...projection.entries()]
        .filter(([id, list]) => {
          const collection = collectionById.get(id);
          return collection?.domainId === entry.domainId && list.some((item) => item.id === entry.id);
        })
        .map(([id]) => collectionById.get(id))
        .filter(Boolean)
        .sort((left, right) => {
          // Normal-table priority is an intentional ownership rule. When a
          // priority change moves a word, keep its PIN attached to the new
          // highest-priority normal projection instead of a system total.
          const leftNormal = left.type === 'normal' ? 0 : 1;
          const rightNormal = right.type === 'normal' ? 0 : 1;
          if (previousCollection?.type === 'normal' && leftNormal !== rightNormal) return leftNormal - rightNormal;
          return Number(left.order || 0) - Number(right.order || 0) || left.id.localeCompare(right.id);
        });
      collectionId = candidates[0]?.id || '';
    }
    if (!collectionId) return [];
    return [{ ...pin, id: safeId('pin', entry.id), entryId: entry.id, domainId: entry.domainId, contextCollectionId: collectionId }];
  });

  const lastPositions = { ...(backup.settings?.lastPositions || {}) };
  for (const [key, entryId] of Object.entries(lastPositions)) {
    const parts = key.split(':');
    const collectionId = parts.length >= 5 ? parts.slice(2, -2).join(':') : parts.slice(2).join(':');
    if ((projection.get(collectionId) || []).some((item) => item.id === entryId)) continue;
    // A missing concrete Entry must never migrate to a cross-domain homograph/homophrase.
    delete lastPositions[key];
  }
  const validCollectionIds = new Set(projection.keys());
  const viewModes = Object.fromEntries(Object.entries(backup.settings?.viewModes || {})
    .filter(([key]) => {
      const match = /^(.*):(word|phrase|main)$/.exec(key);
      return validCollectionIds.has(match ? match[1] : key);
    }));
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
  draft.relationComponents = buildRelationComponentsForEntries(draft.entries);
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

export async function addDomain(name, { glossEnabled = false, contentMode = 'structured' } = {}) {
  return mutate('新增词域', (draft) => {
    const normalized = normalizeEnglish(name);
    if (draft.domains.some((item) => normalizeEnglish(item.name) === normalized)) throw new Error('词域名称已存在');
    const domain = createDomain({ name, glossEnabled, contentMode, order: nextOrder(draft.domains) });
    draft.domains.push(domain);
    if (domain.contentMode === 'structured') draft.collections.push(createCollection({
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

export async function setDomainRelationExcluded(domainId, excluded) {
  return mutate(excluded ? '关闭词域关联' : '恢复词域关联', (draft) => {
    const domain = draft.domains.find((item) => item.id === domainId);
    if (!domain) throw new Error('词域不存在');
    domain.relationExcluded = Boolean(excluded);
    domain.updatedAt = new Date().toISOString();
  });
}

export async function setLowLevelRelationsClosed(enabled) {
  await setSettings({ closeLowLevelRelations: Boolean(enabled) }, { expectedRevision: state.revision, bumpRevision: true });
  await reloadStore('relation-filter');
  broadcast(state.revision);
  return state;
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
  return mutate('调整词表优先级', (draft) => {
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
  if (!entry) return;
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
  const desiredKind = domain?.contentMode === 'nonStructured' ? 'content' : (isPhraseText(text) ? 'phrase' : 'word');
  let entry = draft.entries.find((candidate) => candidate.domainId === collection.domainId && candidate.normalizedText === normalized);
  if (!entry) {
    entry = createEntry({
      domainId: collection.domainId,
      text,
      kind: desiredKind,
      contentType: desiredKind === 'content' ? (item?.contentType || collection.label || collection.name || 'general') : '',
      partsOfSpeech: item?.partsOfSpeech || item?.pos || item?.sourceLabel || [],
      glossHans: item?.glossHans || '',
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

export async function addEntry(collectionId, text, { sourceLabel = '', gloss = '', glossSource = 'manual', contentType = '' } = {}) {
  let resultingId = null;
  await mutate('新增内容', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    if (collection.type !== 'normal') throw new Error('系统总表仅用于投影浏览，请在普通词表中新增内容');
    const domain = draft.domains.find((item) => item.id === collection.domainId);
    const normalized = normalizeEnglish(text);
    if (!normalized) throw new Error('内容不能为空');
    let entry = draft.entries.find((item) => item.domainId === collection.domainId && item.normalizedText === normalized);
    if (!entry) {
      const desiredKind = domain?.contentMode === 'nonStructured' ? 'content' : (isPhraseText(text) ? 'phrase' : 'word');
      entry = createEntry({
        domainId: collection.domainId,
        text,
        kind: desiredKind,
        contentType: desiredKind === 'content' ? normalizeDisplayText(contentType || collection.label || collection.name || 'general') : '',
        partsOfSpeech: sourceLabelParts(sourceLabel),
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
  const domain = current.domainById.get(word.domainId);
  if (!domain || domain.contentMode === 'nonStructured') throw new Error('非结构内容不使用“添加相关短语”入口');
  const containsWord = tokenizeEnglish(phraseText).some((token) => normalizeEnglish(token) === word.normalizedText);
  if (!containsWord) throw new Error('短语必须包含当前词的精确词元');

  const requested = current.collectionById.get(collectionId);
  let targetCollection = requested?.type === 'normal' && requested.domainId === word.domainId ? requested : null;
  if (!targetCollection) {
    const candidates = (current.membershipsByEntry.get(word.id) || [])
      .map((membership) => ({ membership, collection: current.collectionById.get(membership.collectionId) }))
      .filter((item) => item.collection?.type === 'normal' && item.collection.domainId === word.domainId && !item.collection.hidden)
      .sort((a, b) => a.collection.order - b.collection.order
        || Number(a.membership.sourceOrder || 0) - Number(b.membership.sourceOrder || 0)
        || a.collection.name.localeCompare(b.collection.name));
    targetCollection = candidates[0]?.collection || null;
  }
  if (!targetCollection) throw new Error('当前词没有可写入的普通词表；系统总表仅用于投影浏览');
  return addEntry(targetCollection.id, phraseText, options);
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
    Object.assign(entry, candidate);
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
    Object.assign(entry, candidate);
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
  if (!existing) {
    const siblingPins = state.pins.filter((item) => item.contextCollectionId === contextCollectionId);
    after = {
      id: safeId('pin', entryId), entryId, domainId: entry.domainId, contextCollectionId,
      order: siblingPins.length ? Math.max(...siblingPins.map((item) => Number(item.order || 0))) + 1 : 0,
      createdAt: new Date().toISOString(),
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
    emit('mutation', { kind: 'pin', entryId, contextCollectionId, moved: false });
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

export function getViewMode(collectionId, section = 'main') {
  const key = `${collectionId}:${section}`;
  const value = state.settings.viewModes?.[key] ?? state.settings.viewModes?.[collectionId];
  return value === 'date' ? 'date' : 'alphabet';
}

export async function setViewMode(collectionId, mode, section = 'main') {
  if (!['alphabet', 'date'].includes(mode)) throw new Error('无效浏览模式');
  const key = `${collectionId}:${section}`;
  const next = { ...(state.settings.viewModes || {}), [key]: mode };
  await setSettings({ viewModes: next });
  state.settings.viewModes = next;
  emit('view-mode', { collectionId, section, mode });
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
  const after = createStudyStamp({
    key,
    scope: 'entry',
    entryId: entry.id,
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
    .filter((item) => visibleIds.has(item.entryId))
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

async function commitAnnotationSet(nextAnnotations, label, detail = {}, retry = true, expectedRevision = null, recordHistory = true) {
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
    const revision = await commitChanges(changes, { label, expectedRevision: state.revision, recordHistory });
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
      return commitAnnotationSet(nextAnnotations, label, detail, false, expectedRevision, recordHistory);
    }
    throw error;
  }
}

export async function replaceAnnotations(entryIds, annotations, { expectedEntries = [], expectedRevision = null } = {}) {
  const target = new Set(entryIds);
  const expected = new Map(expectedEntries.map((item) => [item.id, item]));
  const validTarget = new Set();
  for (const entryId of target) {
    const entry = state.entryById.get(entryId);
    const snapshot = expected.get(entryId);
    if (!entry) continue;
    if (snapshot && (snapshot.updatedAt !== entry.updatedAt || snapshot.normalizedText !== entry.normalizedText)) continue;
    validTarget.add(entryId);
  }
  const retained = state.annotations.filter((item) => !validTarget.has(item.entryId));
  const now = new Date().toISOString();
  const next = [...retained];
  for (const annotation of annotations) {
    const entry = state.entryById.get(annotation.entryId);
    if (!entry || !validTarget.has(entry.id)) continue;
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
  return commitAnnotationSet(next, '保存 AI 标注', { kind: 'batch' }, true, expectedRevision, false);
}

/**
 * Records one aggregate AI undo item without rewriting annotations. Only AI-owned
 * changes that are still present are admitted, so a later manual review is never
 * absorbed into the AI history item.
 * @param {{entryId:string,before:any,after:any}[]} aiChanges
 * @param {string} label
 */
export async function recordAiAnnotationChanges(aiChanges, label = 'AI 核查') {
  const changes = [];
  for (const item of aiChanges || []) {
    const entryId = String(item?.entryId || '');
    if (!entryId) continue;
    const before = item.before || null;
    const after = item.after || null;
    const current = state.annotationByEntry.get(entryId) || null;
    if (!jsonEqual(current, after) || jsonEqual(before, after)) continue;
    changes.push({
      store: 'annotations', key: entryId,
      before: before ? clone(before) : null,
      after: after ? clone(after) : null,
    });
  }
  if (!changes.length) return false;
  const revision = await recordHistoryOnly(changes, { label, expectedRevision: state.revision });
  state.revision = revision;
  state.settings.dataRevision = revision;
  broadcast(revision);
  return true;
}

export async function dismissAnnotation(entryId) {
  return commitAnnotationSet(state.annotations.filter((item) => item.entryId !== entryId), '取消 AI 标注', { kind: 'dismiss' });
}

export async function clearAnnotationsForEntries(entryIds, label = '清空当前视图 AI 标注') {
  const target = new Set(entryIds || []);
  if (!target.size) return state;
  return commitAnnotationSet(
    state.annotations.filter((item) => !target.has(item.entryId)),
    label,
    { kind: 'clear-view', entryIds: [...target] },
  );
}

export async function clearAllAnnotations() {
  return commitAnnotationSet([], '清空全部 AI 标注', { kind: 'clear-all' });
}

export function getVisibleEntries(collectionId) {
  return state.projection.get(collectionId) || [];
}

export function getRelatedEntries(entryId, { raw = false } = {}) {
  return (raw ? state.rawRelationsByEntry : state.relatedEntriesByEntry).get(entryId) || [];
}

export function getRelatedPhrases(entryId) {
  return getRelatedEntries(entryId).filter((entry) => entry.kind === 'phrase');
}

export function getPhraseComponents(entryId) {
  return state.relationComponentsByEntry.get(entryId) || [];
}

export function getRelationComponents(entryId) {
  return state.relationComponentsByEntry.get(entryId) || [];
}

export function search(query, options = {}) {
  const entryIds = options.entryIds instanceof Set ? options.entryIds : null;
  const entries = entryIds ? state.entries.filter((entry) => entryIds.has(entry.id)) : state.entries;
  const { entryIds: _entryIds, ...searchOptions } = options;
  return searchBackup({ entries }, query, searchOptions);
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
