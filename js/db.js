import {
  APP_VERSION, DB_NAME, DB_VERSION, HISTORY_LIMIT, HISTORY_SIZE_LIMIT, UI_STATE_VERSION,
} from './constants.js';
import { approximateJsonSize, normalizeWord } from './utils.js';
import { canonicalizeBackup, validateBackup } from './import-export.js';

const ENTITY_STORES = ['categories', 'entries', 'pins', 'annotations'];
const ALL_MUTABLE_STORES = [...ENTITY_STORES, 'settings'];
let databasePromise;
let writeTail = Promise.resolve();

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务已中止'));
  });
}

function enqueueWrite(task) {
  const run = writeTail.then(task, task);
  writeTail = run.catch(() => undefined);
  return run;
}

function jsonEqual(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('categories')) {
        const store = db.createObjectStore('categories', { keyPath: 'id' });
        store.createIndex('order', 'order', { unique: false });
      }
      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'id' });
        store.createIndex('normalizedWord', 'normalizedWord', { unique: true });
        store.createIndex('categoryId', 'categoryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('pins')) {
        const store = db.createObjectStore('pins', { keyPath: 'id' });
        store.createIndex('categoryId', 'categoryId', { unique: false });
        store.createIndex('entryId', 'entryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('annotations')) {
        const store = db.createObjectStore('annotations', { keyPath: 'entryId' });
        store.createIndex('categoryId', 'categoryId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'sequence' });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      db.addEventListener?.('close', () => { databasePromise = null; });
      resolve(db);
    };
    request.onblocked = () => {
      blocked = true;
      databasePromise = null;
      reject(new Error('数据库升级被其他已打开页面阻止。请关闭此站点的其他标签页或主屏幕应用后重试。'));
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error('无法打开 IndexedDB'));
    };
  });
  return databasePromise;
}

export async function getAll(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const completion = transactionPromise(tx);
  const result = await requestPromise(tx.objectStore(storeName).getAll());
  await completion;
  return result;
}

export async function readDatabaseSnapshot() {
  const storeNames = [...ENTITY_STORES, 'settings', 'history'];
  const db = await openDatabase();
  const tx = db.transaction(storeNames, 'readonly');
  const completion = transactionPromise(tx);
  const requests = Object.fromEntries(storeNames.map((storeName) => [
    storeName,
    requestPromise(tx.objectStore(storeName).getAll()),
  ]));
  const values = await Promise.all(storeNames.map((storeName) => requests[storeName]));
  await completion;
  return Object.fromEntries(storeNames.map((storeName, index) => [storeName, values[index]]));
}

export async function getValue(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const completion = transactionPromise(tx);
  const result = await requestPromise(tx.objectStore(storeName).get(key));
  await completion;
  return result;
}

export async function getSetting(key, fallback = null) {
  const record = await getValue('settings', key);
  return record ? record.value : fallback;
}

async function setSettingRaw(key, value) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  const completion = transactionPromise(tx);
  tx.objectStore('settings').put({ key, value });
  await completion;
}

export function setSetting(key, value) {
  return enqueueWrite(() => setSettingRaw(key, value));
}

function assertSeedShape(seed) {
  if (!seed || !Array.isArray(seed.categories) || !Array.isArray(seed.entries)) {
    throw new Error('种子数据格式无效');
  }
  if (!seed.categories.length || !seed.entries.length) {
    throw new Error('种子数据为空，已拒绝把数据库初始化为空词表');
  }
  validateBackup({ ...seed, pins: seed.pins ?? [], annotations: seed.annotations ?? [] });
}

export async function loadSeedBackup() {
  const seedUrl = new URL('../data/seed.json', import.meta.url);
  let response;
  try {
    response = await fetch(seedUrl, { cache: 'no-store' });
  } catch (error) {
    throw new Error(`无法读取内置词库：${error?.message || error}`);
  }
  if (!response.ok) throw new Error(`无法读取内置词库（HTTP ${response.status}）`);
  const seed = await response.json();
  assertSeedShape(seed);
  return canonicalizeBackup({ ...seed, pins: seed.pins ?? [], annotations: seed.annotations ?? [] });
}

