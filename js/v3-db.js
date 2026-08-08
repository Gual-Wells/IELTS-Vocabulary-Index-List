import { canonicalizeBackup, SCHEMA_VERSION, validateBackup } from './v3-model.js';

export const DB_NAME = 'gual-vocabulary-index';
export const DB_VERSION = 5;
export const HISTORY_LIMIT = 100;
export const BUILTIN_SEED_REVISION = 4;
export const BUILTIN_COMPUTER_DOMAIN_ID = 'domain_computer_terms';

const PREFIX = 'v3';
export const STORES = Object.freeze({
  domains: `${PREFIX}Domains`,
  collections: `${PREFIX}Collections`,
  entries: `${PREFIX}Entries`,
  memberships: `${PREFIX}Memberships`,
  phraseTokens: `${PREFIX}PhraseTokens`, // legacy Schema 5 store; never written by 4.0
  relationComponents: `${PREFIX}RelationComponents`,
  pins: `${PREFIX}Pins`,
  annotations: `${PREFIX}Annotations`,
  studyStamps: `${PREFIX}StudyStamps`,
  settings: `${PREFIX}Settings`,
  history: `${PREFIX}History`,
});
const DATA_STORE_KEYS = ['domains', 'collections', 'entries', 'memberships', 'relationComponents', 'pins', 'annotations', 'studyStamps'];
let databasePromise = null;
/** @type {Promise<unknown>} */
let writeTail = Promise.resolve();

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 事务失败'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已中止'));
  });
}

/**
 * @template T
 * @param {() => Promise<T> | T} task
 * @returns {Promise<T>}
 */
function enqueueWrite(task) {
  const run = writeTail.then(task, task);
  writeTail = run.catch(() => undefined);
  return run;
}

function createStore(db, name, options, indexes = []) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, options);
  for (const [indexName, keyPath, indexOptions] of indexes) store.createIndex(indexName, keyPath, indexOptions);
}

export function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(db, STORES.domains, { keyPath: 'id' }, [['order', 'order', { unique: false }]]);
      createStore(db, STORES.collections, { keyPath: 'id' }, [
        ['domainId', 'domainId', { unique: false }], ['domainOrder', ['domainId', 'order'], { unique: false }],
      ]);
      createStore(db, STORES.entries, { keyPath: 'id' }, [
        ['domainId', 'domainId', { unique: false }], ['domainText', ['domainId', 'normalizedText'], { unique: true }],
        ['kind', 'kind', { unique: false }],
      ]);
      createStore(db, STORES.memberships, { keyPath: 'id' }, [
        ['entryId', 'entryId', { unique: false }], ['collectionId', 'collectionId', { unique: false }],
        ['entryCollection', ['entryId', 'collectionId'], { unique: true }],
      ]);
      createStore(db, STORES.phraseTokens, { keyPath: 'id' }, [
        ['phraseId', 'phraseId', { unique: false }], ['domainToken', ['domainId', 'normalizedToken'], { unique: false }],
      ]);
      createStore(db, STORES.relationComponents, { keyPath: 'id' }, [
        ['sourceEntryId', 'sourceEntryId', { unique: false }], ['normalizedText', 'normalizedText', { unique: false }],
      ]);
      createStore(db, STORES.pins, { keyPath: 'id' }, [['entryId', 'entryId', { unique: true }]]);
      createStore(db, STORES.annotations, { keyPath: 'entryId' }, [['domainId', 'domainId', { unique: false }]]);
      createStore(db, STORES.studyStamps, { keyPath: 'key' }, [
        ['entryId', 'entryId', { unique: false }], ['reviewDateKey', 'reviewDateKey', { unique: false }],
      ]);
      createStore(db, STORES.settings, { keyPath: 'key' });
      createStore(db, STORES.history, { keyPath: 'sequence' });
    };
    request.onblocked = () => {
      blocked = true;
      databasePromise = null;
      reject(new Error('数据库升级被其他页面阻止。请关闭该站点其他 Safari 标签页和主屏幕应用后重试。'));
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('无法打开 IndexedDB'));
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
  });
  return databasePromise;
}

