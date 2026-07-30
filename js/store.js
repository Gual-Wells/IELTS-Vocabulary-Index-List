import {
  commitChanges, getAll, getSetting, historyStatus, redoHistory, setSetting,
  undoHistory, writeChangesWithoutHistory,
} from './db.js';
import { APP_VERSION, HISTORY_LIMIT } from './constants.js';
import { deepClone, formatPos, mergePos, normalizeWord, parsePos, sortPos, uuid } from './utils.js';

const state = {
  categories: [],
  entries: new Map(),
  pins: new Map(),
  annotations: new Map(),
  settings: {},
  history: { canUndo: false, canRedo: false, pointer: 0 },
};
const listeners = new Set();
let wordIndex = new Map();
let categoryIndex = new Map();

function orderedCategories(categories = state.categories) {
  return [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function categoryOrderMap(categories = state.categories) {
  return new Map(orderedCategories(categories).map((category, index) => [category.id, index]));
}

function recalculateEntry(record, categories = state.categories) {
  const entry = deepClone(record);
  const order = categoryOrderMap(categories);
  const sourceIds = Object.keys(entry.sources ?? {}).filter((id) => order.has(id));
  sourceIds.sort((a, b) => order.get(a) - order.get(b));
  if (!sourceIds.length) return null;
  const owner = sourceIds[0];
  const source = entry.sources[owner] ?? {};
  const word = String(entry.manualWord || source.word || entry.word || '').trim();
  const sourcePos = sourceIds.flatMap((id) => entry.sources[id]?.pos ?? []);
  const pos = entry.manualPos?.length ? sortPos(entry.manualPos) : sortPos(sourcePos);
  return {
    ...entry,
    word,
    normalizedWord: normalizeWord(word),
    pos,
    categoryId: owner,
    updatedAt: new Date().toISOString(),
  };
}

function rebuildIndexes() {
  wordIndex = new Map();
  categoryIndex = new Map(state.categories.map((category) => [category.id, []]));
  for (const entry of state.entries.values()) {
    wordIndex.set(entry.normalizedWord, entry.id);
    if (!categoryIndex.has(entry.categoryId)) categoryIndex.set(entry.categoryId, []);
    categoryIndex.get(entry.categoryId).push(entry);
  }
  for (const entries of categoryIndex.values()) entries.sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord));
}

function notify(type = 'change', detail = {}) {
  for (const listener of listeners) listener({ type, detail, state });
}

function entityMap(store) {
  if (store === 'entries') return state.entries;
  if (store === 'pins') return state.pins;
  if (store === 'annotations') return state.annotations;
  return null;
}

function applyLocalChange(change) {
  if (change.store === 'categories') {
    const index = state.categories.findIndex((category) => category.id === change.key);
    if (change.after == null && index >= 0) state.categories.splice(index, 1);
    else if (index >= 0) state.categories[index] = deepClone(change.after);
    else if (change.after != null) state.categories.push(deepClone(change.after));
    state.categories = orderedCategories(state.categories);
    return;
  }
  const map = entityMap(change.store);
  if (!map) return;
  if (change.after == null) map.delete(change.key);
  else map.set(change.key, deepClone(change.after));
}

function change(store, key, before, after) {
  const beforeClone = before == null ? null : deepClone(before);
  const afterClone = after == null ? null : deepClone(after);
  if (JSON.stringify(beforeClone) === JSON.stringify(afterClone)) return null;
  return { store, key, before: beforeClone, after: afterClone };
}

function pushChange(changes, store, key, before, after) {
  const item = change(store, key, before, after);
  if (item) changes.push(item);
}

async function refreshHistoryStatus() {
  state.history = await historyStatus();
}

async function commit(label, changes, detail = {}) {
  const filtered = changes.filter(Boolean);
  if (!filtered.length) return false;
  await commitChanges(label, filtered);
  filtered.forEach(applyLocalChange);
  rebuildIndexes();
  await refreshHistoryStatus();
  notify('change', { label, ...detail });
  return true;
}

function pinsForEntry(entryId) {
  return [...state.pins.values()].filter((pin) => pin.entryId === entryId);
}