async function replaceDatabaseContents(backup) {
  const canonical = canonicalizeBackup(backup);
  await enqueueWrite(async () => {
    const db = await openDatabase();
    const tx = db.transaction([...ENTITY_STORES, 'settings', 'history'], 'readwrite');
    const completion = transactionPromise(tx);
    for (const storeName of ENTITY_STORES) tx.objectStore(storeName).clear();
    tx.objectStore('settings').clear();
    tx.objectStore('history').clear();
    for (const category of canonical.categories) tx.objectStore('categories').put(category);
    for (const entry of canonical.entries) tx.objectStore('entries').put(entry);
    for (const pin of canonical.pins ?? []) tx.objectStore('pins').put(pin);
    for (const annotation of canonical.annotations ?? []) tx.objectStore('annotations').put(annotation);
    const settings = {
      ...(canonical.settings ?? {}), initialized: true, appVersion: APP_VERSION,
      uiStateVersion: UI_STATE_VERSION, historyPointer: 0, dataRevision: Date.now(),
    };
    for (const [key, value] of Object.entries(settings)) tx.objectStore('settings').put({ key, value });
    await completion;
  });
}

async function seedDatabase() {
  await replaceDatabaseContents(await loadSeedBackup());
}

export async function recoverDatabaseFromBackup(backup) {
  validateBackup(backup);
  await replaceDatabaseContents(backup);
}

export async function resetDatabaseToSeed() {
  await seedDatabase();
}



async function repairLegacyManualWordSources() {
  const entries = await getAll('entries');
  const changes = [];
  for (const entry of entries) {
    const manualWord = String(entry.manualWord ?? '').trim();
    if (!manualWord) continue;
    const expected = normalizeWord(manualWord);
    if (!expected) continue;
    const sources = Object.fromEntries(Object.entries(entry.sources ?? {}).map(([categoryId, source]) => [categoryId, {
      ...source,
      word: normalizeWord(source?.word) === expected ? source.word : manualWord,
    }]));
    const normalizedChanged = normalizeWord(entry.word) !== expected || entry.normalizedWord !== expected;
    const sourcesChanged = Object.entries(sources).some(([categoryId, source]) => source.word !== entry.sources?.[categoryId]?.word);
    if (!normalizedChanged && !sourcesChanged) continue;
    const after = {
      ...entry,
      word: manualWord,
      normalizedWord: expected,
      sources,
      updatedAt: new Date().toISOString(),
    };
    changes.push({ store: 'entries', key: entry.id, before: entry, after });
  }
  if (!changes.length) return;
  const revision = Number(await getSetting('dataRevision', 0));
  await writeChangesWithoutHistory(changes, revision);
}

async function purgeRetiredCloudSettings() {
  const records = await getAll('settings');
  const retired = records.filter((record) => /^cloud(?:[A-Z:]|$)/.test(String(record.key ?? '')));
  if (!retired.length) return;
  await enqueueWrite(async () => {
    const db = await openDatabase();
    const tx = db.transaction('settings', 'readwrite');
    const completion = transactionPromise(tx);
    const store = tx.objectStore('settings');
    for (const record of retired) store.delete(record.key);
    await completion;
  });
}

async function migrateUiStateSettings() {
  const version = Number(await getSetting('uiStateVersion', 0));
  if (version >= UI_STATE_VERSION) return;
  const records = await getAll('settings');
  await enqueueWrite(async () => {
    const db = await openDatabase();
    const tx = db.transaction('settings', 'readwrite');
    const completion = transactionPromise(tx);
    const store = tx.objectStore('settings');
    for (const record of records) {
      if (/^expandedGroups:/.test(record.key)) store.delete(record.key);
    }
    store.put({ key: 'uiStateVersion', value: UI_STATE_VERSION });
    await completion;
  });
}

export async function initializeDatabase() {
  await openDatabase();
  const initialized = await getSetting('initialized', false);
  if (!initialized) await seedDatabase();
  await purgeRetiredCloudSettings();
  await repairLegacyManualWordSources();
  await migrateUiStateSettings();
  await setSetting('appVersion', APP_VERSION);
  if (await getSetting('dataRevision', null) == null) await setSetting('dataRevision', 0);
}

function applyEntityChange(transaction, change, direction = 'after') {
  if (!ALL_MUTABLE_STORES.includes(change.store)) throw new Error(`不支持的变更存储：${change.store}`);
  const store = transaction.objectStore(change.store);
  const value = change[direction];
  if (value == null) store.delete(change.key);
  else store.put(value);
}

