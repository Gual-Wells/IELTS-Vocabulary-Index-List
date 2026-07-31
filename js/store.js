import {
  commitChanges, getSetting, historyStatus, readDatabaseSnapshot, redoHistory, setSetting,
  undoHistory, writeChangesWithoutHistory,
} from './db.js';
import { APP_VERSION, HISTORY_LIMIT, INSTANCE_CHANNEL_NAME, MAX_CATEGORY_NAME_LENGTH, MAX_WORD_LENGTH } from './constants.js';
import { containsControlCharacters, deepClone, formatPos, mergePos, normalizeCategoryName, normalizeWord, parsePos, sortPos, uuid } from './utils.js';
import { applyManualEntryEdit, mergeEntrySource, recalculateEntry } from './entry-model.js';
import { canonicalizeBackup, validateBackup } from './import-export.js';

const state = {
  categories: [],
  entries: new Map(),
  pins: new Map(),
  annotations: new Map(),
  settings: {},
  history: { canUndo: false, canRedo: false, pointer: 0 },
};
const listeners = new Set();
let mutationTail = Promise.resolve();
let wordIndex = new Map();
let categoryIndex = new Map();
let coordinationChannel = null;
let coordinationStarted = false;
const instanceId = uuid('instance');

function broadcastDataChange(label = 'change') {
  try { coordinationChannel?.postMessage({ type: 'data-changed', instanceId, label, at: Date.now() }); }
  catch (error) { console.warn('跨实例通知失败', error); }
}

