import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, createCollection, createDomain, createEntry,
  createMembership, isPhraseText, normalizeDisplayText, normalizeEnglish, normalizeGlossHant, relatedPhrases,
  phraseComponents, safeId, searchBackup, systemPhraseCollectionId, tokenizeEnglish,
} from './v3-model.js';
import {
  commitChanges, exportBackup, getSetting, initializeDatabase, readSnapshot, redo as dbRedo,
  replaceWithBackup, setLastPositionSetting, setSettings, undo as dbUndo,
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
    schemaVersion: 3,
    appVersion: '3.0.0',
    exportedAt: new Date().toISOString(),
    domains: clone(state.domains),
    collections: clone(state.collections),
    entries: clone(state.entries),
    memberships: clone(state.memberships),
    phraseTokens: clone(state.phraseTokens),
    pins: clone(state.pins),
    annotations: clone(state.annotations),
    settings: clone(state.settings),
  };
}

function buildState(snapshot) {
  const backup = canonicalizeBackup({ schemaVersion: 3, appVersion: '3.0.0', exportedAt: new Date().toISOString(), ...snapshot });
  const domains = backup.domains.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const collections = backup.collections.sort((a, b) => {
    if (a.domainId !== b.domainId) return a.domainId.localeCompare(b.domainId);
    if (a.type !== b.type) return a.type === 'normal' ? -1 : 1;
    return a.order - b.order || a.name.localeCompare(b.name);
  });
  const projection = buildProjection(backup);
  return {
    ...backup,
    domains,
    collections,
    projection,
    revision: Number(snapshot.settings?.dataRevision || 0),
    domainById: new Map(domains.map((item) => [item.id, item])),
    collectionById: new Map(collections.map((item) => [item.id, item])),
    entryById: new Map(backup.entries.map((item) => [item.id, item])),
    membershipsByEntry: groupBy(backup.memberships, (item) => item.entryId),
    membershipsByCollection: groupBy(backup.memberships, (item) => item.collectionId),
    pinByEntry: new Map(backup.pins.map((item) => [item.entryId, item])),
    annotationByEntry: new Map(backup.annotations.map((item) => [item.entryId, item])),
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

function jsonEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
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
    ...diffSettings(before.settings, after.settings),
  ];
}

function normalizeSoftReferences(backup) {
  const projection = buildProjection(backup);
  const entryById = mapById(backup.entries);
  const collectionById = mapById(backup.collections);
  backup.pins = backup.pins.flatMap((pin) => {
    const entry = entryById.get(pin.entryId);
    if (!entry) return [];
    let collectionId = pin.contextCollectionId;
    if (!(projection.get(collectionId) || []).some((item) => item.id === entry.id)) {
      collectionId = [...projection.entries()].find(([id, list]) => {
        const collection = collectionById.get(id);
        return collection?.domainId === entry.domainId && list.some((item) => item.id === entry.id);
      })?.[0] || '';
    }
    if (!collectionId) return [];
    return [{ ...pin, domainId: entry.domainId, contextCollectionId: collectionId }];
  });

  const lastPositions = { ...(backup.settings?.lastPositions || {}) };
  for (const [key, entryId] of Object.entries(lastPositions)) {
    const parts = key.split(':');
    const collectionId = parts.slice(2).join(':');
    if (!(projection.get(collectionId) || []).some((item) => item.id === entryId)) delete lastPositions[key];
  }
  backup.settings = { ...backup.settings, lastPositions };
  return backup;
}

async function mutate(label, mutator) {
  const before = backupFromState();
  const draft = clone(before);
  await mutator(draft);
  draft.phraseTokens = draft.entries.flatMap(buildPhraseTokens);
  normalizeSoftReferences(draft);
  const after = canonicalizeBackup(draft);
  const changes = diffBackup(before, after);
  if (!changes.length) return state;
  const revision = await commitChanges(changes, { label, expectedRevision: state.revision });
  await reloadStore('mutation');
  broadcast(revision);
  return state;
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
      domainId: domain.id, name: '短语', type: 'system-phrases', order: Number.MAX_SAFE_INTEGER,
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
    draft.collections.push(createCollection({ domainId, name, label, order: nextOrder(siblings.filter((item) => item.type === 'normal')) }));
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
        sourceLabel: nextLabel || membership.sourceLabel,
        sourceOrder,
        updatedAt: new Date().toISOString(),
      });
      Object.assign(membership, updated);
    }
  }
  return entry;
}

export async function importEntries(collectionId, items, { mode = 'merge' } = {}) {
  if (!Array.isArray(items) || !items.length) throw new Error('没有可导入词项');
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
      }
    }
    const seen = new Set();
    items.forEach((item, index) => {
      const normalized = normalizeEnglish(item?.text || item?.word || '');
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      upsertEntryInDraft(draft, collection, item, index);
    });
  });
}

export async function addEntry(collectionId, text, { sourceLabel = '', gloss = '', glossSource = 'manual' } = {}) {
  let resultingId = null;
  await mutate('新增词项', (draft) => {
    const collection = draft.collections.find((item) => item.id === collectionId);
    if (!collection) throw new Error('词表不存在');
    const domain = draft.domains.find((item) => item.id === collection.domainId);
    const normalized = normalizeEnglish(text);
    if (!normalized) throw new Error('词项不能为空');
    if (collection.type === 'system-phrases' && !isPhraseText(text)) {
      throw new Error('系统短语表只能新增包含至少两个英文词元的短语');
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
      const exists = draft.memberships.some((item) => item.entryId === entry.id && item.collectionId === collection.id);
      if (!exists) {
        const sourceOrder = nextOrder(draft.memberships.filter((item) => item.collectionId === collection.id));
        draft.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceLabel, sourceOrder }));
      }
    }
  });
  return getState().entryById.get(resultingId);
}