function applyChangesBatch(transaction, changes, direction = 'after') {
  const entryChanges = changes.filter((item) => item.store === 'entries');
  if (entryChanges.length) {
    const store = transaction.objectStore('entries');
    // 先删除所有受影响 key，避免两个 normalizedWord 在同一事务中互换时触发瞬时唯一索引冲突。
    for (const item of entryChanges) store.delete(item.key);
    for (const item of entryChanges) {
      const value = item[direction];
      if (value != null) store.put(value);
    }
  }
  for (const item of changes) {
    if (item.store !== 'entries') applyEntityChange(transaction, item, direction);
  }
}

function schedulePreconditionReads(transaction, changes) {
  return changes.map((change) => ({
    change,
    promise: requestPromise(transaction.objectStore(change.store).get(change.key)),
  }));
}

async function verifyPreconditions(reads, expectedDirection) {
  const values = await Promise.all(reads.map((item) => item.promise));
  for (let index = 0; index < reads.length; index += 1) {
    const expected = reads[index].change[expectedDirection] ?? null;
    const actual = values[index] ?? null;
    if (!jsonEqual(actual, expected)) {
      throw new Error('数据已在另一个标签页或主屏幕实例中更新，本次操作已安全取消。页面将重新载入最新本地数据。');
    }
  }
}


function isSoftHistoryChange(change) {
  return change.store === 'annotations'
    || (change.store === 'settings' && (
      String(change.key).startsWith('lastPosition:') || change.key === 'numberMode'
    ));
}

async function resolveApplicableHistoryChanges(reads, expectedDirection) {
  const values = await Promise.all(reads.map((item) => item.promise));
  const applicable = [];
  for (let index = 0; index < reads.length; index += 1) {
    const expected = reads[index].change[expectedDirection] ?? null;
    const actual = values[index] ?? null;
    if (jsonEqual(actual, expected)) applicable.push(reads[index].change);
    else if (!isSoftHistoryChange(reads[index].change)) {
      throw new Error('数据已在另一个标签页或主屏幕实例中更新，本次撤销或重做已安全取消。');
    }
  }
  return applicable;
}

async function pruneHistoryRaw() {
  const [records, pointer] = await Promise.all([getAll('history'), getSetting('historyPointer', 0)]);
  const ordered = records.sort((a, b) => a.sequence - b.sequence);
  let total = ordered.reduce((sum, record) => sum + (record.approximateSize || approximateJsonSize(record)), 0);
  const deletions = [];
  // 始终保留最新事务，使一次大型恢复即使超过软容量上限也仍可撤销。
  while (ordered.length > 1 && (ordered.length > HISTORY_LIMIT || total > HISTORY_SIZE_LIMIT)) {
    const record = ordered.shift();
    if (!record || record.sequence > pointer) break;
    deletions.push(record.sequence);
    total -= record.approximateSize || approximateJsonSize(record);
  }
  if (!deletions.length) return;
  const db = await openDatabase();
  const tx = db.transaction('history', 'readwrite');
  const completion = transactionPromise(tx);
  for (const sequence of deletions) tx.objectStore('history').delete(sequence);
  await completion;
}

export function commitChanges(label, changes, expectedRevision = null) {
  if (!changes.length) return Promise.resolve({ sequence: 0, changed: false, revision: null });
  return enqueueWrite(async () => {
    const stores = [...new Set([...changes.map((change) => change.store), 'history', 'settings'])];
    const db = await openDatabase();
    const tx = db.transaction(stores, 'readwrite');
    const completion = transactionPromise(tx);
    const pointerPromise = requestPromise(tx.objectStore('settings').get('historyPointer'));
    const revisionPromise = requestPromise(tx.objectStore('settings').get('dataRevision'));
    const recordsPromise = requestPromise(tx.objectStore('history').getAll());
    const preconditionReads = schedulePreconditionReads(tx, changes);
    try {
      const [pointerRecord, revisionRecord, records] = await Promise.all([pointerPromise, revisionPromise, recordsPromise]);
      const currentRevision = Number(revisionRecord?.value ?? 0);
      if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
        throw new Error('数据已在另一个标签页或主屏幕实例中更新，本次操作已安全取消。页面将重新载入最新本地数据。');
      }
      await verifyPreconditions(preconditionReads, 'before');
      const pointer = Number(pointerRecord?.value ?? 0);
      const sequence = pointer + 1;
      for (const record of records) {
        if (record.sequence > pointer) tx.objectStore('history').delete(record.sequence);
      }
      applyChangesBatch(tx, changes, 'after');
      const historyRecord = {
        sequence, label, createdAt: new Date().toISOString(), changes,
        approximateSize: approximateJsonSize(changes),
      };
      tx.objectStore('history').put(historyRecord);
      tx.objectStore('settings').put({ key: 'historyPointer', value: sequence });
      tx.objectStore('settings').put({ key: 'dataRevision', value: currentRevision + 1 });
      await completion;
      await pruneHistoryRaw().catch((error) => console.warn('历史清理失败，不影响已完成的数据事务。', error));
      return { sequence, changed: true, revision: currentRevision + 1 };
    } catch (error) {
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
      await completion.catch(() => undefined);
      throw error;
    }
  });
}