function annotationForEntry(entryId) {
  return state.annotations.get(entryId) ?? null;
}

function addDependentEntryChanges(changes, before, after) {
  const beforeId = before?.id;
  if (!beforeId) return;
  const wordOrPosChanged = after == null || before.word !== after.word || formatPos(before.pos) !== formatPos(after.pos);
  for (const pin of pinsForEntry(beforeId)) {
    if (after == null) pushChange(changes, 'pins', pin.id, pin, null);
    else if (pin.categoryId !== after.categoryId) pushChange(changes, 'pins', pin.id, pin, { ...pin, categoryId: after.categoryId });
  }
  const annotation = annotationForEntry(beforeId);
  if (annotation) {
    if (after == null || wordOrPosChanged) pushChange(changes, 'annotations', beforeId, annotation, null);
    else if (annotation.categoryId !== after.categoryId) pushChange(changes, 'annotations', beforeId, annotation, { ...annotation, categoryId: after.categoryId });
  }
}

function uniqueCategoryName(name, exceptId = null) {
  const normalized = String(name).trim().toLocaleLowerCase('en-US');
  return !state.categories.some((category) => category.id !== exceptId && category.name.trim().toLocaleLowerCase('en-US') === normalized);
}

function createEntry(categoryId, word, pos) {
  const now = new Date().toISOString();
  const normalizedWord = normalizeWord(word);
  const entry = {
    id: uuid('e'), word: String(word).trim(), normalizedWord,
    sources: { [categoryId]: { word: String(word).trim(), pos: sortPos(pos) } },
    manualWord: null, manualPos: null, categoryId, pos: sortPos(pos), createdAt: now, updatedAt: now,
  };
  return recalculateEntry(entry);
}

function cloneEntriesMap() {
  return new Map([...state.entries].map(([id, entry]) => [id, deepClone(entry)]));
}

function syncAffectedEntriesToChanges(workingEntries, affectedIds, changes) {
  for (const id of affectedIds) {
    const before = state.entries.get(id) ?? null;
    const after = workingEntries.get(id) ?? null;
    pushChange(changes, 'entries', id, before, after);
    addDependentEntryChanges(changes, before, after);
  }
}

