import { APP_VERSION, DB_NAME, DB_VERSION, HISTORY_LIMIT, HISTORY_SIZE_LIMIT } from './constants.js';
import { approximateJsonSize } from './utils.js';

const ENTITY_STORES = ['categories', 'entries', 'pins', 'annotations'];
let databasePromise;

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

export function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
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
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('无法打开 IndexedDB'));
  });
  return databasePromise;
}

export async function getAll(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestPromise(tx.objectStore(storeName).getAll());
  await transactionPromise(tx);
  return result;
}

export async function getValue(storeName, key) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestPromise(tx.objectStore(storeName).get(key));
  await transactionPromise(tx);
  return result;
}

export async function getSetting(key, fallback = null) {
  const record = await getValue('settings', key);
  return record ? record.value : fallback;
}

export async function setSetting(key, value) {
  const db = await openDatabase();
  const tx = db.transaction('settings', 'readwrite');
  tx.objectStore('settings').put({ key, value });
  await transactionPromise(tx);
}

async function seedDatabase() {
  const seedUrl = new URL('../data/seed.json', import.meta.url);
  let seed;
  try {
    const response = await fetch(seedUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    seed = await response.json();
  } catch (error) {
    seed = {
      categories: ['A1', 'A2', 'B1', 'B2', 'C1', 'AWL', 'AVL'].map((name, order) => ({
        id: `cat_${name.toLowerCase()}`, name, label: name, order,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })),
      entries: [], pins: [], annotations: [], settings: { numberMode: 'none', historyLimit: HISTORY_LIMIT },
    };
    console.warn('无法读取种子数据，已创建空词表。', error);
  }

  const db = await openDatabase();
  const tx = db.transaction([...ENTITY_STORES, 'settings', 'history'], 'readwrite');
  for (const storeName of ENTITY_STORES) tx.objectStore(storeName).clear();
  tx.objectStore('history').clear();
  for (const category of seed.categories ?? []) tx.objectStore('categories').put(category);
  for (const entry of seed.entries ?? []) tx.objectStore('entries').put(entry);
  for (const pin of seed.pins ?? []) tx.objectStore('pins').put(pin);
  for (const annotation of seed.annotations ?? []) tx.objectStore('annotations').put(annotation);
  const settings = { ...(seed.settings ?? {}), initialized: true, appVersion: APP_VERSION, historyPointer: 0, historyMaxSequence: 0 };
  for (const [key, value] of Object.entries(settings)) tx.objectStore('settings').put({ key, value });
  await transactionPromise(tx);
}

export async function initializeDatabase() {
  await openDatabase();
  const initialized = await getSetting('initialized', false);
  if (!initialized) await seedDatabase();
  await setSetting('appVersion', APP_VERSION);
}

function applyEntityChange(transaction, change, direction = 'after') {
  if (!ENTITY_STORES.includes(change.store)) throw new Error(`不支持的变更存储：${change.store}`);
  const store = transaction.objectStore(change.store);
  const value = change[direction];
  if (value == null) store.delete(change.key);
  else store.put(value);
}

async function pruneHistory() {
  const [records, pointer] = await Promise.all([getAll('history'), getSetting('historyPointer', 0)]);
  const ordered = records.sort((a, b) => a.sequence - b.sequence);
  let total = ordered.reduce((sum, record) => sum + (record.approximateSize || approximateJsonSize(record)), 0);
  const deletions = [];
  while (ordered.length > HISTORY_LIMIT || total > HISTORY_SIZE_LIMIT) {
    const record = ordered.shift();
    if (!record || record.sequence > pointer) break;
    deletions.push(record.sequence);
    total -= record.approximateSize || approximateJsonSize(record);
  }
  if (!deletions.length) return;
  const db = await openDatabase();
  const tx = db.transaction('history', 'readwrite');
  for (const sequence of deletions) tx.objectStore('history').delete(sequence);
  await transactionPromise(tx);
}

export async function commitChanges(label, changes) {
  if (!changes.length) return { sequence: await getSetting('historyPointer', 0), changed: false };
  const pointer = await getSetting('historyPointer', 0);
  const records = await getAll('history');
  const maxExisting = records.reduce((max, record) => Math.max(max, record.sequence), 0);
  const sequence = pointer + 1;
  const stores = [...new Set([...changes.map((change) => change.store), 'history', 'settings'])];
  const db = await openDatabase();
  const tx = db.transaction(stores, 'readwrite');

  for (const record of records) {
    if (record.sequence > pointer) tx.objectStore('history').delete(record.sequence);
  }
  for (const change of changes) applyEntityChange(tx, change, 'after');
  const historyRecord = {
    sequence, label, createdAt: new Date().toISOString(), changes,
    approximateSize: approximateJsonSize(changes),
  };
  tx.objectStore('history').put(historyRecord);
  tx.objectStore('settings').put({ key: 'historyPointer', value: sequence });
  tx.objectStore('settings').put({ key: 'historyMaxSequence', value: Math.max(sequence, maxExisting) });
  await transactionPromise(tx);
  await pruneHistory();
  return { sequence, changed: true };
}

export async function historyStatus() {
  const pointer = await getSetting('historyPointer', 0);
  const records = await getAll('history');
  const sequences = new Set(records.map((record) => record.sequence));
  return { canUndo: pointer > 0 && sequences.has(pointer), canRedo: sequences.has(pointer + 1), pointer };
}

async function applyHistoryRecord(record, direction, nextPointer) {
  const stores = [...new Set([...record.changes.map((change) => change.store), 'settings'])];
  const db = await openDatabase();
  const tx = db.transaction(stores, 'readwrite');
  for (const change of record.changes) applyEntityChange(tx, change, direction);
  tx.objectStore('settings').put({ key: 'historyPointer', value: nextPointer });
  await transactionPromise(tx);
}

export async function undoHistory() {
  const pointer = await getSetting('historyPointer', 0);
  if (pointer <= 0) return null;
  const record = await getValue('history', pointer);
  if (!record) return null;
  await applyHistoryRecord(record, 'before', pointer - 1);
  return record;
}

export async function redoHistory() {
  const pointer = await getSetting('historyPointer', 0);
  const record = await getValue('history', pointer + 1);
  if (!record) return null;
  await applyHistoryRecord(record, 'after', pointer + 1);
  return record;
}

export async function replaceWithoutHistory(snapshot) {
  const db = await openDatabase();
  const tx = db.transaction([...ENTITY_STORES, 'history', 'settings'], 'readwrite');
  for (const storeName of ENTITY_STORES) tx.objectStore(storeName).clear();
  tx.objectStore('history').clear();
  for (const category of snapshot.categories ?? []) tx.objectStore('categories').put(category);
  for (const entry of snapshot.entries ?? []) tx.objectStore('entries').put(entry);
  for (const pin of snapshot.pins ?? []) tx.objectStore('pins').put(pin);
  for (const annotation of snapshot.annotations ?? []) tx.objectStore('annotations').put(annotation);
  tx.objectStore('settings').put({ key: 'historyPointer', value: 0 });
  tx.objectStore('settings').put({ key: 'historyMaxSequence', value: 0 });
  await transactionPromise(tx);
}

export async function writeChangesWithoutHistory(changes) {
  if (!changes.length) return;
  const stores = [...new Set(changes.map((change) => change.store))];
  const db = await openDatabase();
  const tx = db.transaction(stores, 'readwrite');
  for (const change of changes) applyEntityChange(tx, change, 'after');
  await transactionPromise(tx);
}