async function getAllFromTransaction(tx, storeName) {
  return requestPromise(tx.objectStore(storeName).getAll());
}

async function readCurrentSnapshot(db) {
  const required = DATA_STORE_KEYS.filter((key) => db.objectStoreNames.contains(STORES[key]));
  if (!required.includes('domains') || !required.includes('collections') || !required.includes('entries')) return null;
  const storeNames = [...required.map((key) => STORES[key]), STORES.settings].filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(storeNames, 'readonly');
  const completion = transactionPromise(tx);
  const result = {};
  await Promise.all(DATA_STORE_KEYS.map(async (key) => {
    result[key] = db.objectStoreNames.contains(STORES[key]) ? await getAllFromTransaction(tx, STORES[key]) : [];
  }));
  const settingRecords = db.objectStoreNames.contains(STORES.settings) ? await getAllFromTransaction(tx, STORES.settings) : [];
  result.settings = Object.fromEntries(settingRecords.map((item) => [item.key, item.value]));
  await completion;
  if (!(result.domains || []).length) return null;
  return {
    schemaVersion: Number(result.settings.schemaVersion || 3),
    appVersion: result.settings.appVersion || '3.0.x',
    exportedAt: new Date().toISOString(),
    ...result,
  };
}

async function readLegacySnapshot(db) {
  const available = ['categories', 'entries', 'pins', 'annotations', 'settings'].filter((name) => db.objectStoreNames.contains(name));
  if (!available.includes('categories') || !available.includes('entries')) return null;
  const tx = db.transaction(available, 'readonly');
  const completion = transactionPromise(tx);
  const result = {};
  await Promise.all(available.map(async (name) => { result[name] = await getAllFromTransaction(tx, name); }));
  await completion;
  const settings = Object.fromEntries((result.settings || []).map((item) => [item.key, item.value]));
  if (!(result.categories || []).length || !(result.entries || []).length) return null;
  return {
    schemaVersion: 2,
    appVersion: settings.appVersion || '2.x',
    categories: result.categories || [],
    entries: result.entries || [],
    pins: result.pins || [],
    annotations: result.annotations || [],
    settings,
  };
}

