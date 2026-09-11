import { canonicalizeBackup, SCHEMA_VERSION, validateBackup } from './v3-model.js';
import { APP_VERSION } from './v5-version.js';

export const DB_NAME = 'gual-vocabulary-index';
export const DB_VERSION = 5;
export const BUILTIN_SEED_REVISION = 9;
export const BUILTIN_COMPUTER_DOMAIN_ID = 'domain_computer_terms';
const SEED_MIGRATION_BACKUP_DB_NAME = 'vix-seed-migration-backups-v1';
const SEED_MIGRATION_BACKUP_STORE = 'snapshots';
const FRESH_IMPORT_PROTOCOL = 'vix-seed-import/1';
const FRESH_IMPORT_BATCH_SIZE = 1000;

const PREFIX = 'v3';
export const STORES = Object.freeze({
  domains: `${PREFIX}Domains`,
  collections: `${PREFIX}Collections`,
  entries: `${PREFIX}Entries`,
  memberships: `${PREFIX}Memberships`,
  phraseTokens: `${PREFIX}PhraseTokens`, // legacy Schema 5 store; never written by 4.0
  relationComponents: `${PREFIX}RelationComponents`,
  pins: `${PREFIX}Pins`,
  annotations: `${PREFIX}Annotations`, // retired feature store; kept only to clear Schema 5 data without a DB upgrade
  studyStamps: `${PREFIX}StudyStamps`,
  settings: `${PREFIX}Settings`,
  history: `${PREFIX}History`, // retired feature store; kept only to clear Schema 5 data without a DB upgrade
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

function openSeedMigrationBackupDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SEED_MIGRATION_BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const backupDb = request.result;
      if (!backupDb.objectStoreNames.contains(SEED_MIGRATION_BACKUP_STORE)) {
        backupDb.createObjectStore(SEED_MIGRATION_BACKUP_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法创建 Seed 迁移安全备份'));
  });
}

async function persistSeedMigrationBackup(snapshot, fromRevision, toRevision) {
  const backupDb = await openSeedMigrationBackupDatabase();
  const id = `seed-${fromRevision}-to-${toRevision}:${Date.now()}`;
  try {
    const tx = backupDb.transaction(SEED_MIGRATION_BACKUP_STORE, 'readwrite');
    tx.objectStore(SEED_MIGRATION_BACKUP_STORE).put({
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      fromRevision,
      toRevision,
      snapshot,
    });
    await transactionPromise(tx);
    return id;
  } finally {
    backupDb.close();
  }
}

async function markSeedMigrationBackup(id, status, detail = '') {
  const backupDb = await openSeedMigrationBackupDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = backupDb.transaction(SEED_MIGRATION_BACKUP_STORE, 'readwrite');
      const store = tx.objectStore(SEED_MIGRATION_BACKUP_STORE);
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (record) store.put({ ...record, status, detail: String(detail || '').slice(0, 500), completedAt: new Date().toISOString() });
      };
      request.onerror = () => reject(request.error || new Error('无法更新 Seed 迁移备份状态'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('无法更新 Seed 迁移备份状态'));
      tx.onabort = () => reject(tx.error || new Error('Seed 迁移备份状态事务已中止'));
    });
  } finally {
    backupDb.close();
  }
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

