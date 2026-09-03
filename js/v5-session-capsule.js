// @ts-check

import { MIRROR_PROTOCOL } from './v5-mirror-runtime.js';

export const SESSION_PROTOCOL = 'vix-session-capsule/2';
export const MATCH_REQUEST_KIND = 'vix-match-request';
export const MATCH_RESULT_KIND = 'vix-match-result';
export const SESSION_TTL_MS = 30 * 60 * 1000;
const DB_NAME = 'vix-session-runtime-v1';
const DB_VERSION = 1;
const STORE = 'sessions';
const memorySessions = new Map();
let databasePromise = null;

function clean(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeJson(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeJson(value));
}

export async function sha256Json(value) {
  if (!globalThis.crypto?.subtle) throw new Error('当前环境不支持安全 hash');
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function randomId(prefix) {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  const encoded = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${encoded}`;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Session runtime 读取失败'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Session runtime 写入失败'));
    transaction.onabort = () => reject(transaction.error || new Error('Session runtime 事务中止'));
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'sessionId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error || new Error('无法打开 Session runtime')); };
  });
  return databasePromise;
}

async function saveSession(session) {
  memorySessions.set(session.sessionId, structuredClone(session));
  const db = await openDatabase();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(structuredClone(session));
  await transactionPromise(tx);
}

export async function readSession(sessionId) {
  if (memorySessions.has(sessionId)) return structuredClone(memorySessions.get(sessionId));
  const db = await openDatabase();
  if (!db) return null;
  const tx = db.transaction(STORE, 'readonly');
  const session = await requestPromise(tx.objectStore(STORE).get(sessionId));
  await transactionPromise(tx);
  if (session) memorySessions.set(sessionId, structuredClone(session));
  return session ? structuredClone(session) : null;
}

export async function listSessions() {
  const db = await openDatabase();
  if (!db) return [...memorySessions.values()].map((item) => structuredClone(item));
  const tx = db.transaction(STORE, 'readonly');
  const sessions = await requestPromise(tx.objectStore(STORE).getAll());
  await transactionPromise(tx);
  return sessions.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((item) => structuredClone(item));
}

export async function deleteSession(sessionId) {
  memorySessions.delete(sessionId);
  const db = await openDatabase();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(sessionId);
  await transactionPromise(tx);
}

function membershipLabels(state, entryId) {
  return (state.membershipsByEntry.get(entryId) || []).map((membership) => {
    const collection = state.collectionById.get(membership.collectionId);
    return collection && collection.type === 'normal' ? clean(collection.label || collection.name, 100) : '';
  }).filter(Boolean).sort();
}

/**
 * Freeze the complete Structural lexical universe. The public Match Corpus has
 * slots but no Entry IDs; the slot map remains in this device-only session DB.
 * @param {any} state
 * @param {{materialLabel?: string, matchMode?: 'lexical'|'semantic', ttlMs?: number}} [options]
 */
export async function createMatchRequest(state, options = {}) {
  const entries = [...state.entries].sort((a, b) => a.id.localeCompare(b.id));
  const domains = state.domainById;
  const privateRows = entries.map((entry) => ({
    id: entry.id,
    normalizedText: entry.normalizedText,
    kind: entry.kind,
    domainId: entry.domainId,
    memberships: (state.membershipsByEntry.get(entry.id) || []).map((item) => item.collectionId).sort(),
  }));
  const sourceCorpusHash = await sha256Json(privateRows);
  const corpus = entries.map((entry, index) => ({
    slot: index + 1,
    text: entry.text,
    normalizedText: entry.normalizedText,
    kind: entry.kind,
    domain: clean(domains.get(entry.domainId)?.name || entry.domainId, 100),
    collections: membershipLabels(state, entry.id),
    partsOfSpeech: Array.isArray(entry.partsOfSpeech) ? entry.partsOfSpeech.map((item) => clean(item, 40)).filter(Boolean) : [],
    glossHant: clean(entry.glossHant, 160),
  }));
  const matchCorpusHash = await sha256Json(corpus);
  const createdAt = new Date().toISOString();
  const ttlMs = Math.max(5 * 60 * 1000, Math.min(2 * 60 * 60 * 1000, Number(options.ttlMs || SESSION_TTL_MS)));
  const sessionId = randomId('vixs');
  const matchMode = options.matchMode === 'semantic' ? 'semantic' : 'lexical';
  const request = {
    protocol: SESSION_PROTOCOL,
    kind: MATCH_REQUEST_KIND,
    sessionId,
    createdAt,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    requestSequence: 1,
    sourceCorpusHash,
    matchCorpusHash,
    matchMode,
    materialLabel: clean(options.materialLabel, 160),
    corpus,
    resultContract: {
      protocol: SESSION_PROTOCOL,
      kind: MATCH_RESULT_KIND,
      required: ['sessionId', 'sourceCorpusHash', 'matchCorpusHash', 'requestSequence', 'matchedSlots'],
      matchedSlots: 'unique integer slots copied from this corpus; never invent an Entry ID',
    },
  };
  await saveSession({
    sessionId,
    createdAt,
    expiresAt: request.expiresAt,
    requestSequence: 1,
    sourceCorpusHash,
    matchCorpusHash,
    matchMode,
    materialLabel: request.materialLabel,
    slotEntryIds: entries.map((entry) => entry.id),
    status: 'created',
    request,
  });
  return structuredClone(request);
}

export function buildMatcherPrompt(request) {
  return [
    '请把我提供的材料与附件中的 VIX frozen Match Corpus 做匹配。',
    request.matchMode === 'semantic'
      ? '允许明确的语义匹配，但只可选择 corpus 中已有 slot。'
      : '采用偏严格的词汇证据匹配；不要仅因主题相关就选择。',
    '不得生成或猜测 Entry ID，不得增加 corpus 中不存在的词。',
    '仅返回一个 JSON 对象，字段为 protocol、kind、sessionId、sourceCorpusHash、matchCorpusHash、requestSequence、matchedSlots。',
    `sessionId=${request.sessionId}`,
    `sourceCorpusHash=${request.sourceCorpusHash}`,
    `matchCorpusHash=${request.matchCorpusHash}`,
    `requestSequence=${request.requestSequence}`,
  ].join('\n');
}

/** @param {any} payload */
export function validateResultShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Capsule 必须是 JSON 对象');
  if (payload.protocol !== SESSION_PROTOCOL || payload.kind !== MATCH_RESULT_KIND) throw new Error('Capsule 协议或类型不兼容');
  if (typeof payload.sessionId !== 'string' || !payload.sessionId) throw new Error('Capsule sessionId 无效');
  if (!Number.isSafeInteger(payload.requestSequence) || payload.requestSequence < 1) throw new Error('Capsule sequence 无效');
  if (!Array.isArray(payload.matchedSlots) || payload.matchedSlots.some((slot) => !Number.isSafeInteger(slot) || slot < 1)) throw new Error('Capsule slots 无效');
  if (new Set(payload.matchedSlots).size !== payload.matchedSlots.length) throw new Error('Capsule slots 重复');
  return payload;
}

/**
 * Verify a returned Capsule against the exact locally frozen session, then
 * translate slots back into canonical Entry IDs on-device.
 * @param {any} payload
 */
export async function acceptMatchResult(payload) {
  const result = validateResultShape(payload);
  const session = await readSession(result.sessionId);
  if (!session) throw new Error('本机找不到该 Capsule 对应的 Session');
  if (Date.now() > Date.parse(session.expiresAt)) throw new Error('Session 已过期');
  if (result.sourceCorpusHash !== session.sourceCorpusHash || result.matchCorpusHash !== session.matchCorpusHash) throw new Error('Capsule Corpus hash 与冻结 Session 不一致');
  if (result.requestSequence !== session.requestSequence) throw new Error('Capsule sequence 已过期');
  if (result.matchedSlots.some((slot) => slot > session.slotEntryIds.length)) throw new Error('Capsule 包含未知 slot');
  const entryIds = result.matchedSlots.map((slot) => session.slotEntryIds[slot - 1]);
  const createdAt = new Date().toISOString();
  const mirrorCore = {
    protocol: MIRROR_PROTOCOL,
    mirrorId: randomId('mirror'),
    createdAt,
    sourceCorpusHash: session.sourceCorpusHash,
    matchCorpusHash: session.matchCorpusHash,
    requestSequence: session.requestSequence,
    entryIds,
    materialLabel: session.materialLabel,
    matchMode: session.matchMode,
  };
  const mirrorHash = await sha256Json(mirrorCore);
  session.status = 'accepted';
  session.acceptedAt = createdAt;
  session.requestSequence += 1;
  await saveSession(session);
  return { ...mirrorCore, mirrorHash };
}

export async function publishMatchRequest(request, { signal = null } = {}) {
  const response = await fetch('./api/vix/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ownerToken) throw new Error(payload?.error?.message || `Session Bridge 请求失败（HTTP ${response.status}）`);
  const session = await readSession(request.sessionId);
  if (!session) throw new Error('本地 Session 已丢失');
  session.serverBinding = {
    ownerToken: payload.ownerToken,
    readToken: payload.readToken,
    writeToken: payload.writeToken,
    exchangePath: payload.exchangePath,
  };
  session.status = 'published';
  await saveSession(session);
  return structuredClone(session.serverBinding);
}

export async function pollPublishedResult(sessionId, { signal = null } = {}) {
  const session = await readSession(sessionId);
  const binding = session?.serverBinding;
  if (!binding?.ownerToken) throw new Error('Session 尚未发布到 Bridge');
  const response = await fetch(`./api/vix/sessions/${encodeURIComponent(sessionId)}/result`, {
    headers: { 'accept': 'application/json', 'authorization': `Bearer ${binding.ownerToken}` },
    cache: 'no-store', credentials: 'same-origin', signal,
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `读取 Capsule 失败（HTTP ${response.status}）`);
  return payload;
}