export async function historyStatus() {
  const pointer = Number(await getSetting('historyPointer', 0));
  const records = await getAll('history');
  const sequences = new Set(records.map((record) => record.sequence));
  return { canUndo: pointer > 0 && sequences.has(pointer), canRedo: sequences.has(pointer + 1), pointer };
}

async function applyHistoryRecordRaw(record, direction, expectedPointer, nextPointer, expectedRevision = null) {
  const stores = [...new Set([...ALL_MUTABLE_STORES, 'history'])];
  const db = await openDatabase();
  const tx = db.transaction(stores, 'readwrite');
  const completion = transactionPromise(tx);
  const pointerPromise = requestPromise(tx.objectStore('settings').get('historyPointer'));
  const revisionPromise = requestPromise(tx.objectStore('settings').get('dataRevision'));
  const preconditionReads = schedulePreconditionReads(tx, record.changes);
  const expectedDirection = direction === 'before' ? 'after' : 'before';
  try {
    const [pointerRecord, revisionRecord] = await Promise.all([pointerPromise, revisionPromise]);
    const currentRevision = Number(revisionRecord?.value ?? 0);
    if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
      throw new Error('数据已在另一个标签页或主屏幕实例中更新，本次撤销或重做已安全取消。');
    }
    if (Number(pointerRecord?.value ?? 0) !== expectedPointer) {
      throw new Error('撤销历史已被另一个实例更新，本次操作已安全取消。');
    }
    const applicableChanges = await resolveApplicableHistoryChanges(preconditionReads, expectedDirection);
    applyChangesBatch(tx, applicableChanges, direction);
    tx.objectStore('settings').put({ key: 'historyPointer', value: nextPointer });
    tx.objectStore('settings').put({ key: 'dataRevision', value: currentRevision + 1 });
    await completion;
  } catch (error) {
    try { tx.abort(); } catch { /* no-op */ }
    await completion.catch(() => undefined);
    throw error;
  }
}

/** @returns {Promise<any|null>} */
export function undoHistory(expectedRevision = null) {
  return enqueueWrite(async () => {
    const pointer = Number(await getSetting('historyPointer', 0));
    if (pointer <= 0) return null;
    const record = await getValue('history', pointer);
    if (!record) return null;
    await applyHistoryRecordRaw(record, 'before', pointer, pointer - 1, expectedRevision);
    return record;
  });
}

/** @returns {Promise<any|null>} */
export function redoHistory(expectedRevision = null) {
  return enqueueWrite(async () => {
    const pointer = Number(await getSetting('historyPointer', 0));
    const record = await getValue('history', pointer + 1);
    if (!record) return null;
    await applyHistoryRecordRaw(record, 'after', pointer, pointer + 1, expectedRevision);
    return record;
  });
}

export function writeChangesWithoutHistory(changes, expectedRevision = null) {
  if (!changes.length) return Promise.resolve({ changed: false, revision: null });
  return enqueueWrite(async () => {
    const stores = [...new Set([...changes.map((change) => change.store), 'settings'])];
    const db = await openDatabase();
    const tx = db.transaction(stores, 'readwrite');
    const completion = transactionPromise(tx);
    const revisionPromise = requestPromise(tx.objectStore('settings').get('dataRevision'));
    const preconditionReads = schedulePreconditionReads(tx, changes);
    try {
      const revisionRecord = await revisionPromise;
      const currentRevision = Number(revisionRecord?.value ?? 0);
      if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
        throw new Error('数据已在另一个标签页或主屏幕实例中更新，本次操作已安全取消。页面将重新载入最新本地数据。');
      }
      await verifyPreconditions(preconditionReads, 'before');
      applyChangesBatch(tx, changes, 'after');
      tx.objectStore('settings').put({ key: 'dataRevision', value: currentRevision + 1 });
      await completion;
      return { revision: currentRevision + 1 };
    } catch (error) {
      try { tx.abort(); } catch { /* no-op */ }
      await completion.catch(() => undefined);
      throw error;
    }
  });
}