async function loadLegacySeed() {
  const response = await fetch(new URL('../data/seed.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`无法读取内置词库（HTTP ${response.status}）`);
  return response.json();
}

function putBackupIntoTransaction(tx, backup, extraSettings = {}) {
  for (const key of DATA_STORE_KEYS) {
    const store = tx.objectStore(STORES[key]);
    store.clear();
    for (const item of backup[key]) store.put(item);
  }
  const settingsStore = tx.objectStore(STORES.settings);
  settingsStore.clear();
  const settings = {
    ...backup.settings,
    ...extraSettings,
    schemaVersion: SCHEMA_VERSION,
    appVersion: '4.0.2',
    initialized: true,
  };
  for (const [key, value] of Object.entries(settings)) settingsStore.put({ key, value });
}

async function loadCanonicalSeed() {
  const raw = await loadLegacySeed();
  if (Number(raw?.schemaVersion) !== SCHEMA_VERSION) throw new Error('内置 Seed 与当前 4.0.x 内容世代不兼容');
  return canonicalizeBackup(raw);
}

export function mergeBuiltInDomainBackup(_baseBackup, seedBackup) {
  // 4.0.0 is a content-generation break. Built-in seed updates are full
  // replacements and never perform the old add-only merge.
  return canonicalizeBackup({ ...seedBackup, appVersion: '4.0.2', schemaVersion: SCHEMA_VERSION });
}

async function ensureBuiltInSeedRevision(db) {
  const applied = Number(await getSetting('builtInSeedRevision', 0));
  if (applied >= BUILTIN_SEED_REVISION) return { builtInMerged: false };
  return enqueueWrite(async () => {
    const seed = await loadCanonicalSeed();
    const existingNumberMode = await getSetting('numberMode', 'global');
    const existingLowFilter = await getSetting('closeLowLevelRelations', true);
    const revision = Date.now();
    const writeStores = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history];
    const tx = db.transaction(writeStores, 'readwrite');
    const completion = transactionPromise(tx);
    putBackupIntoTransaction(tx, seed, {
      numberMode: existingNumberMode,
      closeLowLevelRelations: existingLowFilter !== false,
      dataRevision: revision,
      historyPointer: 0,
      historySequence: 0,
      builtInSeedRevision: BUILTIN_SEED_REVISION,
    });
    tx.objectStore(STORES.history).clear();
    await completion;
    return { builtInMerged: true, builtInSeedRevision: BUILTIN_SEED_REVISION };
  });
}

export async function initializeDatabase() {
  const db = await openDatabase();
  const existing = await getSetting('schemaVersion', null);
  if (Number(existing) === SCHEMA_VERSION) return { migrated: false, ...(await ensureBuiltInSeedRevision(db)) };
  if (existing != null) throw new Error('检测到旧内容世代。请完成 4.0.x 内容世代替换后再启动。');

  return enqueueWrite(async () => {
    const seed = await loadCanonicalSeed();
    const allStores = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history];
    const tx = db.transaction(allStores, 'readwrite');
    const completion = transactionPromise(tx);
    putBackupIntoTransaction(tx, seed, {
      dataRevision: Date.now(), historyPointer: 0, historySequence: 0,
      builtInSeedRevision: BUILTIN_SEED_REVISION,
      migrationNoticePending: false,
    });
    tx.objectStore(STORES.history).clear();
    await completion;
    return { migrated: false, initialized: true, builtInSeedRevision: BUILTIN_SEED_REVISION };
  });
}

export async function getGenerationUpgradeStatus() {
  const db = await openDatabase();
  const schema = await getSetting('schemaVersion', null);
  return { required: schema != null && Number(schema) < SCHEMA_VERSION, fromSchema: Number(schema || 0), toSchema: SCHEMA_VERSION };
}

export async function exportLegacyGenerationBackup() {
  const db = await openDatabase();
  const names = ['domains','collections','entries','memberships','pins','annotations','studyStamps']
    .map((key) => STORES[key]).filter((name) => db.objectStoreNames.contains(name));
  if (db.objectStoreNames.contains(STORES.phraseTokens)) names.push(STORES.phraseTokens);
  if (db.objectStoreNames.contains(STORES.settings)) names.push(STORES.settings);
  const tx = db.transaction(names, 'readonly');
  const completion = transactionPromise(tx);
  const get = async (name) => db.objectStoreNames.contains(name) ? requestPromise(tx.objectStore(name).getAll()) : [];
  const [domains, collections, entries, memberships, phraseTokens, pins, annotations, studyStamps, settingRecords] = await Promise.all([
    get(STORES.domains), get(STORES.collections), get(STORES.entries), get(STORES.memberships), get(STORES.phraseTokens),
    get(STORES.pins), get(STORES.annotations), get(STORES.studyStamps), get(STORES.settings),
  ]);
  await completion;
  const settings = Object.fromEntries(settingRecords.map((item) => [item.key, item.value]));
  return {
    schemaVersion: Number(settings.schemaVersion || 5),
    appVersion: settings.appVersion || '3.5.2',
    exportedAt: new Date().toISOString(),
    domains, collections, entries, memberships, phraseTokens, pins, annotations, studyStamps, settings,
  };
}