async function loadSeedFile(filename = 'seed.json') {
  const response = await fetch(new URL(`../data/${filename}`, import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`无法读取内置词库（HTTP ${response.status}）`);
  return response.json();
}

async function sha256Text(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadSeedRuntimeAsset(descriptor) {
  if (!descriptor?.path || !/^[a-f0-9]{64}$/.test(descriptor.sha256 || '')) throw new Error('Seed5 runtime manifest contains an invalid asset descriptor');
  const response = await fetch(new URL(`../${descriptor.path}`, import.meta.url), { cache: 'default' });
  if (!response.ok) throw new Error(`Cannot load Seed5 runtime asset ${descriptor.path} (HTTP ${response.status})`);
  const text = await response.text();
  const canonicalText = text.replace(/\r\n/g, '\n');
  const bytes = new TextEncoder().encode(canonicalText).length;
  if (bytes !== Number(descriptor.bytes) || await sha256Text(canonicalText) !== descriptor.sha256) {
    throw new Error(`Seed5 runtime asset integrity check failed: ${descriptor.path}`);
  }
  return JSON.parse(canonicalText);
}

async function loadSeedRuntimeManifest() {
  const response = await fetch(new URL('../data/seed5-runtime/manifest.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Cannot load Seed5 runtime manifest (HTTP ${response.status})`);
  const manifest = await response.json();
  if (manifest?.protocol !== 'vix-seed-runtime/1' || Number(manifest.seedRevision) !== BUILTIN_SEED_REVISION) {
    throw new Error('Seed5 runtime manifest is incompatible with this application version');
  }
  return manifest;
}

export async function loadRuntimeSeed() {
  const manifest = await loadSeedRuntimeManifest();
  const seed = await loadSeedRuntimeAsset(manifest.meta);
  for (const [key, descriptors] of [['entries', manifest.entries], ['memberships', manifest.memberships], ['relationComponents', manifest.relationComponents]]) {
    if (!Array.isArray(descriptors)) throw new Error(`Seed5 runtime manifest is missing ${key} chunks`);
    seed[key] = [];
    for (const descriptor of descriptors) {
      const chunk = await loadSeedRuntimeAsset(descriptor);
      if (!Array.isArray(chunk) || chunk.length !== Number(descriptor.count)) throw new Error(`Seed5 runtime chunk count mismatch: ${descriptor.path}`);
      seed[key].push(...chunk);
    }
    if (seed[key].length !== Number(manifest.counts?.[key])) throw new Error(`Seed5 runtime total count mismatch: ${key}`);
  }
  return seed;
}

function freshImportPlan(manifest, meta) {
  const descriptors = [manifest.meta, ...manifest.entries, ...manifest.memberships, ...manifest.relationComponents];
  const planId = `seed-${manifest.seedRevision}:${descriptors.map((item) => item.sha256).join(':')}`;
  const metaStreams = ['domains', 'collections', 'pins', 'annotations', 'studyStamps'].map((key) => ({
    id: `meta:${key}`, storeKey: key, items: Array.isArray(meta[key]) ? meta[key] : [],
  }));
  const chunkStreams = [
    ...manifest.entries.map((descriptor) => ({ id: descriptor.path, storeKey: 'entries', descriptor })),
    ...manifest.memberships.map((descriptor) => ({ id: descriptor.path, storeKey: 'memberships', descriptor })),
    ...manifest.relationComponents.map((descriptor) => ({ id: descriptor.path, storeKey: 'relationComponents', descriptor })),
  ];
  const totalRecords = metaStreams.reduce((sum, stream) => sum + stream.items.length, 0)
    + chunkStreams.reduce((sum, stream) => sum + Number(stream.descriptor.count || 0), 0);
  return { planId, metaStreams, chunkStreams, totalRecords };
}

async function readImportState(db) {
  const tx = db.transaction(STORES.settings, 'readonly');
  const completion = transactionPromise(tx);
  const record = await requestPromise(tx.objectStore(STORES.settings).get('seedImportState'));
  await completion;
  return record?.value || null;
}

async function resetFreshImport(db, planId, totalRecords) {
  const allStores = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings, STORES.history];
  const tx = db.transaction(allStores, 'readwrite');
  const completion = transactionPromise(tx);
  for (const key of DATA_STORE_KEYS) tx.objectStore(STORES[key]).clear();
  tx.objectStore(STORES.settings).clear();
  tx.objectStore(STORES.history).clear();
  const state = {
    protocol: FRESH_IMPORT_PROTOCOL,
    planId,
    totalRecords,
    writtenRecords: 0,
    completed: {},
    startedAt: new Date().toISOString(),
  };
  tx.objectStore(STORES.settings).put({ key: 'seedImportState', value: state });
  await completion;
  return state;
}

async function writeFreshImportBatch(db, stream, items, start, state) {
  const end = Math.min(items.length, start + FRESH_IMPORT_BATCH_SIZE);
  const tx = db.transaction([STORES[stream.storeKey], STORES.settings], 'readwrite');
  const completion = transactionPromise(tx);
  const store = tx.objectStore(STORES[stream.storeKey]);
  for (let index = start; index < end; index += 1) store.put(items[index]);
  const next = {
    ...state,
    writtenRecords: Number(state.writtenRecords || 0) + (end - start),
    completed: { ...state.completed, [stream.id]: end },
    updatedAt: new Date().toISOString(),
  };
  tx.objectStore(STORES.settings).put({ key: 'seedImportState', value: next });
  await completion;
  return next;
}

function reportFreshImport(onProgress, state, label = '正在导入内置词库') {
  const total = Math.max(1, Number(state.totalRecords || 0));
  const completed = Math.min(total, Number(state.writtenRecords || 0));
  onProgress({
    phase: 'seed-import',
    label,
    completed,
    total,
    percent: Math.min(94, 5 + Math.round((completed / total) * 89)),
  });
}

async function importFreshSeed(db, { onProgress = (_progress) => {} } = {}) {
  onProgress({ phase: 'seed-download', label: '正在核验内置词库', percent: 3 });
  const manifest = await loadSeedRuntimeManifest();
  const meta = await loadSeedRuntimeAsset(manifest.meta);
  if (Number(meta?.schemaVersion) !== SCHEMA_VERSION) throw new Error('Seed5 runtime metadata is incompatible with the current schema');
  const plan = freshImportPlan(manifest, meta);
  let state = await readImportState(db);
  const resumed = state?.protocol === FRESH_IMPORT_PROTOCOL && state.planId === plan.planId;
  if (!resumed) state = await resetFreshImport(db, plan.planId, plan.totalRecords);
  reportFreshImport(onProgress, state, resumed ? '正在继续导入内置词库' : '正在导入内置词库');

  const importStream = async (stream, items) => {
    let offset = Math.min(items.length, Number(state.completed?.[stream.id] || 0));
    while (offset < items.length) {
      state = await writeFreshImportBatch(db, stream, items, offset, state);
      offset = Number(state.completed[stream.id] || 0);
      reportFreshImport(onProgress, state);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  for (const stream of plan.metaStreams) await importStream(stream, stream.items);
  for (const stream of plan.chunkStreams) {
    const completed = Number(state.completed?.[stream.id] || 0);
    if (completed >= Number(stream.descriptor.count || 0)) continue;
    const items = await loadSeedRuntimeAsset(stream.descriptor);
    if (!Array.isArray(items) || items.length !== Number(stream.descriptor.count)) {
      throw new Error(`Seed5 runtime chunk count mismatch: ${stream.descriptor.path}`);
    }
    await importStream(stream, items);
  }
  if (Number(state.writtenRecords) !== plan.totalRecords) throw new Error('Seed5 runtime import ended with an incomplete record count');

  const tx = db.transaction([STORES.settings, STORES.history], 'readwrite');
  const completion = transactionPromise(tx);
  const settingsStore = tx.objectStore(STORES.settings);
  settingsStore.clear();
  const settings = {
    ...meta.settings,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    initialized: true,
    dataRevision: Date.now(),
    builtInSeedRevision: BUILTIN_SEED_REVISION,
    migrationNoticePending: false,
  };
  for (const [key, value] of Object.entries(settings)) settingsStore.put({ key, value });
  tx.objectStore(STORES.history).clear();
  await completion;
  onProgress({ phase: 'seed-import', label: '内置词库已就绪', completed: plan.totalRecords, total: plan.totalRecords, percent: 95 });
  return { resumed, totalRecords: plan.totalRecords };
}

async function loadLegacySeed() {
  return loadRuntimeSeed();
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
    appVersion: APP_VERSION,
    initialized: true,
  };
  for (const [key, value] of Object.entries(settings)) settingsStore.put({ key, value });
}

async function loadCanonicalSeed() {
  const raw = await loadLegacySeed();
  if (Number(raw?.schemaVersion) !== SCHEMA_VERSION) throw new Error('内置 Seed 与当前 4.0.x 内容世代不兼容');
  return canonicalizeBackup(raw);
}

async function loadSeedMigrationBase() {
  const raw = await loadSeedFile('seed-4.json');
  if (Number(raw?.schemaVersion) !== SCHEMA_VERSION) throw new Error('Seed4 migration base is incompatible with the current schema');
  return canonicalizeBackup(raw);
}

async function loadSeedFieldBaseline(revision) {
  if (revision !== 7) return null;
  const raw = await loadSeedFile('seed-baselines/seed-7-glosses.json');
  if (raw?.protocol !== 'vix-seed-field-baseline/1' || Number(raw.seedRevision) !== revision || !Array.isArray(raw.entries)) {
    throw new Error('Seed 7 gloss baseline is invalid');
  }
  return raw;
}

export function mergeBuiltInDomainBackup(_baseBackup, seedBackup) {
  // 4.0.0 is a content-generation break. Built-in seed updates are full
  // replacements and never perform the old add-only merge.
  return canonicalizeBackup({ ...seedBackup, appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION });
}

async function ensureBuiltInSeedRevision(db) {
  const applied = Number(await getSetting('builtInSeedRevision', 0));
  if (applied >= BUILTIN_SEED_REVISION) return { builtInMerged: false };
  // A Seed generation is a complete replacement, so it must never happen as a
  // side effect of normal initialization. v3-app performs the visible export +
  // explicit confirmation preflight before calling the replacement function.
  throw new Error(`Seed 世代 ${applied} 尚未完成升级前置确认，已阻止自动替换为 ${BUILTIN_SEED_REVISION}`);
}

async function retireLegacyRuntimeData(db) {
  if (await getSetting('retiredRuntimeFeaturesV51', false)) return false;
  return enqueueWrite(async () => {
    const stores = [STORES.settings, STORES.history, STORES.annotations]
      .filter((name) => db.objectStoreNames.contains(name));
    const tx = db.transaction(stores, 'readwrite');
    const completion = transactionPromise(tx);
    // The physical stores remain in DB_VERSION 5 solely so upgrading users do
    // not pay for a destructive IndexedDB schema bump. No runtime API reads or
    // writes feature data here; initialization only makes the stores empty.
    tx.objectStore(STORES.history).clear();
    tx.objectStore(STORES.annotations).clear();
    const settings = tx.objectStore(STORES.settings);
    for (const key of ['historyPointer', 'historySequence', 'contentSources', 'annotationTask', 'verification']) settings.delete(key);
    settings.put({ key: 'retiredRuntimeFeaturesV51', value: true });
    await completion;
    return true;
  });
}

export async function initializeDatabase({ onProgress = (_progress) => {} } = {}) {
  const db = await openDatabase();
  const existing = await getSetting('schemaVersion', null);
  if (Number(existing) === SCHEMA_VERSION) {
    const result = { migrated: false, ...(await ensureBuiltInSeedRevision(db)) };
    await retireLegacyRuntimeData(db);
    return result;
  }
  if (existing != null) throw new Error('检测到旧内容世代。请完成 4.0.x 内容世代替换后再启动。');

  const fresh = await enqueueWrite(() => importFreshSeed(db, { onProgress }));
  await retireLegacyRuntimeData(db);
  return { migrated: false, initialized: true, builtInSeedRevision: BUILTIN_SEED_REVISION, ...fresh };
}

export async function getGenerationUpgradeStatus() {
  await openDatabase();
  const schema = await getSetting('schemaVersion', null);
  const seedRevision = await getSetting('builtInSeedRevision', 0);
  const hasExistingData = schema != null;
  return {
    required: hasExistingData && (Number(schema) < SCHEMA_VERSION || Number(seedRevision) < BUILTIN_SEED_REVISION),
    fromSchema: Number(schema || 0),
    toSchema: SCHEMA_VERSION,
    fromSeedRevision: Number(seedRevision || 0),
    toSeedRevision: BUILTIN_SEED_REVISION,
  };
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
  const legacySnapshot = await readCurrentSnapshot(db) || await readLegacySnapshot(db);
  if (!legacySnapshot) throw new Error('无法读取旧世代数据；为避免覆盖，升级已停止。');
  const backupId = await persistSeedMigrationBackup(
    legacySnapshot,
    Number(legacySnapshot.settings?.builtInSeedRevision || 0),
    BUILTIN_SEED_REVISION,
  );
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
      builtInSeedRevision: BUILTIN_SEED_REVISION,
      migrationNoticePending: false,
      migrationComplete: true,
      migrationSource: '3.5.2 content generation',
    });
    tx.objectStore(STORES.history).clear();
    if (tx.objectStoreNames.contains(STORES.phraseTokens)) tx.objectStore(STORES.phraseTokens).clear();
    try {
      await completion;
      await markSeedMigrationBackup(backupId, 'completed');
      return { replaced: true, revision, backupId };
    } catch (error) {
      await markSeedMigrationBackup(backupId, 'failed', error?.message || error);
      throw error;
    }
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

export async function readSnapshot() {
  const db = await openDatabase();
  const storeNames = [...DATA_STORE_KEYS.map((key) => STORES[key]), STORES.settings];
  const tx = db.transaction(storeNames, 'readonly');
  const completion = transactionPromise(tx);
  const result = {};
  await Promise.all(DATA_STORE_KEYS.map(async (key) => { result[key] = await getAllFromTransaction(tx, STORES[key]); }));
  const settingRecords = await getAllFromTransaction(tx, STORES.settings);
  result.settings = Object.fromEntries(settingRecords.map((item) => [item.key, item.value]));
  await completion;
  return result;
}

export async function exportBackup() {
  const snapshot = await readSnapshot();
  return canonicalizeBackup({
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    ...snapshot,
  });
}

export async function replaceWithBackup(input, { migrationNoticePending = false, expectedRevision = null } = {}) {
  if (Number(input?.schemaVersion) !== SCHEMA_VERSION) throw new Error('完整备份版本不兼容；4.6.0 仅接受 Schema 6 完整备份');
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
          putBackupIntoTransaction(tx, backup, { dataRevision: revision, migrationNoticePending });
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

export async function commitChanges(changes, { expectedRevision = null } = {}) {
  if (!Array.isArray(changes) || !changes.length) return Number(await getSetting('dataRevision', 0));
  return enqueueWrite(async () => {
    const db = await openDatabase();
    const affected = new Set(changes.map((change) => logicalStoreName(change.store)));
    affected.add(STORES.settings);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([...affected], 'readwrite');
      const settingsStore = tx.objectStore(STORES.settings);
      let revision = 0;
      let failure = null;
      let applied = false;
      let pending = 1;
      const values = { revisionRecord: null };

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

      tx.oncomplete = () => applied ? resolve(revision) : resolve(Number(values.revisionRecord?.value || 0));
      tx.onerror = () => reject(failure || tx.error || new Error('IndexedDB 事务失败'));
      tx.onabort = () => reject(failure || tx.error || new Error('IndexedDB 事务已中止'));
    });
  });
}
