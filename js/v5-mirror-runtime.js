// @ts-check

import { SuppressionRuntime, deriveEffectiveProjection, setMirrorSuppression } from './v5-suppression-runtime.js';

export const MIRROR_PROTOCOL = 'vix-mirror/3';
const LEGACY_MIRROR_PROTOCOL = 'vix-mirror/2';
const DB_NAME = 'vix-mirror-runtime-v2';
const DB_VERSION = 2;
const STORE = 'records';
const CURRENT_KEY = 'current';
const RECORD_PREFIX = 'mirror:';

const suppression = new SuppressionRuntime();
/** @type {any | null} */
let current = null;
/** @type {any | null} */
let active = null;
let enabledPreference = false;
/** @type {Map<string, {record: any, reviewedAt: string}>} */
let library = new Map();
let initialized = false;
let databasePromise = null;
const listeners = new Set();
const memoryRows = new Map();

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
    transaction.onabort = () => reject(transaction.error || new Error('Mirror runtime 事务中止'));
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

async function readRows() {
  const db = await openDatabase();
  if (!db) return [...memoryRows.values()].map(clone);
  const tx = db.transaction(STORE, 'readonly');
  const rows = await requestPromise(tx.objectStore(STORE).getAll());
  await transactionPromise(tx);
  return rows;
}

async function putRow(row) {
  const db = await openDatabase();
  if (!db) { memoryRows.set(row.key, clone(row)); return; }
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(clone(row));
  await transactionPromise(tx);
}

async function deleteRow(key) {
  const db = await openDatabase();
  if (!db) { memoryRows.delete(key); return; }
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(key);
  await transactionPromise(tx);
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateEvidence(items) {
  if (!Array.isArray(items)) return Object.freeze([]);
  return Object.freeze(items.slice(0, 8).map((item) => Object.freeze({
    quote: String(item?.quote || '').slice(0, 400),
    location: String(item?.location || '').slice(0, 120),
  })).filter((item) => item.quote));
}

function validateExistingMatch(item) {
  if (!item || typeof item !== 'object') throw new Error('Mirror 已有词匹配无效');
  if (typeof item.entryId !== 'string' || !item.entryId) throw new Error('Mirror 已有词 Entry ID 无效');
  return Object.freeze({
    entryId: item.entryId,
    entryText: String(item.entryText || '').slice(0, 160),
    entryKind: ['word', 'phrase', 'content'].includes(item.entryKind) ? item.entryKind : '',
    mirrorClass: ['vocabulary', 'phrase', 'usage'].includes(item.mirrorClass) ? item.mirrorClass : 'vocabulary',
    matchType: ['exact', 'inflection', 'phrase', 'usage', 'semantic'].includes(item.matchType) ? item.matchType : 'semantic',
    surfaceForm: String(item.surfaceForm || '').slice(0, 160),
    lemma: String(item.lemma || '').slice(0, 160),
    importance: ['core', 'related', 'context'].includes(item.importance) ? item.importance : 'related',
    glossHans: String(item.glossHans || '').slice(0, 160),
    glossHant: String(item.glossHant || '').slice(0, 160),
    evidence: validateEvidence(item.evidence),
    relationNoise: Boolean(item.relationNoise),
  });
}

function validateCandidateImport(item) {
  if (!item || typeof item !== 'object') throw new Error('Mirror 新词记录无效');
  if (typeof item.candidateId !== 'string' || !item.candidateId || typeof item.entryId !== 'string' || !item.entryId) {
    throw new Error('Mirror 新词记录 ID 无效');
  }
  return Object.freeze({
    candidateId: item.candidateId,
    entryId: item.entryId,
    text: String(item.text || '').slice(0, 160),
    mirrorClass: ['vocabulary', 'phrase', 'usage'].includes(item.mirrorClass) ? item.mirrorClass : 'vocabulary',
    importance: ['core', 'related', 'context'].includes(item.importance) ? item.importance : 'related',
    evidence: validateEvidence(item.evidence),
    collectionKeys: Object.freeze(Array.isArray(item.collectionKeys) ? [...new Set(item.collectionKeys.filter((id) => typeof id === 'string'))].slice(0, 16) : []),
    relatedEntryIds: Object.freeze(Array.isArray(item.relatedEntryIds) ? [...new Set(item.relatedEntryIds.filter((id) => typeof id === 'string'))].slice(0, 32) : []),
  });
}

/** @param {any} value */
export function validateMirrorRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Mirror 记录必须是对象');
  if (![MIRROR_PROTOCOL, LEGACY_MIRROR_PROTOCOL].includes(value.protocol)) throw new Error('Mirror 协议版本不兼容');
  if (typeof value.mirrorId !== 'string' || !value.mirrorId || value.mirrorId.length > 160) throw new Error('Mirror ID 无效');
  if (!validIso(value.createdAt)) throw new Error('Mirror 时间无效');
  if (typeof value.sourceCorpusHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.sourceCorpusHash)) throw new Error('Mirror Corpus hash 无效');
  if (typeof value.mirrorHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.mirrorHash)) throw new Error('Mirror hash 无效');
  if (!Number.isSafeInteger(value.requestSequence) || value.requestSequence < 1) throw new Error('Mirror sequence 无效');
  if (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string' || !id || id.length > 220)) throw new Error('Mirror Entry ID 列表无效');
  if (new Set(value.entryIds).size !== value.entryIds.length) throw new Error('Mirror Entry ID 重复');
  const materialLabel = typeof value.material?.label === 'string'
    ? value.material.label.slice(0, 160)
    : typeof value.materialLabel === 'string' ? value.materialLabel.slice(0, 160) : '';
  return Object.freeze({
    protocol: value.protocol,
    mirrorId: value.mirrorId,
    runId: typeof value.runId === 'string' && value.runId
      ? value.runId.slice(0, 160)
      : value.mirrorId.startsWith('mirror_') ? value.mirrorId.slice('mirror_'.length) : '',
    createdAt: value.createdAt,
    sourceCorpusHash: value.sourceCorpusHash,
    matchCorpusHash: typeof value.matchCorpusHash === 'string' ? value.matchCorpusHash : '',
    mirrorHash: value.mirrorHash,
    requestSequence: value.requestSequence,
    entryIds: Object.freeze([...value.entryIds]),
    materialLabel,
    material: Object.freeze({
      label: materialLabel,
      sourceDigest: typeof value.material?.sourceDigest === 'string' ? value.material.sourceDigest.slice(0, 180) : '',
    }),
    existingMatches: Object.freeze(Array.isArray(value.existingMatches) ? value.existingMatches.map(validateExistingMatch) : []),
    candidateImports: Object.freeze(Array.isArray(value.candidateImports) ? value.candidateImports.map(validateCandidateImport) : []),
    matchMode: ['lexical', 'semantic', 'balanced'].includes(value.matchMode) ? value.matchMode : 'lexical',
  });
}