export async function replaceLegacyGenerationWithSeed() {
  const db = await openDatabase();
  const seed = await loadCanonicalSeed();
  const numberMode = await getSetting('numberMode', 'global');
  const revision = Date.now();
  return enqueueWrite(async () => {
    const stores = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history];
    if (db.objectStoreNames.contains(STORES.phraseTokens)) stores.push(STORES.phraseTokens);
    const tx = db.transaction(stores, 'readwrite');
    const completion = transactionPromise(tx);
    putBackupIntoTransaction(tx, seed, {
      numberMode,
      closeLowLevelRelations: true,
      dataRevision: revision,
      historyPointer: 0,
      historySequence: 0,
      builtInSeedRevision: BUILTIN_SEED_REVISION,
      migrationNoticePending: false,
      migrationComplete: true,
      migrationSource: '3.5.2 content generation',
    });
    tx.objectStore(STORES.history).clear();
    if (tx.objectStoreNames.contains(STORES.phraseTokens)) tx.objectStore(STORES.phraseTokens).clear();
    await completion;
    return { replaced: true, revision };
  });
}

export async function replaceWithCanonicalSeed({ expectedRevision = null } = {}) {
  const seed = await loadCanonicalSeed();
  return replaceWithBackup(seed, { expectedRevision, migrationNoticePending: false });
}

export async function getSetting(key, fallback = null) {
  const db = await openDatabase();
  const tx = db.transaction(STORES.settings, 'readonly');
  const completion = transactionPromise(tx);
  const record = await requestPromise(tx.objectStore(STORES.settings).get(key));
  await completion;
  return record ? record.value : fallback;
}

export async function setSettings(values, { expectedRevision = null, bumpRevision = false } = {}) {
  return enqueueWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.settings, 'readwrite');
      const store = tx.objectStore(STORES.settings);
      const revisionRequest = store.get('dataRevision');
      let revision = 0;
      let failure = null;
      const fail = (error) => {
        failure = error instanceof Error ? error : new Error(String(error || '设置写入失败'));
        try { tx.abort(); } catch {}
      };
      revisionRequest.onsuccess = () => {
        try {
          const currentRevision = Number(revisionRequest.result?.value || 0);
          if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
            fail(new Error('数据已被另一实例修改，本次设置已安全取消。请重新载入后重试。'));
            return;
          }
          for (const [key, value] of Object.entries(values)) store.put({ key, value });
          revision = bumpRevision ? Math.max(Date.now(), currentRevision + 1) : currentRevision;
          if (bumpRevision) store.put({ key: 'dataRevision', value: revision });
        } catch (error) { fail(error); }
      };
      revisionRequest.onerror = () => fail(revisionRequest.error || new Error('无法读取数据修订号'));
      tx.oncomplete = () => resolve(revision);
      tx.onerror = () => reject(failure || tx.error || new Error('设置事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('设置事务已中止'));
    });
  });
}

export async function setLastPositionSetting(positionKey, entryId) {
  return enqueueWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.settings, 'readwrite');
      const store = tx.objectStore(STORES.settings);
      const request = store.get('lastPositions');
      let next = null;
      let failure = null;
      const fail = (error) => {
        failure = error instanceof Error ? error : new Error(String(error || '浏览位置写入失败'));
        try { tx.abort(); } catch {}
      };
      request.onsuccess = () => {
        try {
          const current = request.result?.value;
          next = { ...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}), [positionKey]: entryId };
          store.put({ key: 'lastPositions', value: next });
        } catch (error) { fail(error); }
      };
      request.onerror = () => fail(request.error || new Error('无法读取浏览位置'));
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(failure || tx.error || new Error('浏览位置事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('浏览位置事务已中止'));
    });
  });
}

export async function readSnapshot({ includeHistory = false } = {}) {
  const db = await openDatabase();
  const storeNames = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings];
  if (includeHistory) storeNames.push(STORES.history);
  const tx = db.transaction(storeNames, 'readonly');
  const completion = transactionPromise(tx);
  const result = {};
  await Promise.all(DATA_STORE_KEYS.map(async (key) => { result[key] = await getAllFromTransaction(tx, STORES[key]); }));
  const settingRecords = await getAllFromTransaction(tx, STORES.settings);
  result.settings = Object.fromEntries(settingRecords.map((item) => [item.key, item.value]));
  if (includeHistory) result.history = await getAllFromTransaction(tx, STORES.history);
  await completion;
  return result;
}