export async function initializeStore() {
  const [categories, entries, pins, annotations, numberMode, historyLimit] = await Promise.all([
    getAll('categories'), getAll('entries'), getAll('pins'), getAll('annotations'),
    getSetting('numberMode', 'none'), getSetting('historyLimit', HISTORY_LIMIT),
  ]);
  state.categories = orderedCategories(categories);
  state.entries = new Map(entries.map((entry) => [entry.id, entry]));
  state.pins = new Map(pins.map((pin) => [pin.id, pin]));
  state.annotations = new Map(annotations.map((annotation) => [annotation.entryId, annotation]));
  state.settings = { numberMode, historyLimit, appVersion: APP_VERSION };
  rebuildIndexes();
  await refreshHistoryStatus();
  notify('initialized');
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() { return state; }
export function getCategories() { return orderedCategories(); }
export function getCategory(categoryId) { return state.categories.find((category) => category.id === categoryId) ?? null; }
export function getEntry(entryId) { return state.entries.get(entryId) ?? null; }
export function getEntryByWord(word) { const id = wordIndex.get(normalizeWord(word)); return id ? state.entries.get(id) : null; }
export function getCategoryEntries(categoryId) { return [...(categoryIndex.get(categoryId) ?? [])]; }
export function getAllEntries() { return [...state.entries.values()]; }
export function getEntriesForScope(scope, categoryId) { return scope === 'all' ? getAllEntries() : getCategoryEntries(categoryId); }
export function getAnnotation(entryId) { return state.annotations.get(entryId) ?? null; }
export function getAnnotations(categoryId = null) { return [...state.annotations.values()].filter((item) => !categoryId || item.categoryId === categoryId); }
export function getPins(categoryId) {
  return [...state.pins.values()]
    .filter((pin) => pin.categoryId === categoryId && state.entries.has(pin.entryId))
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export async function addCategory(name) {
  const clean = String(name ?? '').trim();
  if (!clean) throw new Error('词表名称不能为空');
  if (!uniqueCategoryName(clean)) throw new Error('词表名称已存在');
  const now = new Date().toISOString();
  const category = { id: uuid('cat'), name: clean, label: clean, order: state.categories.length, createdAt: now, updatedAt: now };
  await commit(`新增词表 ${clean}`, [change('categories', category.id, null, category)]);
  return category;
}

export async function renameCategory(categoryId, name) {
  const before = getCategory(categoryId);
  if (!before) throw new Error('词表不存在');
  const clean = String(name ?? '').trim();
  if (!clean) throw new Error('词表名称不能为空');
  if (!uniqueCategoryName(clean, categoryId)) throw new Error('词表名称已存在');
  const after = { ...before, name: clean, label: clean, updatedAt: new Date().toISOString() };
  await commit(`重命名词表 ${before.name}`, [change('categories', categoryId, before, after)]);
}

export async function moveCategory(categoryId, direction) {
  const categories = orderedCategories();
  const index = categories.findIndex((category) => category.id === categoryId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return false;
  [categories[index], categories[targetIndex]] = [categories[targetIndex], categories[index]];
  const updatedCategories = categories.map((category, order) => ({ ...category, order, updatedAt: new Date().toISOString() }));
  const changes = [];
  for (const updated of updatedCategories) pushChange(changes, 'categories', updated.id, getCategory(updated.id), updated);
  const working = cloneEntriesMap();
  const affected = new Set();
  for (const [id, entry] of working) {
    const recalculated = recalculateEntry(entry, updatedCategories);
    if (recalculated && recalculated.categoryId !== entry.categoryId) {
      working.set(id, recalculated);
      affected.add(id);
    }
  }
  syncAffectedEntriesToChanges(working, affected, changes);
  await commit('调整词表优先级', changes);
  return true;
}

export async function deleteCategory(categoryId) {
  const category = getCategory(categoryId);
  if (!category) throw new Error('词表不存在');
  const remainingCategories = orderedCategories().filter((item) => item.id !== categoryId).map((item, order) => ({ ...item, order }));
  const changes = [change('categories', categoryId, category, null)];
  for (const updated of remainingCategories) pushChange(changes, 'categories', updated.id, getCategory(updated.id), updated);
  const working = cloneEntriesMap();
  const affected = new Set();
  for (const [id, entry] of working) {
    if (!entry.sources?.[categoryId]) continue;
    delete entry.sources[categoryId];
    const recalculated = recalculateEntry(entry, remainingCategories);
    if (recalculated) working.set(id, recalculated); else working.delete(id);
    affected.add(id);
  }
  syncAffectedEntriesToChanges(working, affected, changes);
  for (const pin of state.pins.values()) {
    if (pin.categoryId === categoryId && !affected.has(pin.entryId)) pushChange(changes, 'pins', pin.id, pin, null);
  }
  await commit(`删除词表 ${category.name}`, changes);
}

export async function addWord(categoryId, word, posValue) {
  if (!getCategory(categoryId)) throw new Error('目标词表不存在');
  const cleanWord = String(word ?? '').trim();
  const normalized = normalizeWord(cleanWord);
  const pos = Array.isArray(posValue) ? sortPos(posValue) : parsePos(posValue);
  if (!normalized) throw new Error('词汇不能为空');
  if (!pos.length) throw new Error('词性不能为空');
  const existingId = wordIndex.get(normalized);
  const changes = [];
  if (!existingId) {
    const entry = createEntry(categoryId, cleanWord, pos);
    await commit(`新增词汇 ${cleanWord}`, [change('entries', entry.id, null, entry)]);
    return { entry, created: true, merged: false };
  }
  const before = state.entries.get(existingId);
  const after = deepClone(before);
  const source = after.sources[categoryId] ?? { word: cleanWord, pos: [] };
  source.pos = mergePos(source.pos, pos);
  if (!source.word) source.word = cleanWord;
  after.sources[categoryId] = source;
  if (after.manualPos?.length) after.manualPos = mergePos(after.manualPos, pos);
  const recalculated = recalculateEntry(after);
  pushChange(changes, 'entries', before.id, before, recalculated);
  addDependentEntryChanges(changes, before, recalculated);
  await commit(`合并重复词 ${cleanWord}`, changes);
  return { entry: recalculated, created: false, merged: true, moved: before.categoryId !== recalculated.categoryId };
}

export async function editEntry(entryId, word, posValue) {
  const before = getEntry(entryId);
  if (!before) throw new Error('词汇不存在');
  const cleanWord = String(word ?? '').trim();
  const normalized = normalizeWord(cleanWord);
  const pos = Array.isArray(posValue) ? sortPos(posValue) : parsePos(posValue);
  if (!normalized || !pos.length) throw new Error('词汇和词性不能为空');
  const duplicateId = wordIndex.get(normalized);
  if (duplicateId && duplicateId !== entryId) {
    const targetBefore = getEntry(duplicateId);
    const targetAfter = deepClone(targetBefore);
    for (const [categoryId, source] of Object.entries(before.sources ?? {})) {
      const existingSource = targetAfter.sources[categoryId] ?? { word: cleanWord, pos: [] };
      existingSource.pos = mergePos(existingSource.pos, source.pos ?? []);
      targetAfter.sources[categoryId] = existingSource;
    }
    targetAfter.manualWord = cleanWord;
    targetAfter.manualPos = mergePos(targetBefore.pos, before.pos, pos);
    const merged = recalculateEntry(targetAfter);
    const changes = [];
    pushChange(changes, 'entries', targetBefore.id, targetBefore, merged);
    pushChange(changes, 'entries', before.id, before, null);
    addDependentEntryChanges(changes, targetBefore, merged);
    const targetPin = pinsForEntry(targetBefore.id)[0] ?? null;
    for (const pin of pinsForEntry(before.id)) {
      if (targetPin) pushChange(changes, 'pins', pin.id, pin, null);
      else pushChange(changes, 'pins', pin.id, pin, { ...pin, entryId: targetBefore.id, categoryId: merged.categoryId });
    }
    const sourceAnnotation = annotationForEntry(before.id);
    if (sourceAnnotation) pushChange(changes, 'annotations', before.id, sourceAnnotation, null);
    const targetAnnotation = annotationForEntry(targetBefore.id);
    if (targetAnnotation) pushChange(changes, 'annotations', targetBefore.id, targetAnnotation, null);
    await commit(`合并词汇 ${cleanWord}`, changes);
    return { entry: merged, merged: true };
  }
  const after = recalculateEntry({ ...deepClone(before), manualWord: cleanWord, manualPos: pos });
  const changes = [];
  pushChange(changes, 'entries', entryId, before, after);
  addDependentEntryChanges(changes, before, after);
  await commit(`编辑词汇 ${before.word}`, changes);
  return { entry: after, merged: false };
}

export async function removeEntryFromCategory(entryId, categoryId) {
  const before = getEntry(entryId);
  if (!before) throw new Error('词汇不存在');
  if (!before.sources?.[categoryId]) throw new Error('该词汇不属于当前词表来源');
  const working = deepClone(before);
  delete working.sources[categoryId];
  const after = recalculateEntry(working);
  const changes = [];
  pushChange(changes, 'entries', entryId, before, after);
  addDependentEntryChanges(changes, before, after);
  await commit(`从词表移除 ${before.word}`, changes);
  return after;
}

export async function deleteEntryGlobally(entryId) {
  const before = getEntry(entryId);
  if (!before) return;
  const changes = [change('entries', entryId, before, null)];
  addDependentEntryChanges(changes, before, null);
  await commit(`全局删除 ${before.word}`, changes);
}

export async function togglePin(entryId) {
  const entry = getEntry(entryId);
  if (!entry) throw new Error('词汇不存在');
  const existing = pinsForEntry(entryId)[0];
  if (existing) {
    await commit(`取消书签 ${entry.word}`, [change('pins', existing.id, existing, null)]);
    return false;
  }
  const categoryPins = getPins(entry.categoryId);
  const pin = {
    id: uuid('pin'), entryId, categoryId: entry.categoryId,
    order: categoryPins.reduce((max, item) => Math.max(max, item.order), -1) + 1,
    createdAt: new Date().toISOString(),
  };
  await commit(`固定书签 ${entry.word}`, [change('pins', pin.id, null, pin)]);
  return true;
}

function simulateImport(categoryId, importedEntries, mode) {
  if (!getCategory(categoryId)) throw new Error('目标词表不存在');
  const working = cloneEntriesMap();
  const affected = new Set();
  const workingWordIndex = new Map([...working.values()].map((entry) => [entry.normalizedWord, entry.id]));
  const importedByWord = new Map(importedEntries.map((item) => [normalizeWord(item.word), item]));
  const consumed = new Set();
  const stats = { input: importedEntries.length, created: 0, merged: 0, retained: 0, movedToCurrent: 0, removedSources: 0, deleted: 0 };

  if (mode === 'replace') {
    for (const [id, entry] of working) {
      if (!entry.sources?.[categoryId]) continue;
      const replacement = importedByWord.get(entry.normalizedWord);
      if (replacement) {
        const beforeOwner = entry.categoryId;
        entry.sources[categoryId] = { word: replacement.word, pos: sortPos(replacement.pos) };
        const recalculated = recalculateEntry(entry);
        working.set(id, recalculated);
        affected.add(id);
        consumed.add(entry.normalizedWord);
        stats.retained += 1;
        if (Object.keys(recalculated.sources).length > 1) stats.merged += 1;
        if (beforeOwner !== categoryId && recalculated.categoryId === categoryId) stats.movedToCurrent += 1;
        continue;
      }
      delete entry.sources[categoryId];
      stats.removedSources += 1;
      const recalculated = recalculateEntry(entry);
      if (recalculated) working.set(id, recalculated);
      else { working.delete(id); workingWordIndex.delete(entry.normalizedWord); stats.deleted += 1; }
      affected.add(id);
    }
  }

  for (const item of importedEntries) {
    const normalized = normalizeWord(item.word);
    if (!normalized || consumed.has(normalized)) continue;
    const existingId = workingWordIndex.get(normalized);
    if (!existingId) {
      const created = createEntry(categoryId, item.word, item.pos);
      working.set(created.id, created);
      workingWordIndex.set(normalized, created.id);
      affected.add(created.id);
      stats.created += 1;
      continue;
    }
    const beforeMerge = working.get(existingId);
    const merged = deepClone(beforeMerge);
    const source = merged.sources[categoryId] ?? { word: item.word, pos: [] };
    source.pos = mergePos(source.pos, item.pos);
    if (!source.word) source.word = item.word;
    merged.sources[categoryId] = source;
    const recalculated = recalculateEntry(merged);
    working.set(existingId, recalculated);
    affected.add(existingId);
    stats.merged += 1;
    if (beforeMerge.categoryId !== categoryId && recalculated.categoryId === categoryId) stats.movedToCurrent += 1;
  }

  stats.finalCanonicalCount = [...working.values()].filter((entry) => entry.categoryId === categoryId).length;
  const changes = [];
  syncAffectedEntriesToChanges(working, affected, changes);
  return { stats, changes, working };
}

export function previewImport(categoryId, importedEntries, mode) {
  return simulateImport(categoryId, importedEntries, mode).stats;
}

export async function importIntoCategory(categoryId, importedEntries, mode) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('无效导入方式');
  const plan = simulateImport(categoryId, importedEntries, mode);
  await commit(mode === 'replace' ? '替换当前词表' : '合并导入当前词表', plan.changes, { importStats: plan.stats });
  return plan.stats;
}

export function createBackup() {
  return {
    schemaVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: getCategories().map(deepClone),
    entries: getAllEntries().map(deepClone),
    pins: [...state.pins.values()].map(deepClone),
    annotations: [...state.annotations.values()].map(deepClone),
    settings: { numberMode: state.settings.numberMode, historyLimit: state.settings.historyLimit },
  };
}

export async function restoreBackup(backup) {
  const nextCategories = new Map((backup.categories ?? []).map((item) => [item.id, deepClone(item)]));
  const nextEntries = new Map((backup.entries ?? []).map((item) => [item.id, deepClone(item)]));
  const nextPins = new Map((backup.pins ?? []).map((item) => [item.id, deepClone(item)]));
  const nextAnnotations = new Map((backup.annotations ?? []).map((item) => [item.entryId, deepClone(item)]));
  const changes = [];
  const mapSpecs = [
    ['categories', new Map(state.categories.map((item) => [item.id, item])), nextCategories],
    ['entries', state.entries, nextEntries], ['pins', state.pins, nextPins], ['annotations', state.annotations, nextAnnotations],
  ];
  for (const [store, beforeMap, afterMap] of mapSpecs) {
    const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
    for (const key of keys) pushChange(changes, store, key, beforeMap.get(key) ?? null, afterMap.get(key) ?? null);
  }
  await commit('恢复完整备份', changes);
  if (backup.settings?.numberMode) await setNumberMode(backup.settings.numberMode);
}

export async function setNumberMode(mode) {
  if (!['none', 'group', 'global'].includes(mode)) throw new Error('无效序号模式');
  state.settings.numberMode = mode;
  await setSetting('numberMode', mode);
  notify('settings', { numberMode: mode });
}

export async function saveLastPosition(categoryId, entryId) {
  if (!categoryId || !entryId) return;
  await setSetting(`lastPosition:${categoryId}`, entryId);
}

export function getLastPosition(categoryId) { return getSetting(`lastPosition:${categoryId}`, null); }
export async function saveExpandedGroups(categoryId, groups) { await setSetting(`expandedGroups:${categoryId}`, [...groups]); }
export function getExpandedGroups(categoryId) { return getSetting(`expandedGroups:${categoryId}`, []); }

export async function applyAnnotations(items) {
  const changes = [];
  for (const item of items) {
    const entry = getEntry(item.entryId);
    if (!entry) continue;
    const before = state.annotations.get(entry.id) ?? null;
    const after = {
      entryId: entry.id, categoryId: entry.categoryId, createdAt: new Date().toISOString(),
      spelling: item.spelling ?? null, pos: item.pos ?? null, reason: String(item.reason ?? '').slice(0, 500),
    };
    pushChange(changes, 'annotations', entry.id, before, after);
  }
  await writeChangesWithoutHistory(changes);
  changes.forEach(applyLocalChange);
  notify('annotations', { count: changes.length });
}

export async function dismissAnnotation(entryId) {
  const before = state.annotations.get(entryId);
  if (!before) return;
  const item = change('annotations', entryId, before, null);
  await writeChangesWithoutHistory([item]);
  applyLocalChange(item);
  notify('annotations', { count: -1 });
}

export async function clearAnnotations(categoryId = null) {
  const targets = getAnnotations(categoryId);
  const changes = targets.map((item) => change('annotations', item.entryId, item, null));
  await writeChangesWithoutHistory(changes);
  changes.forEach(applyLocalChange);
  notify('annotations', { cleared: targets.length });
  return targets.length;
}

export async function undo() {
  const record = await undoHistory();
  if (!record) return null;
  await initializeStore();
  notify('history', { direction: 'undo', label: record.label });
  return record;
}

export async function redo() {
  const record = await redoHistory();
  if (!record) return null;
  await initializeStore();
  notify('history', { direction: 'redo', label: record.label });
  return record;
}

export async function replaceAnnotationsForEntries(entryIds, items) {
  const targetIds = new Set(entryIds);
  const incoming = new Map(items.map((item) => [item.entryId, item]));
  const changes = [];
  for (const entryId of targetIds) {
    const entry = getEntry(entryId);
    if (!entry) continue;
    const before = state.annotations.get(entryId) ?? null;
    const item = incoming.get(entryId);
    const after = item ? {
      entryId, categoryId: entry.categoryId, createdAt: new Date().toISOString(),
      spelling: item.spelling ?? null, pos: item.pos ?? null, reason: String(item.reason ?? '').slice(0, 500),
    } : null;
    pushChange(changes, 'annotations', entryId, before, after);
  }
  await writeChangesWithoutHistory(changes);
  changes.forEach(applyLocalChange);
  notify('annotations', { replaced: targetIds.size, issues: incoming.size });
}