function emit(type) {
  const snapshot = getMirrorSnapshot();
  for (const listener of listeners) listener({ type, snapshot });
}

function libraryRows() {
  return [...library.values()]
    .sort((left, right) => String(right.record.createdAt).localeCompare(String(left.record.createdAt)))
    .map((item) => ({
      record: clone(item.record),
      reviewedAt: item.reviewedAt,
    }));
}

export async function initializeMirrorRuntime() {
  if (initialized) return getMirrorSnapshot();
  const rows = await readRows();
  let currentId = '';
  let legacyCurrent = null;
  for (const row of rows) {
    if (row?.key === CURRENT_KEY) {
      if (typeof row.mirrorId === 'string') {
        currentId = row.mirrorId;
        // Existing installs predate persisted enabled state. Preserve the old
        // selected-Mirror expectation by treating a missing flag as enabled
        // once, then writing an explicit boolean on the next state change.
        enabledPreference = row.enabled === undefined ? true : row.enabled === true;
      } else if (row.value) {
        legacyCurrent = row.value;
        enabledPreference = true;
      }
      continue;
    }
    if (!String(row?.key || '').startsWith(RECORD_PREFIX) || !row.record) continue;
    try {
      const record = validateMirrorRecord(row.record);
      library.set(record.mirrorId, {
        record,
        reviewedAt: validIso(row.reviewedAt) ? row.reviewedAt : record.createdAt,
      });
    } catch {}
  }
  if (legacyCurrent) {
    try {
      const record = validateMirrorRecord(legacyCurrent);
      library.set(record.mirrorId, { record, reviewedAt: record.createdAt });
      currentId = record.mirrorId;
      await putRow({ key: RECORD_PREFIX + record.mirrorId, record: clone(record), reviewedAt: record.createdAt });
      await putRow({ key: CURRENT_KEY, mirrorId: record.mirrorId, enabled: true });
    } catch {}
  }
  current = library.get(currentId)?.record || null;
  active = enabledPreference && current ? validateMirrorRecord(clone(current)) : null;
  if (!current) enabledPreference = false;
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
    library: libraryRows(),
    suppressionRevision: suppression.revision,
  };
}