export async function exportBackup() {
  const snapshot = await readSnapshot();
  return canonicalizeBackup({
    schemaVersion: SCHEMA_VERSION,
    appVersion: '4.0.2',
    exportedAt: new Date().toISOString(),
    ...snapshot,
  });
}

export async function replaceWithBackup(input, { migrationNoticePending = false, expectedRevision = null } = {}) {
  if (Number(input?.schemaVersion) !== SCHEMA_VERSION) throw new Error('完整备份版本不兼容；4.0.2 仅接受 Schema 6 完整备份');
  validateBackup(input);
  const backup = canonicalizeBackup(input);
  return enqueueWrite(async () => {
    const db = await openDatabase();
    const allStores = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(allStores, 'readwrite');
      const settingsStore = tx.objectStore(STORES.settings);
      const revisionRequest = settingsStore.get('dataRevision');
      let revision = 0;
      let failure = null;
      let queued = false;
      const fail = (error) => {
        failure = error instanceof Error ? error : new Error(String(error || '恢复事务失败'));
        try { tx.abort(); } catch {}
      };
      revisionRequest.onsuccess = () => {
        try {
          const currentRevision = Number(revisionRequest.result?.value || 0);
          if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
            fail(new Error('数据已被另一实例修改，恢复操作已安全取消。请重新载入后重试。'));
            return;
          }
          revision = Math.max(Date.now(), currentRevision + 1);
          putBackupIntoTransaction(tx, backup, {
            dataRevision: revision, historyPointer: 0, historySequence: 0, migrationNoticePending,
          });
          tx.objectStore(STORES.history).clear();
          queued = true;
        } catch (error) { fail(error); }
      };
      revisionRequest.onerror = () => fail(revisionRequest.error || new Error('无法读取数据修订号'));
      tx.oncomplete = () => queued ? resolve(revision) : resolve(0);
      tx.onerror = () => reject(failure || tx.error || new Error('恢复事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('恢复事务已中止'));
    });
  });
}

function logicalStoreName(key) {
  const name = STORES[key];
  if (!name) throw new Error(`未知数据表：${key}`);
  return name;
}

function clone(value) {
  return value == null ? null : structuredClone(value);
}