function orderedCategories(categories = state.categories) {
  return [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
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
  for (const listener of listeners) {
    try {
      const result = listener({ type, detail, state });
      if (result && typeof result.catch === 'function') result.catch((error) => console.error('状态订阅器执行失败', error));
    } catch (error) {
      console.error('状态订阅器执行失败', error);
    }
  }
}

function entityMap(store) {
  if (store === 'entries') return state.entries;
  if (store === 'pins') return state.pins;
  if (store === 'annotations') return state.annotations;
  return null;
}

function applyLocalChange(change) {
  if (change.store === 'settings') {
    if (change.after == null) delete state.settings[change.key];
    else state.settings[change.key] = deepClone(change.after.value);
    return;
  }
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

function currentEntityValue(store, key) {
  if (store === 'settings') {
    return Object.hasOwn(state.settings, key) ? { key, value: deepClone(state.settings[key]) } : null;
  }
  if (store === 'categories') return state.categories.find((item) => item.id === key) ?? null;
  return entityMap(store)?.get(key) ?? null;
}

function coalesceChanges(changes) {
  const merged = new Map();
  for (const item of changes.filter(Boolean)) {
    const compoundKey = `${item.store}::${item.key}`;
    const existing = merged.get(compoundKey);
    if (!existing) merged.set(compoundKey, deepClone(item));
    else existing.after = item.after == null ? null : deepClone(item.after);
  }
  return [...merged.values()].filter((item) => JSON.stringify(item.before) !== JSON.stringify(item.after));
}


function normalizePinOrderChanges(changes) {
  const workingPins = new Map([...state.pins].map(([id, pin]) => [id, deepClone(pin)]));
  for (const item of changes.filter((changeItem) => changeItem?.store === 'pins')) {
    if (item.after == null) workingPins.delete(item.key);
    else workingPins.set(item.key, deepClone(item.after));
  }
  const groups = new Map();
  for (const pin of workingPins.values()) {
    if (!groups.has(pin.categoryId)) groups.set(pin.categoryId, []);
    groups.get(pin.categoryId).push(pin);
  }
  for (const pins of groups.values()) {
    pins.sort((a, b) => Number(a.order) - Number(b.order)
      || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
      || String(a.id).localeCompare(String(b.id)));
    pins.forEach((pin, order) => {
      if (Number(pin.order) === order) return;
      const priorPlanned = changes.findLast?.((item) => item?.store === 'pins' && item.key === pin.id);
      const before = priorPlanned?.after ?? state.pins.get(pin.id) ?? null;
      pushChange(changes, 'pins', pin.id, before, { ...pin, order });
      pin.order = order;
    });
  }
}

function assertChangesAreFresh(changes) {
  for (const item of changes) {
    const current = currentEntityValue(item.store, item.key);
    if (JSON.stringify(current) !== JSON.stringify(item.before)) {
      throw new Error('数据已被另一个操作更新，本次操作已安全取消。请重试。');
    }
  }
}

/**
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function enqueueMutation(task) {
  const run = mutationTail.then(task, task);
  mutationTail = run.catch(() => undefined);
  return run;
}

async function commitWithinQueue(label, changes, detail = {}) {
  normalizePinOrderChanges(changes);
  const filtered = coalesceChanges(changes);
  if (!filtered.length) return false;
  assertChangesAreFresh(filtered);
  const result = await commitChanges(label, filtered, state.settings.dataRevision);
  if (!result || result.revision == null) throw new Error('数据库事务未返回有效修订号');
  try {
    filtered.forEach(applyLocalChange);
    state.settings.dataRevision = Number(result.revision);
    rebuildIndexes();
    await refreshHistoryStatus();
  } catch (error) {
    await loadStateFromDatabase();
    throw new Error(`数据库已提交，但内存状态刷新失败并已重新载入：${error?.message || error}`);
  }
  notify('change', { label, ...detail });
  broadcastDataChange(label);
  return true;
}

async function applyWithoutHistoryWithinQueue(changes, notificationType, detail = {}) {
  normalizePinOrderChanges(changes);
  const filtered = coalesceChanges(changes);
  if (!filtered.length) return false;
  assertChangesAreFresh(filtered);
  const result = await writeChangesWithoutHistory(filtered, state.settings.dataRevision);
  if (!result || result.revision == null) throw new Error('数据库事务未返回有效修订号');
  try {
    filtered.forEach(applyLocalChange);
    state.settings.dataRevision = Number(result.revision);
    rebuildIndexes();
  } catch (error) {
    await loadStateFromDatabase();
    throw new Error(`数据库已提交，但内存状态刷新失败并已重新载入：${error?.message || error}`);
  }
  notify(notificationType, detail);
  broadcastDataChange(notificationType);
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
  for (const [key, value] of Object.entries(state.settings)) {
    if (!key.startsWith('lastPosition:') || value !== beforeId) continue;
    const categoryId = key.slice('lastPosition:'.length);
    if (after?.categoryId === categoryId) continue;
    pushChange(changes, 'settings', key, { key, value }, null);
  }
  const annotation = annotationForEntry(beforeId);
  if (annotation) {
    if (after == null || wordOrPosChanged) pushChange(changes, 'annotations', beforeId, annotation, null);
    else if (annotation.categoryId !== after.categoryId) pushChange(changes, 'annotations', beforeId, annotation, { ...annotation, categoryId: after.categoryId });
  }
}


function preserveTimestampForNoop(before, after) {
  if (!before || !after) return after;
  const comparableBefore = { ...deepClone(before), updatedAt: null };
  const comparableAfter = { ...deepClone(after), updatedAt: null };
  return JSON.stringify(comparableBefore) === JSON.stringify(comparableAfter) ? deepClone(before) : after;
}

function uniqueCategoryName(name, exceptId = null) {
  const normalized = normalizeCategoryName(name);
  return !state.categories.some((category) => category.id !== exceptId && normalizeCategoryName(category.name) === normalized);
}

function createEntry(categoryId, word, pos) {
  const now = new Date().toISOString();
  const normalizedWord = normalizeWord(word);
  const entry = {
    id: uuid('e'), word: String(word).trim(), normalizedWord,
    sources: { [categoryId]: { word: String(word).trim(), pos: sortPos(pos) } },
    manualWord: null, manualPos: null, categoryId, pos: sortPos(pos), createdAt: now, updatedAt: now,
  };
  return recalculateEntry(entry, state.categories);
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

async function loadStateFromDatabase({ validateIntegrity = true } = {}) {
  const snapshot = await readDatabaseSnapshot();
  const { categories, entries, pins, annotations } = snapshot;
  const loadedSettings = Object.fromEntries(snapshot.settings.map((record) => [record.key, deepClone(record.value)]));
  if (validateIntegrity) validateBackup({
    schemaVersion: 1,
    categories,
    entries,
    pins,
    annotations,
    settings: { numberMode: loadedSettings.numberMode ?? 'none', historyLimit: loadedSettings.historyLimit ?? HISTORY_LIMIT },
  });
  state.categories = orderedCategories(categories);
  state.entries = new Map(entries.map((entry) => [entry.id, entry]));
  state.pins = new Map(pins.map((pin) => [pin.id, pin]));
  state.annotations = new Map(annotations.map((annotation) => [annotation.entryId, annotation]));
  state.settings = loadedSettings;
  state.settings.numberMode = state.settings.numberMode ?? 'none';
  state.settings.historyLimit = state.settings.historyLimit ?? HISTORY_LIMIT;
  state.settings.appVersion = APP_VERSION;
  state.settings.dataRevision = Number(state.settings.dataRevision ?? 0);
  const historyPointer = Number(state.settings.historyPointer ?? 0);
  const historySequences = new Set(snapshot.history.map((record) => Number(record.sequence)));
  state.history = {
    canUndo: historyPointer > 0 && historySequences.has(historyPointer),
    canRedo: historySequences.has(historyPointer + 1),
    pointer: historyPointer,
  };
  rebuildIndexes();
}

export async function initializeStore() {
  await loadStateFromDatabase();
  notify('initialized');
}

export function reloadStoreFromDatabase(reason = 'external') {
  return enqueueMutation(async () => {
    if (reason !== 'force') {
      const [latestRevision, latestNumberMode] = await Promise.all([
        getSetting('dataRevision', 0),
        getSetting('numberMode', 'none'),
      ]);
      if (Number(latestRevision) === Number(state.settings.dataRevision)
          && latestNumberMode === state.settings.numberMode) return false;
    }
    await loadStateFromDatabase();
    notify('external-change', { reason });
    return true;
  });
}

export function initializeInstanceCoordination() {
  if (coordinationStarted) return;
  coordinationStarted = true;
  if (typeof BroadcastChannel === 'function') {
    coordinationChannel = new BroadcastChannel(INSTANCE_CHANNEL_NAME);
    coordinationChannel.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.instanceId === instanceId || message.type !== 'data-changed') return;
      reloadStoreFromDatabase('broadcast').catch((error) => console.error('重新载入其他实例的修改失败', error));
    });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reloadStoreFromDatabase('visibility').catch((error) => console.error('回到前台时重新载入失败', error));
      }
    });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) reloadStoreFromDatabase('pageshow').catch((error) => console.error('页面恢复时重新载入失败', error));
    });
  }
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
    .sort((a, b) => a.order - b.order || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
}

export function addCategory(name) {
  return enqueueMutation(async () => {
    const clean = String(name ?? '').trim();
    if (!clean || !normalizeCategoryName(clean)) throw new Error('词表名称不能为空或仅包含不可见字符');
    if (containsControlCharacters(clean)) throw new Error('词表名称不能包含换行或控制字符');
    if (clean.length > MAX_CATEGORY_NAME_LENGTH) throw new Error(`词表名称不能超过 ${MAX_CATEGORY_NAME_LENGTH} 个字符`);
    if (!uniqueCategoryName(clean)) throw new Error('词表名称已存在');
    const now = new Date().toISOString();
    const nextOrder = state.categories.reduce((max, category) => Math.max(max, Number(category.order) || 0), -1) + 1;
    const category = { id: uuid('cat'), name: clean, label: clean, order: nextOrder, createdAt: now, updatedAt: now };
    await commitWithinQueue(`新增词表 ${clean}`, [change('categories', category.id, null, category)]);
    return category;
  });
}

export function renameCategory(categoryId, name) {
  return enqueueMutation(async () => {
    const before = getCategory(categoryId);
    if (!before) throw new Error('词表不存在');
    const clean = String(name ?? '').trim();
    if (!clean || !normalizeCategoryName(clean)) throw new Error('词表名称不能为空或仅包含不可见字符');
    if (containsControlCharacters(clean)) throw new Error('词表名称不能包含换行或控制字符');
    if (clean.length > MAX_CATEGORY_NAME_LENGTH) throw new Error(`词表名称不能超过 ${MAX_CATEGORY_NAME_LENGTH} 个字符`);
    if (!uniqueCategoryName(clean, categoryId)) throw new Error('词表名称已存在');
    if (clean === before.name && clean === before.label) return false;
    const after = { ...before, name: clean, label: clean, updatedAt: new Date().toISOString() };
    await commitWithinQueue(`重命名词表 ${before.name}`, [change('categories', categoryId, before, after)]);
  });
}

export function moveCategory(categoryId, direction) {
  return enqueueMutation(async () => {
    if (![-1, 1].includes(direction)) throw new Error('无效的词表移动方向');
    const categories = orderedCategories();
    const index = categories.findIndex((category) => category.id === categoryId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return false;
    [categories[index], categories[targetIndex]] = [categories[targetIndex], categories[index]];
    const now = new Date().toISOString();
    const updatedCategories = categories.map((category, order) => Number(category.order) === order
      ? category
      : { ...category, order, updatedAt: now });
    const changes = [];
    for (const updated of updatedCategories) pushChange(changes, 'categories', updated.id, getCategory(updated.id), updated);
    const working = cloneEntriesMap();
    const affected = new Set();
    for (const [id, entry] of working) {
      const recalculated = recalculateEntry(entry, updatedCategories);
      if (recalculated && (recalculated.categoryId !== entry.categoryId || recalculated.word !== entry.word)) {
        working.set(id, recalculated);
        affected.add(id);
      }
    }
    syncAffectedEntriesToChanges(working, affected, changes);
    await commitWithinQueue('调整词表优先级', changes);
    return true;
  });
}

export function deleteCategory(categoryId) {
  return enqueueMutation(async () => {
    if (state.categories.length <= 1) throw new Error('至少需要保留一个词表');
    const category = getCategory(categoryId);
    if (!category) throw new Error('词表不存在');
    const remainingCategories = orderedCategories()
      .filter((item) => item.id !== categoryId)
      .map((item, order) => ({ ...item, order, updatedAt: new Date().toISOString() }));
    const changes = [change('categories', categoryId, category, null)];
    const lastPositionKey = `lastPosition:${categoryId}`;
    if (Object.hasOwn(state.settings, lastPositionKey)) {
      pushChange(changes, 'settings', lastPositionKey, { key: lastPositionKey, value: state.settings[lastPositionKey] }, null);
    }
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
    await commitWithinQueue(`删除词表 ${category.name}`, changes);
  });
}

export function addWord(categoryId, word, posValue) {
  return enqueueMutation(async () => {
    if (!getCategory(categoryId)) throw new Error('目标词表不存在');
    const cleanWord = String(word ?? '').trim();
    const normalized = normalizeWord(cleanWord);
    const pos = Array.isArray(posValue) ? parsePos(posValue.join(', ')) : parsePos(posValue);
    if (!normalized) throw new Error('词汇不能为空');
    if (containsControlCharacters(cleanWord)) throw new Error('词汇不能包含换行或控制字符');
    if (cleanWord.length > MAX_WORD_LENGTH) throw new Error(`词汇不能超过 ${MAX_WORD_LENGTH} 个字符`);
    if (!pos.length) throw new Error('词性不能为空');
    const existingId = wordIndex.get(normalized);
    const changes = [];
    if (!existingId) {
      const entry = createEntry(categoryId, cleanWord, pos);
      await commitWithinQueue(`新增词汇 ${cleanWord}`, [change('entries', entry.id, null, entry)]);
      return { entry, created: true, merged: false };
    }
    const before = state.entries.get(existingId);
    const recalculated = preserveTimestampForNoop(
      before,
      mergeEntrySource(before, categoryId, { word: cleanWord, pos }, state.categories),
    );
    pushChange(changes, 'entries', before.id, before, recalculated);
    addDependentEntryChanges(changes, before, recalculated);
    await commitWithinQueue(`合并重复词 ${cleanWord}`, changes);
    return { entry: recalculated, created: false, merged: true, moved: before.categoryId !== recalculated.categoryId };
  });
}

export function editEntry(entryId, word, posValue, { expectedUpdatedAt = null } = {}) {
  return enqueueMutation(async () => {
    const before = getEntry(entryId);
    if (!before) throw new Error('词汇不存在');
    if (expectedUpdatedAt && before.updatedAt !== expectedUpdatedAt) {
      throw new Error('该词汇已在另一个页面中更新，请重新打开编辑窗口。');
    }
    const cleanWord = String(word ?? '').trim();
    const normalized = normalizeWord(cleanWord);
    const pos = Array.isArray(posValue) ? parsePos(posValue.join(', ')) : parsePos(posValue);
    if (!normalized || !pos.length) throw new Error('词汇和词性不能为空');
    if (containsControlCharacters(cleanWord)) throw new Error('词汇不能包含换行或控制字符');
    if (cleanWord.length > MAX_WORD_LENGTH) throw new Error(`词汇不能超过 ${MAX_WORD_LENGTH} 个字符`);
    const duplicateId = wordIndex.get(normalized);
    if (duplicateId && duplicateId !== entryId) {
      const targetBefore = getEntry(duplicateId);
      const targetAfter = deepClone(targetBefore);
      for (const [sourceCategoryId, source] of Object.entries(before.sources ?? {})) {
        const existingSource = targetAfter.sources[sourceCategoryId] ?? { word: cleanWord, pos: [] };
        existingSource.pos = mergePos(existingSource.pos, source.pos ?? []);
        targetAfter.sources[sourceCategoryId] = existingSource;
      }
      targetAfter.manualWord = cleanWord;
      targetAfter.manualPos = mergePos(targetBefore.pos, before.pos, pos);
      const merged = recalculateEntry(targetAfter, state.categories);
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
      for (const [key, value] of Object.entries(state.settings)) {
        if (!key.startsWith('lastPosition:') || value !== before.id) continue;
        const settingCategoryId = key.slice('lastPosition:'.length);
        const beforeSetting = { key, value };
        const afterSetting = merged.categoryId === settingCategoryId ? { key, value: targetBefore.id } : null;
        pushChange(changes, 'settings', key, beforeSetting, afterSetting);
      }
      await commitWithinQueue(`合并词汇 ${cleanWord}`, changes);
      return { entry: merged, merged: true };
    }
    const after = applyManualEntryEdit(before, cleanWord, pos, state.categories);
    const changes = [];
    pushChange(changes, 'entries', entryId, before, after);
    addDependentEntryChanges(changes, before, after);
    await commitWithinQueue(`编辑词汇 ${before.word}`, changes);
    return { entry: after, merged: false };
  });
}

export function removeEntryFromCategory(entryId, categoryId) {
  return enqueueMutation(async () => {
    const before = getEntry(entryId);
    if (!before) throw new Error('词汇不存在');
    if (!before.sources?.[categoryId]) throw new Error('该词汇不属于当前词表来源');
    const working = deepClone(before);
    delete working.sources[categoryId];
    const after = recalculateEntry(working, state.categories);
    const changes = [];
    pushChange(changes, 'entries', entryId, before, after);
    addDependentEntryChanges(changes, before, after);
    await commitWithinQueue(`从词表移除 ${before.word}`, changes);
    return after;
  });
}

export function deleteEntryGlobally(entryId) {
  return enqueueMutation(async () => {
    const before = getEntry(entryId);
    if (!before) return false;
    const changes = [change('entries', entryId, before, null)];
    addDependentEntryChanges(changes, before, null);
    await commitWithinQueue(`全局删除 ${before.word}`, changes);
    return true;
  });
}

export function togglePin(entryId) {
  return enqueueMutation(async () => {
    const entry = getEntry(entryId);
    if (!entry) throw new Error('词汇不存在');
    const existing = pinsForEntry(entryId)[0];
    if (existing) {
      await commitWithinQueue(`取消书签 ${entry.word}`, [change('pins', existing.id, existing, null)]);
      return false;
    }
    const categoryPins = getPins(entry.categoryId);
    const pin = {
      id: uuid('pin'), entryId, categoryId: entry.categoryId,
      order: categoryPins.reduce((max, item) => Math.max(max, Number(item.order) || 0), -1) + 1,
      createdAt: new Date().toISOString(),
    };
    await commitWithinQueue(`固定书签 ${entry.word}`, [change('pins', pin.id, null, pin)]);
    return true;
  });
}

function simulateImport(categoryId, importedEntries, mode) {
  if (!getCategory(categoryId)) throw new Error('目标词表不存在');
  const working = cloneEntriesMap();
  const affected = new Set();
  const workingWordIndex = new Map([...working.values()].map((entry) => [entry.normalizedWord, entry.id]));
  const importedByWord = new Map();
  for (const item of importedEntries) {
    const rawWord = String(item?.word ?? '').trim();
    const normalized = normalizeWord(rawWord);
    if (!normalized) continue;
    if (containsControlCharacters(rawWord)) throw new Error(`导入词汇 ${rawWord} 包含换行或控制字符`);
    if (rawWord.length > MAX_WORD_LENGTH) throw new Error(`导入词汇不能超过 ${MAX_WORD_LENGTH} 个字符`);
    const importedPos = parsePos(Array.isArray(item?.pos) ? item.pos.join(', ') : item?.pos);
    if (!importedPos.length) throw new Error(`导入词汇 ${rawWord} 缺少有效词性`);
    const before = importedByWord.get(normalized);
    if (!before) importedByWord.set(normalized, { word: rawWord, pos: importedPos });
    else before.pos = mergePos(before.pos, importedPos);
  }
  const canonicalImported = [...importedByWord.values()];
  const consumed = new Set();
  const stats = { input: canonicalImported.length, created: 0, merged: 0, retained: 0, movedToCurrent: 0, removedSources: 0, deleted: 0 };

  if (mode === 'replace') {
    for (const [id, entry] of working) {
      if (!entry.sources?.[categoryId]) continue;
      const replacement = importedByWord.get(entry.normalizedWord);
      if (replacement) {
        const beforeOwner = entry.categoryId;
        entry.sources[categoryId] = { word: replacement.word, pos: sortPos(replacement.pos) };
        if (entry.manualPos?.length) entry.manualPos = mergePos(entry.manualPos, replacement.pos);
        const recalculated = preserveTimestampForNoop(
          state.entries.get(id),
          recalculateEntry(entry, state.categories),
        );
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
      const recalculated = recalculateEntry(entry, state.categories);
      if (recalculated) working.set(id, recalculated);
      else { working.delete(id); workingWordIndex.delete(entry.normalizedWord); stats.deleted += 1; }
      affected.add(id);
    }
  }

  for (const item of canonicalImported) {
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
    const recalculated = preserveTimestampForNoop(
      beforeMerge,
      mergeEntrySource(beforeMerge, categoryId, item, state.categories),
    );
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

export function importIntoCategory(categoryId, importedEntries, mode) {
  return enqueueMutation(async () => {
    if (!['merge', 'replace'].includes(mode)) throw new Error('无效导入方式');
    const plan = simulateImport(categoryId, importedEntries, mode);
    await commitWithinQueue(mode === 'replace' ? '替换当前词表' : '合并导入当前词表', plan.changes, { importStats: plan.stats });
    return plan.stats;
  });
}

export function createBackup() {
  return canonicalizeBackup({
    schemaVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    categories: getCategories().map(deepClone),
    entries: getAllEntries().map(deepClone),
    pins: [...state.pins.values()].map(deepClone),
    annotations: [...state.annotations.values()].map(deepClone),
    settings: { numberMode: state.settings.numberMode, historyLimit: state.settings.historyLimit },
  });
}

export function restoreBackup(backup, { label = '恢复完整备份' } = {}) {
  validateBackup(backup);
  const canonical = canonicalizeBackup(backup);
  return enqueueMutation(async () => {
    const nextCategories = new Map((canonical.categories ?? []).map((item) => [item.id, deepClone(item)]));
    const nextEntries = new Map((canonical.entries ?? []).map((item) => [item.id, deepClone(item)]));
    const nextPins = new Map((canonical.pins ?? []).map((item) => [item.id, deepClone(item)]));
    const nextAnnotations = new Map((canonical.annotations ?? []).map((item) => [item.entryId, deepClone(item)]));
    const changes = [];
    const mapSpecs = [
      { store: 'categories', beforeMap: new Map(state.categories.map((item) => [item.id, item])), afterMap: nextCategories },
      { store: 'entries', beforeMap: state.entries, afterMap: nextEntries },
      { store: 'pins', beforeMap: state.pins, afterMap: nextPins },
      { store: 'annotations', beforeMap: state.annotations, afterMap: nextAnnotations },
    ];
    for (const { store, beforeMap, afterMap } of mapSpecs) {
      const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
      for (const key of keys) pushChange(changes, store, key, beforeMap.get(key) ?? null, afterMap.get(key) ?? null);
    }
    for (const [key, value] of Object.entries(state.settings)) {
      if (key.startsWith('lastPosition:')) pushChange(changes, 'settings', key, { key, value }, null);
    }
    const backupNumberMode = canonical.settings?.numberMode;
    if (backupNumberMode != null) {
      if (!['none', 'group', 'global'].includes(backupNumberMode)) throw new Error('备份包含无效序号模式');
      pushChange(
        changes,
        'settings',
        'numberMode',
        { key: 'numberMode', value: state.settings.numberMode },
        { key: 'numberMode', value: backupNumberMode },
      );
    }
    return commitWithinQueue(label, changes);
  });
}

export async function setNumberMode(mode) {
  if (!['none', 'group', 'global'].includes(mode)) throw new Error('无效序号模式');
  return enqueueMutation(async () => {
    if (state.settings.numberMode === mode) return false;
    await setSetting('numberMode', mode);
    state.settings.numberMode = mode;
    notify('settings', { numberMode: mode });
    broadcastDataChange('序号设置');
  });
}

export function saveLastPosition(categoryId, entryId) {
  return enqueueMutation(async () => {
    const entry = getEntry(entryId);
    if (!categoryId || !entry || entry.categoryId !== categoryId) return false;
    const key = `lastPosition:${categoryId}`;
    await setSetting(key, entryId);
    state.settings[key] = entryId;
    return true;
  });
}

export function createFreshBackup() {
  return enqueueMutation(async () => {
    const previousRevision = Number(state.settings.dataRevision ?? 0);
    await loadStateFromDatabase();
    if (Number(state.settings.dataRevision ?? 0) !== previousRevision) {
      notify('external-change', { reason: 'export' });
    }
    return createBackup();
  });
}

export function getLastPosition(categoryId) { return getSetting(`lastPosition:${categoryId}`, null); }
export function dismissAnnotation(entryId) {
  return enqueueMutation(async () => {
    const before = state.annotations.get(entryId);
    if (!before) return false;
    const item = change('annotations', entryId, before, null);
    await applyWithoutHistoryWithinQueue([item], 'annotations', { count: -1 });
    return true;
  });
}

export function clearAnnotations(categoryId = null) {
  return enqueueMutation(async () => {
    const targets = getAnnotations(categoryId);
    const changes = targets.map((item) => change('annotations', item.entryId, item, null));
    await applyWithoutHistoryWithinQueue(changes, 'annotations', { cleared: targets.length });
    return targets.length;
  });
}



function assertCurrentStateIntegrity() {
  validateBackup({
    schemaVersion: 1,
    categories: state.categories,
    entries: [...state.entries.values()],
    pins: [...state.pins.values()],
    annotations: [...state.annotations.values()],
    settings: { numberMode: state.settings.numberMode, historyLimit: state.settings.historyLimit },
  });
}

function postHistoryCleanupChanges(record) {
  const changes = [];
  const semanticEntryChanges = new Set((record?.changes ?? [])
    .filter((item) => item.store === 'entries' && (
      item.before == null || item.after == null
      || item.before.word !== item.after.word
      || formatPos(item.before.pos) !== formatPos(item.after.pos)
    ))
    .map((item) => item.key));
  for (const annotation of state.annotations.values()) {
    const entry = state.entries.get(annotation.entryId);
    if (!entry || semanticEntryChanges.has(annotation.entryId)) {
      // AI 标注只对应生成时的词形和词性；撤销/重做改变语义后必须丢弃，避免陈旧标注误导。
      pushChange(changes, 'annotations', annotation.entryId, annotation, null);
      continue;
    }
    if (annotation.categoryId !== entry.categoryId) {
      pushChange(changes, 'annotations', entry.id, annotation, { ...annotation, categoryId: entry.categoryId });
    }
  }

  for (const pin of state.pins.values()) {
    const entry = state.entries.get(pin.entryId);
    if (!entry) pushChange(changes, 'pins', pin.id, pin, null);
    else if (pin.categoryId !== entry.categoryId) {
      pushChange(changes, 'pins', pin.id, pin, { ...pin, categoryId: entry.categoryId });
    }
  }

  for (const [key, value] of Object.entries(state.settings)) {
    if (!key.startsWith('lastPosition:')) continue;
    const categoryId = key.slice('lastPosition:'.length);
    const entry = state.entries.get(value);
    if (!entry || entry.categoryId !== categoryId) {
      pushChange(changes, 'settings', key, { key, value }, null);
    }
  }
  return changes;
}

export async function undo() {
  return enqueueMutation(async () => {
    const record = await undoHistory(state.settings.dataRevision);
    if (!record) return null;
    await loadStateFromDatabase({ validateIntegrity: false });
    const cleanup = postHistoryCleanupChanges(record);
    if (cleanup.length) await applyWithoutHistoryWithinQueue(cleanup, 'integrity-cleanup', { after: 'undo' });
    assertCurrentStateIntegrity();
    notify('history', { direction: 'undo', label: record.label });
    broadcastDataChange(`撤销：${record.label}`);
    return record;
  });
}

export async function redo() {
  return enqueueMutation(async () => {
    const record = await redoHistory(state.settings.dataRevision);
    if (!record) return null;
    await loadStateFromDatabase({ validateIntegrity: false });
    const cleanup = postHistoryCleanupChanges(record);
    if (cleanup.length) await applyWithoutHistoryWithinQueue(cleanup, 'integrity-cleanup', { after: 'redo' });
    assertCurrentStateIntegrity();
    notify('history', { direction: 'redo', label: record.label });
    broadcastDataChange(`重做：${record.label}`);
    return record;
  });
}

export function replaceAnnotationsForEntries(entryIds, items) {
  const requestedIds = [...new Set(entryIds.map(String))];
  const incomingItems = deepClone(items);
  return enqueueMutation(async () => {
    const targetIds = new Set(requestedIds);
    const incoming = new Map(incomingItems.map((item) => [item.entryId, item]));
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
    await applyWithoutHistoryWithinQueue(changes, 'annotations', { replaced: targetIds.size, issues: incoming.size });
  });
}

