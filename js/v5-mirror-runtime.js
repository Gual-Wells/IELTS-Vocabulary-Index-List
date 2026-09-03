// @ts-check

import { SuppressionRuntime, deriveEffectiveProjection, setMirrorSuppression } from './v5-suppression-runtime.js';

export const MIRROR_PROTOCOL = 'vix-mirror/2';
const DB_NAME = 'vix-mirror-runtime-v2';
const DB_VERSION = 1;
const STORE = 'records';
const CURRENT_KEY = 'current';

const suppression = new SuppressionRuntime();
/** @type {any | null} */
let current = null;
/** @type {any | null} */
let active = null;
let initialized = false;
let databasePromise = null;
const listeners = new Set();

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Mirror runtime 读取失败'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Mirror runtime 写入失败'));
    transaction.onabort = () => reject(transaction.error || new Error('Mirror runtime 事务已中止'));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error || new Error('无法打开 Mirror runtime')); };
  });
  return databasePromise;
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** @param {any} value */
export function validateMirrorRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Mirror 记录必须是对象');
  if (value.protocol !== MIRROR_PROTOCOL) throw new Error('Mirror 协议版本不兼容');
  if (typeof value.mirrorId !== 'string' || !value.mirrorId || value.mirrorId.length > 160) throw new Error('Mirror ID 无效');
  if (!validIso(value.createdAt)) throw new Error('Mirror 时间无效');
  if (typeof value.sourceCorpusHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.sourceCorpusHash)) throw new Error('Mirror Corpus hash 无效');
  if (typeof value.mirrorHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.mirrorHash)) throw new Error('Mirror hash 无效');
  if (!Number.isSafeInteger(value.requestSequence) || value.requestSequence < 1) throw new Error('Mirror sequence 无效');
  if (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string' || !id || id.length > 220)) throw new Error('Mirror Entry ID 列表无效');
  if (new Set(value.entryIds).size !== value.entryIds.length) throw new Error('Mirror Entry ID 重复');
  return Object.freeze({
    protocol: MIRROR_PROTOCOL,
    mirrorId: value.mirrorId,
    createdAt: value.createdAt,
    sourceCorpusHash: value.sourceCorpusHash,
    matchCorpusHash: typeof value.matchCorpusHash === 'string' ? value.matchCorpusHash : '',
    mirrorHash: value.mirrorHash,
    requestSequence: value.requestSequence,
    entryIds: Object.freeze([...value.entryIds]),
    materialLabel: typeof value.materialLabel === 'string' ? value.materialLabel.slice(0, 160) : '',
    matchMode: ['lexical', 'semantic'].includes(value.matchMode) ? value.matchMode : 'lexical',
  });
}

function emit(type) {
  const snapshot = getMirrorSnapshot();
  for (const listener of listeners) listener({ type, snapshot });
}

export async function initializeMirrorRuntime() {
  if (initialized) return getMirrorSnapshot();
  const db = await openDatabase();
  if (db) {
    const tx = db.transaction(STORE, 'readonly');
    const record = await requestPromise(tx.objectStore(STORE).get(CURRENT_KEY));
    await transactionPromise(tx);
    try { current = record?.value ? validateMirrorRecord(record.value) : null; }
    catch { current = null; }
  }
  initialized = true;
  return getMirrorSnapshot();
}

/** @param {(event: {type: string, snapshot: ReturnType<typeof getMirrorSnapshot>}) => void} listener */
export function subscribeMirrorRuntime(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMirrorSnapshot() {
  return {
    initialized,
    current: clone(current),
    active: clone(active),
    enabled: Boolean(active),
    suppressionRevision: suppression.revision,
  };
}

/** @param {any} record @param {Iterable<string>} structuralEntryIds */
export async function commitMirrorCurrent(record, structuralEntryIds) {
  await initializeMirrorRuntime();
  const validated = validateMirrorRecord(record);
  const universe = new Set(structuralEntryIds);
  for (const id of validated.entryIds) if (!universe.has(id)) throw new Error(`Mirror 包含当前词库未知 Entry：${id}`);
  const db = await openDatabase();
  if (db) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key: CURRENT_KEY, value: clone(validated) });
    await transactionPromise(tx);
  }
  current = validated;
  emit('current');
  return getMirrorSnapshot();
}

/** @param {Iterable<string>} structuralEntryIds */
export async function activateMirror(structuralEntryIds) {
  await initializeMirrorRuntime();
  if (!current) throw new Error('当前设备还没有可用 Mirror');
  active = validateMirrorRecord(clone(current));
  setMirrorSuppression(suppression, structuralEntryIds, active.entryIds);
  emit('active');
  return getMirrorSnapshot();
}

export function deactivateMirror() {
  active = null;
  setMirrorSuppression(suppression, [], null);
  emit('inactive');
  return getMirrorSnapshot();
}

/** @param {Map<string, any[]>} structuralProjection */
export function effectiveProjectionFromMirror(structuralProjection) {
  return deriveEffectiveProjection(structuralProjection, suppression);
}

export function effectiveEntryAllowed(entryId) {
  return !suppression.suppressed(entryId, 'entry');
}

export async function clearMirrorCurrent() {
  await initializeMirrorRuntime();
  const db = await openDatabase();
  if (db) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(CURRENT_KEY);
    await transactionPromise(tx);
  }
  current = null;
  if (!active) emit('current-cleared');
  else emit('current-cleared-active-preserved');
  return getMirrorSnapshot();
}