export async function commitChanges(changes, { label = '修改', recordHistory = true, expectedRevision = null } = {}) {
  if (!Array.isArray(changes) || !changes.length) return Number(await getSetting('dataRevision', 0));
  return enqueueWrite(async () => {
    const db = await openDatabase();
    const affected = new Set(changes.map((change) => logicalStoreName(change.store)));
    affected.add(STORES.settings);
    if (recordHistory) affected.add(STORES.history);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([...affected], 'readwrite');
      const settingsStore = tx.objectStore(STORES.settings);
      const historyStore = recordHistory ? tx.objectStore(STORES.history) : null;
      let revision = 0;
      let failure = null;
      let applied = false;
      let pending = recordHistory ? 4 : 1;
      const values = { revisionRecord: null, pointerRecord: null, sequenceRecord: null, history: [] };

      const fail = (error) => {
        failure = error instanceof Error ? error : new Error(String(error || 'IndexedDB 读取失败'));
        try { tx.abort(); } catch {}
      };

      const completeRead = () => {
        pending -= 1;
        if (pending !== 0 || failure) return;
        // Queue every write directly from the final IDB success callback. This avoids Safari's
        // aggressive transaction auto-close behavior around awaited promises.
        try {
          const currentRevision = Number(values.revisionRecord?.value || 0);
          if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
            failure = new Error('数据已被另一实例修改，本次操作已安全取消。请重新载入后重试。');
            tx.abort();
            return;
          }
          for (const change of changes) {
            const store = tx.objectStore(logicalStoreName(change.store));
            if (change.after == null) store.delete(change.key);
            else store.put(clone(change.after));
          }
          revision = Math.max(Date.now(), currentRevision + 1);
          settingsStore.put({ key: 'dataRevision', value: revision });

          if (recordHistory) {
            const pointer = Number(values.pointerRecord?.value || 0);
            const sequence = Number(values.sequenceRecord?.value || 0) + 1;
            for (const record of values.history) {
              if (record.sequence > pointer) historyStore.delete(record.sequence);
            }
            historyStore.put({
              sequence,
              label,
              createdAt: new Date().toISOString(),
              changes: changes.map((change) => ({ ...change, before: clone(change.before), after: clone(change.after) })),
            });
            const remaining = values.history.filter((record) => record.sequence <= pointer).sort((a, b) => a.sequence - b.sequence);
            const excess = Math.max(0, remaining.length + 1 - HISTORY_LIMIT);
            for (let index = 0; index < excess; index += 1) historyStore.delete(remaining[index].sequence);
            settingsStore.put({ key: 'historyPointer', value: sequence });
            settingsStore.put({ key: 'historySequence', value: sequence });
          }
          applied = true;
        } catch (error) {
          fail(error);
        }
      };

      const capture = (request, key) => {
        request.onsuccess = () => { values[key] = request.result; completeRead(); };
        request.onerror = () => fail(request.error ?? new Error('IndexedDB 读取失败'));
      };

      capture(settingsStore.get('dataRevision'), 'revisionRecord');
      if (recordHistory) {
        capture(settingsStore.get('historyPointer'), 'pointerRecord');
        capture(settingsStore.get('historySequence'), 'sequenceRecord');
        capture(historyStore.getAll(), 'history');
      }

      tx.oncomplete = () => applied ? resolve(revision) : resolve(Number(values.revisionRecord?.value || 0));
      tx.onerror = () => reject(failure || tx.error || new Error('IndexedDB 事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('IndexedDB 事务已中止'));
    });
  });
}

export async function recordHistoryOnly(changes, { label = '修改', expectedRevision = null } = {}) {
  if (!Array.isArray(changes) || !changes.length) return Number(await getSetting('dataRevision', 0));
  return enqueueWrite(async () => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.settings, STORES.history], 'readwrite');
      const settingsStore = tx.objectStore(STORES.settings);
      const historyStore = tx.objectStore(STORES.history);
      let failure = null;
      let revision = 0;
      let applied = false;
      let pending = 4;
      const values = { revisionRecord: null, pointerRecord: null, sequenceRecord: null, history: [] };
      const fail = (error) => {
        failure = error instanceof Error ? error : new Error(String(error || '历史写入失败'));
        try { tx.abort(); } catch {}
      };
      const completeRead = () => {
        pending -= 1;
        if (pending !== 0 || failure) return;
        try {
          const currentRevision = Number(values.revisionRecord?.value || 0);
          if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
            fail(new Error('数据已被另一实例修改，AI 核查历史未写入。'));
            return;
          }
          const pointer = Number(values.pointerRecord?.value || 0);
          const sequence = Number(values.sequenceRecord?.value || 0) + 1;
          for (const record of values.history) if (record.sequence > pointer) historyStore.delete(record.sequence);
          historyStore.put({
            sequence,
            label,
            createdAt: new Date().toISOString(),
            changes: changes.map((change) => ({ ...change, before: clone(change.before), after: clone(change.after) })),
          });
          const remaining = values.history.filter((record) => record.sequence <= pointer).sort((a, b) => a.sequence - b.sequence);
          const excess = Math.max(0, remaining.length + 1 - HISTORY_LIMIT);
          for (let index = 0; index < excess; index += 1) historyStore.delete(remaining[index].sequence);
          settingsStore.put({ key: 'historyPointer', value: sequence });
          settingsStore.put({ key: 'historySequence', value: sequence });
          revision = Math.max(Date.now(), currentRevision + 1);
          settingsStore.put({ key: 'dataRevision', value: revision });
          applied = true;
        } catch (error) { fail(error); }
      };
      const capture = (request, key) => {
        request.onsuccess = () => { values[key] = request.result; completeRead(); };
        request.onerror = () => fail(request.error ?? new Error('IndexedDB 读取失败'));
      };
      capture(settingsStore.get('dataRevision'), 'revisionRecord');
      capture(settingsStore.get('historyPointer'), 'pointerRecord');
      capture(settingsStore.get('historySequence'), 'sequenceRecord');
      capture(historyStore.getAll(), 'history');
      tx.oncomplete = () => applied ? resolve(revision) : resolve(Number(values.revisionRecord?.value || 0));
      tx.onerror = () => reject(failure || tx.error || new Error('历史写入事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('历史写入事务已中止'));
    });
  });
}