export async function addPhraseForWord(entryId, phraseText, options = {}) {
  const word = getState().entryById.get(entryId);
  if (!word || word.kind !== 'word') throw new Error('目标普通词不存在');
  const containsWord = tokenizeEnglish(phraseText).some((token) => normalizeEnglish(token) === word.normalizedText);
  if (!containsWord) throw new Error('短语必须包含当前词的精确词元');
  const phraseCollectionId = systemPhraseCollectionId(word.domainId);
  return addEntry(phraseCollectionId, phraseText, options);
}

export async function editEntry(entryId, updates, expectedUpdatedAt) {
  return mutate('编辑词项', (draft) => {
    const entry = draft.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error('词项不存在');
    if (expectedUpdatedAt && entry.updatedAt !== expectedUpdatedAt) throw new Error('词项已在其他实例更新，请重新打开后再编辑');
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
    if (collision) throw new Error('同一词域内已有该词项');
    const textChanged = candidate.normalizedText !== entry.normalizedText;
    if (candidate.kind === 'word' && !draft.memberships.some((item) => item.entryId === entry.id)) {
      throw new Error('系统短语不能直接改成普通词；请先在普通词表中新增该词。');
    }
    Object.assign(entry, candidate);
    if (textChanged) draft.annotations = draft.annotations.filter((item) => item.entryId !== entry.id);
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
  return mutate('删除词项', (draft) => {
    draft.entries = draft.entries.filter((item) => item.id !== entryId);
    draft.memberships = draft.memberships.filter((item) => item.entryId !== entryId);
    draft.pins = draft.pins.filter((item) => item.entryId !== entryId);
    draft.annotations = draft.annotations.filter((item) => item.entryId !== entryId);
  });
}

export async function togglePin(entryId, contextCollectionId) {
  return mutate('切换 PIN', (draft) => {
    const existing = draft.pins.find((item) => item.entryId === entryId);
    if (existing) {
      draft.pins = draft.pins.filter((item) => item.entryId !== entryId);
      return;
    }
    const entry = draft.entries.find((item) => item.id === entryId);
    if (!entry) throw new Error('词项不存在');
    const projection = buildProjection(draft);
    if (!(projection.get(contextCollectionId) || []).some((item) => item.id === entryId)) throw new Error('PIN 上下文不可见');
    const siblingPins = draft.pins.filter((item) => item.contextCollectionId === contextCollectionId);
    draft.pins.push({
      id: safeId('pin', entryId), entryId, domainId: entry.domainId, contextCollectionId,
      order: siblingPins.length ? Math.max(...siblingPins.map((item) => Number(item.order || 0))) + 1 : 0,
      createdAt: new Date().toISOString(),
    });
  });
}

export async function setLastPosition(domainId, collectionId, entryId) {
  const key = `lastPosition:${domainId}:${collectionId}`;
  const visible = state.projection.get(collectionId) || [];
  if (!visible.some((item) => item.id === entryId)) return false;
  const next = await setLastPositionSetting(key, entryId);
  state.settings.lastPositions = next;
  return true;
}

export function getLastPosition(domainId, collectionId) {
  return state.settings.lastPositions?.[`lastPosition:${domainId}:${collectionId}`] || null;
}

export function getPinsForCollection(collectionId) {
  const visibleIds = new Set((state.projection.get(collectionId) || []).map((item) => item.id));
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

export async function replaceAnnotations(entryIds, annotations) {
  return mutate('保存 AI 标注', (draft) => {
    const target = new Set(entryIds);
    draft.annotations = draft.annotations.filter((item) => !target.has(item.entryId));
    for (const annotation of annotations) {
      const entry = draft.entries.find((item) => item.id === annotation.entryId);
      if (!entry || !target.has(entry.id)) continue;
      const suggestion = normalizeDisplayText(annotation?.spelling?.suggestion || annotation?.suggestion || '');
      const reason = normalizeDisplayText(annotation?.reason || '');
      if (!suggestion && !reason) continue;
      draft.annotations.push({
        entryId: entry.id,
        domainId: entry.domainId,
        spelling: { incorrect: Boolean(annotation?.spelling?.incorrect ?? suggestion), suggestion },
        reason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

export async function dismissAnnotation(entryId) {
  return mutate('取消 AI 标注', (draft) => {
    draft.annotations = draft.annotations.filter((item) => item.entryId !== entryId);
  });
}

export async function clearAnnotationsForCollection(collectionId) {
  return mutate('清空词表 AI 标注', (draft) => {
    const visibleIds = new Set((buildProjection(draft).get(collectionId) || []).map((item) => item.id));
    draft.annotations = draft.annotations.filter((item) => !visibleIds.has(item.entryId));
  });
}

export function getVisibleEntries(collectionId) {
  return state.projection.get(collectionId) || [];
}

export function getRelatedPhrases(entryId) {
  return relatedPhrases(backupFromState(), entryId);
}

export function getPhraseComponents(phraseId) {
  return phraseComponents(backupFromState(), phraseId);
}

export function search(query, options) {
  return searchBackup(backupFromState(), query, options);
}

export async function restoreBackup(input) {
  const revision = await replaceWithBackup(input, { expectedRevision: state.revision });
  await reloadStore('restore');
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