/** @param {any} record @param {Iterable<string>} structuralEntryIds */
export async function commitMirrorCurrent(record, structuralEntryIds) {
  await initializeMirrorRuntime();
  const validated = validateMirrorRecord(record);
  const universe = new Set(structuralEntryIds);
  for (const id of validated.entryIds) if (!universe.has(id)) throw new Error('Mirror 包含当前词库未知 Entry：' + id);
  const reviewedAt = new Date().toISOString();
  const envelope = { record: validated, reviewedAt };
  library.set(validated.mirrorId, envelope);
  await putRow({ key: RECORD_PREFIX + validated.mirrorId, ...clone(envelope) });
  current = validated;
  if (enabledPreference) {
    active = validateMirrorRecord(clone(current));
    setMirrorSuppression(suppression, universe, active.entryIds);
  }
  await putRow({ key: CURRENT_KEY, mirrorId: validated.mirrorId, enabled: enabledPreference });
  emit('current');
  return getMirrorSnapshot();
}

export async function selectMirrorCurrent(mirrorId) {
  await initializeMirrorRuntime();
  const envelope = library.get(String(mirrorId || ''));
  if (!envelope) throw new Error('Mirror 材料不存在');
  if (active && active.mirrorId !== envelope.record.mirrorId) await deactivateMirror();
  current = envelope.record;
  await putRow({ key: CURRENT_KEY, mirrorId: current.mirrorId, enabled: enabledPreference });
  emit('selected');
  return getMirrorSnapshot();
}

/** @param {Iterable<string>} structuralEntryIds @param {string} mirrorId */
export async function activateMirror(structuralEntryIds, mirrorId = '') {
  await initializeMirrorRuntime();
  if (mirrorId) await selectMirrorCurrent(mirrorId);
  if (!current) throw new Error('当前设备没有可用 Mirror');
  active = validateMirrorRecord(clone(current));
  enabledPreference = true;
  setMirrorSuppression(suppression, structuralEntryIds, active.entryIds);
  await putRow({ key: CURRENT_KEY, mirrorId: current.mirrorId, enabled: true });
  emit('active');
  return getMirrorSnapshot();
}

export async function deactivateMirror() {
  active = null;
  enabledPreference = false;
  setMirrorSuppression(suppression, [], null);
  if (current) await putRow({ key: CURRENT_KEY, mirrorId: current.mirrorId, enabled: false });
  emit('inactive');
  return getMirrorSnapshot();
}

export async function deleteMirrorRecord(mirrorId) {
  await initializeMirrorRuntime();
  const id = String(mirrorId || '');
  const envelope = library.get(id);
  if (!envelope) return getMirrorSnapshot();
  if (active?.mirrorId === id) await deactivateMirror();
  library.delete(id);
  await deleteRow(RECORD_PREFIX + id);
  if (current?.mirrorId === id) {
    current = null;
    await deleteRow(CURRENT_KEY);
  }
  emit('deleted');
  return getMirrorSnapshot();
}

/** @param {Map<string, any[]>} structuralProjection */
export function effectiveProjectionFromMirror(structuralProjection) {
  if (active) {
    const universe = new Set();
    for (const entries of structuralProjection.values()) {
      for (const entry of entries) if (entry?.id) universe.add(entry.id);
    }
    setMirrorSuppression(suppression, universe, active.entryIds);
  }
  return deriveEffectiveProjection(structuralProjection, suppression);
}

export function effectiveEntryAllowed(entryId) {
  return !suppression.suppressed(entryId, 'entry');
}

export async function clearMirrorCurrent() {
  await initializeMirrorRuntime();
  await deleteRow(CURRENT_KEY);
  current = null;
  enabledPreference = false;
  emit(active ? 'current-cleared-active-preserved' : 'current-cleared');
  return getMirrorSnapshot();
}
