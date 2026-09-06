// @ts-check

import { MIRROR_PROTOCOL } from './v5-mirror-runtime.js';

export const MIRROR_CONTEXT_PROTOCOL = 'vix-mirror-context/3';
export const MIRROR_RESULT_PROTOCOL = 'vix-mirror-result/3';
const DB_NAME = 'vix-mirror3-runtime-v1';
const DB_VERSION = 1;
const CONTEXTS = 'contexts';
const PENDING = 'pending';
let databasePromise = null;
const memoryStores = { [CONTEXTS]: new Map(), [PENDING]: new Map() };

function clone(value) { return value == null ? value : structuredClone(value); }
function clean(value, max = 240) { return String(value ?? '').trim().slice(0, max); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
async function hashJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Mirror 3 数据读取失败'));
  });
}
function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Mirror 3 数据写入失败'));
    transaction.onabort = () => reject(transaction.error || new Error('Mirror 3 事务中止'));
  });
}
function openDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONTEXTS)) db.createObjectStore(CONTEXTS, { keyPath: 'revision' });
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: 'runId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error || new Error('无法打开 Mirror 3 数据库')); };
  });
  return databasePromise;
}
async function put(storeName, value) {
  const db = await openDatabase();
  if (!db) {
    const key = storeName === CONTEXTS ? value.revision : value.runId;
    memoryStores[storeName].set(key, clone(value));
    return;
  }
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(clone(value));
  await transactionPromise(tx);
}
async function get(storeName, key) {
  const db = await openDatabase();
  if (!db) return clone(memoryStores[storeName].get(key) || null);
  const tx = db.transaction(storeName, 'readonly');
  const result = await requestPromise(tx.objectStore(storeName).get(key));
  await transactionPromise(tx);
  return clone(result || null);
}

export async function buildMirrorContext(state) {
  const entries = [...state.entries].sort((a, b) => a.id.localeCompare(b.id));
  const normalCollections = [...state.collections]
    .filter((item) => item.type === 'normal' && !item.hidden)
    .sort((a, b) => a.domainId.localeCompare(b.domainId) || Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id));
  const collectionIds = new Set(normalCollections.map((item) => item.id));
  const privateRows = entries.map((entry) => ({
    id: entry.id, normalizedText: entry.normalizedText, kind: entry.kind, domainId: entry.domainId,
    collections: (state.membershipsByEntry.get(entry.id) || []).map((item) => item.collectionId).filter((id) => collectionIds.has(id)).sort(),
  }));
  const corpus = entries.map((entry, index) => ({
    slot: index + 1,
    text: entry.text,
    normalizedText: entry.normalizedText,
    kind: entry.kind,
    domainKey: entry.domainId,
    collectionKeys: privateRows[index].collections,
    partsOfSpeech: Array.isArray(entry.partsOfSpeech) ? entry.partsOfSpeech.slice(0, 8) : [],
    glossHant: clean(entry.glossHant, 160),
  }));
  const catalog = {
    domains: [...state.domains].sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id))
      .map((item) => ({ key: item.id, name: item.name, contentMode: item.contentMode || 'structured', glossEnabled: Boolean(item.glossEnabled) })),
    collections: normalCollections.map((item) => ({ key: item.id, domainKey: item.domainId, name: item.name })),
  };
  const sourceCorpusHash = await hashJson(privateRows);
  const matchCorpusHash = await hashJson(corpus);
  const collectionCatalogHash = await hashJson(catalog);
  const revision = await hashJson({ sourceCorpusHash, matchCorpusHash, collectionCatalogHash });
  const context = {
    protocol: MIRROR_CONTEXT_PROTOCOL,
    revision,
    createdAt: new Date().toISOString(),
    sourceCorpusHash,
    matchCorpusHash,
    collectionCatalogHash,
    corpus,
    catalog,
    resultContract: {
      protocol: MIRROR_RESULT_PROTOCOL,
      kind: 'vix-mirror-result',
      required: [
        'protocol', 'kind', 'runId', 'contextRevision', 'sourceCorpusHash', 'matchCorpusHash',
        'collectionCatalogHash', 'materialLabel', 'matchedSlots', 'candidates',
      ],
      matchedSlots: 'unique integer slots copied from corpus',
      candidate: {
        required: [
          'candidateId', 'text', 'normalizedText', 'kind', 'partsOfSpeech', 'glossHans', 'glossHant',
          'domainKey', 'collectionKeys', 'evidence', 'relatedExistingSlots',
        ],
        kind: 'word, phrase, or content; content is only valid in a nonStructured domain',
        tags: 'domainKey and collectionKeys copied from catalog; never invent keys',
        evidence: 'array of {quote, location}; keep quotes short',
        relatedExistingSlots: 'unique integer slots copied from corpus',
      },
    },
  };
  const validationContext = {
    revision, sourceCorpusHash, matchCorpusHash, collectionCatalogHash, catalog,
  };
  await put(CONTEXTS, { revision, context: validationContext, slotEntryIds: entries.map((entry) => entry.id), savedAt: context.createdAt });
  return clone(context);
}