function applyHistoryDirection(db, direction, expectedRevision = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history], 'readwrite');
    const settings = tx.objectStore(STORES.settings);
    const historyStore = tx.objectStore(STORES.history);
    let pointerRecord = null;
    let history = null;
    let revisionRecord = null;
    let pending = 3;
    let changed = false;
    let revision = 0;
    let appliedRecord = null;
    let failure = null;

    const fail = (error) => {
      failure = error instanceof Error ? error : new Error(String(error || '历史读取失败'));
      try { tx.abort(); } catch {}
    };
    const apply = () => {
      pending -= 1;
      if (pending !== 0 || failure) return;
      try {
        const currentRevision = Number(revisionRecord?.value || 0);
        if (expectedRevision != null && currentRevision !== Number(expectedRevision)) {
          fail(new Error('数据已被另一实例修改，撤销或重做已安全取消。请重新载入后重试。'));
          return;
        }
        const pointer = Number(pointerRecord?.value || 0);
        const record = direction < 0
          ? history.find((item) => item.sequence === pointer)
          : history.filter((item) => item.sequence > pointer).sort((a, b) => a.sequence - b.sequence)[0];
        if (!record) return;
        appliedRecord = record;
        const changes = direction < 0 ? [...record.changes].reverse() : record.changes;
        for (const change of changes) {
          const store = tx.objectStore(logicalStoreName(change.store));
          const value = direction < 0 ? change.before : change.after;
          if (value == null) store.delete(change.key);
          else store.put(clone(value));
        }
        const nextPointer = direction < 0
          ? (history.filter((item) => item.sequence < pointer).sort((a, b) => b.sequence - a.sequence)[0]?.sequence || 0)
          : record.sequence;
        settings.put({ key: 'historyPointer', value: nextPointer });
        revision = Math.max(Date.now(), currentRevision + 1);
        settings.put({ key: 'dataRevision', value: revision });
        changed = true;
      } catch (error) {
        fail(error);
      }
    };

    const pointerRequest = settings.get('historyPointer');
    pointerRequest.onsuccess = () => { pointerRecord = pointerRequest.result; apply(); };
    pointerRequest.onerror = () => fail(pointerRequest.error);
    const historyRequest = historyStore.getAll();
    historyRequest.onsuccess = () => { history = historyRequest.result; apply(); };
    historyRequest.onerror = () => fail(historyRequest.error);
    const revisionRequest = settings.get('dataRevision');
    revisionRequest.onsuccess = () => { revisionRecord = revisionRequest.result; apply(); };
    revisionRequest.onerror = () => fail(revisionRequest.error);

    tx.oncomplete = () => resolve(changed ? { changed: true, revision, record: clone(appliedRecord) } : null);
    tx.onerror = () => reject(failure || tx.error || new Error('历史事务失败'));
    tx.onabort = () => reject(failure || tx.error || new Error('历史事务已中止'));
  });
}

export async function undo(expectedRevision = null) {
  return enqueueWrite(async () => applyHistoryDirection(await openDatabase(), -1, expectedRevision));
}

export async function redo(expectedRevision = null) {
  return enqueueWrite(async () => applyHistoryDirection(await openDatabase(), 1, expectedRevision));
}