export function createMirrorRequestFile(context, materialLabel = '') {
  if (context?.protocol !== MIRROR_CONTEXT_PROTOCOL) throw new Error('Mirror Context 无效');
  return {
    protocol: MIRROR_CONTEXT_PROTOCOL,
    kind: 'vix-mirror-request',
    materialLabel: clean(materialLabel, 160),
    ...clone(context),
  };
}

function validateHash(value, field) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} 无效`);
}
function validateCandidate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('候选词格式无效');
  const candidateId = clean(value.candidateId, 120);
  const text = clean(value.text, 160);
  if (!candidateId || !text) throw new Error('候选词缺少 ID 或文本');
  const kind = ['word', 'phrase', 'content'].includes(value.kind) ? value.kind : (text.split(/\s+/).length > 1 ? 'phrase' : 'word');
  const collectionKeys = Array.isArray(value.collectionKeys)
    ? [...new Set(value.collectionKeys.map((item) => clean(item, 180)).filter(Boolean))].slice(0, 16) : [];
  const evidence = Array.isArray(value.evidence) ? value.evidence.slice(0, 8).map((item) => ({
    quote: clean(item?.quote, 400), location: clean(item?.location, 120),
  })).filter((item) => item.quote) : [];
  return {
    candidateId, text, normalizedText: clean(value.normalizedText, 160), kind,
    partsOfSpeech: Array.isArray(value.partsOfSpeech) ? [...new Set(value.partsOfSpeech.map((item) => clean(item, 40)).filter(Boolean))].slice(0, 8) : [],
    glossHans: clean(value.glossHans, 160), glossHant: clean(value.glossHant, 160),
    domainKey: clean(value.domainKey, 180), collectionKeys, evidence,
    relatedExistingSlots: Array.isArray(value.relatedExistingSlots)
      ? [...new Set(value.relatedExistingSlots.filter((slot) => Number.isSafeInteger(slot) && slot > 0))].slice(0, 32) : [],
  };
}

export async function prepareMirrorResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Mirror 结果必须是 JSON 对象');
  if (raw.protocol !== MIRROR_RESULT_PROTOCOL || raw.kind !== 'vix-mirror-result') throw new Error('Mirror 结果协议不兼容');
  const runId = clean(raw.runId, 160);
  const contextRevision = clean(raw.contextRevision, 100);
  if (!runId || !contextRevision) throw new Error('Mirror 结果缺少 runId 或 contextRevision');
  validateHash(raw.sourceCorpusHash, 'sourceCorpusHash');
  validateHash(raw.matchCorpusHash, 'matchCorpusHash');
  validateHash(raw.collectionCatalogHash, 'collectionCatalogHash');
  const session = await get(CONTEXTS, contextRevision);
  if (!session) throw new Error('本机找不到该 Mirror 结果对应的上下文');
  const context = session.context;
  if (raw.sourceCorpusHash !== context.sourceCorpusHash || raw.matchCorpusHash !== context.matchCorpusHash
    || raw.collectionCatalogHash !== context.collectionCatalogHash) throw new Error('Mirror 结果与本机冻结上下文不一致');
  const matchedSlots = Array.isArray(raw.matchedSlots) ? raw.matchedSlots : [];
  if (matchedSlots.some((slot) => !Number.isSafeInteger(slot) || slot < 1 || slot > session.slotEntryIds.length)
    || new Set(matchedSlots).size !== matchedSlots.length) throw new Error('Mirror matchedSlots 无效');
  const candidates = Array.isArray(raw.candidates) ? raw.candidates.map(validateCandidate) : [];
  if (new Set(candidates.map((item) => item.candidateId)).size !== candidates.length) throw new Error('Mirror candidateId 重复');
  for (const candidate of candidates) {
    if (candidate.relatedExistingSlots.some((slot) => slot > session.slotEntryIds.length)) throw new Error('Mirror relatedExistingSlots 无效');
  }
  const domainByKey = new Map(context.catalog.domains.map((item) => [item.key, item]));
  const collectionByKey = new Map(context.catalog.collections.map((item) => [item.key, item]));
  const reviewed = candidates.map((candidate) => {
    const domain = domainByKey.get(candidate.domainKey);
    const collections = candidate.collectionKeys.filter((key) => collectionByKey.get(key)?.domainKey === candidate.domainKey);
    const kindMatchesDomain = domain?.contentMode === 'nonStructured' ? candidate.kind === 'content' : candidate.kind !== 'content';
    const valid = Boolean(domain) && kindMatchesDomain && collections.length > 0;
    const relatedEntryIds = candidate.relatedExistingSlots.map((slot) => session.slotEntryIds[slot - 1]);
    return { ...candidate, collectionKeys: collections, relatedEntryIds, valid };
  });
  const createdAt = new Date().toISOString();
  const mirrorCore = {
    protocol: MIRROR_PROTOCOL,
    mirrorId: `mirror_${runId}`,
    createdAt,
    sourceCorpusHash: raw.sourceCorpusHash,
    matchCorpusHash: raw.matchCorpusHash,
    requestSequence: 1,
    entryIds: matchedSlots.map((slot) => session.slotEntryIds[slot - 1]),
    materialLabel: clean(raw.materialLabel, 160),
    matchMode: 'semantic',
  };
  const mirrorHash = await hashJson(mirrorCore);
  return { runId, contextRevision, mirrorRecord: { ...mirrorCore, mirrorHash }, candidates: reviewed, raw: clone(raw) };
}

export async function extendMirrorRecord(record, entryIds) {
  const core = clone(record);
  delete core.mirrorHash;
  core.entryIds = [...new Set(entryIds || [])];
  return { ...core, mirrorHash: await hashJson(core) };
}

export async function savePendingMirrorResult(raw) {
  const prepared = await prepareMirrorResult(raw);
  await put(PENDING, { runId: prepared.runId, receivedAt: new Date().toISOString(), raw: clone(raw) });
  return prepared;
}

export async function listPendingMirrorResults() {
  const db = await openDatabase();
  if (!db) return [...memoryStores[PENDING].values()].sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt))).map(clone);
  const tx = db.transaction(PENDING, 'readonly');
  const items = await requestPromise(tx.objectStore(PENDING).getAll());
  await transactionPromise(tx);
  return items.sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt))).map(clone);
}

export async function removePendingMirrorResult(runId) {
  const db = await openDatabase();
  if (!db) { memoryStores[PENDING].delete(runId); return; }
  const tx = db.transaction(PENDING, 'readwrite');
  tx.objectStore(PENDING).delete(runId);
  await transactionPromise(tx);
}
