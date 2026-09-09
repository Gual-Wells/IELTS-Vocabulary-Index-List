// @ts-check

import { MIRROR_PROTOCOL } from './v5-mirror-runtime.js';

export const MIRROR_CONTEXT_PROTOCOL = 'vix-mirror-context/4';
export const MIRROR_RESULT_PROTOCOL = 'vix-mirror-result/4';
export const LEGACY_MIRROR_RESULT_PROTOCOL = 'vix-mirror-result/3';
const DB_NAME = 'vix-mirror3-runtime-v1';
const DB_VERSION = 2;
const CONTEXTS = 'contexts';
let databasePromise = null;
const memoryStores = { [CONTEXTS]: new Map() };

function clone(value) { return value == null ? value : structuredClone(value); }
function clean(value, max = 240) { return String(value ?? '').trim().slice(0, max); }
function cleanGloss(value) {
  const result = clean(value, 160);
  const questionCount = (result.match(/[?？]/g) || []).length;
  const nonQuestionContent = result.replace(/[\s?？,.;:!，。；：！、()[\]{}'"“”‘’·—_-]/g, '');
  return /\uFFFD/.test(result) || (questionCount >= 2 && !nonQuestionContent) ? '' : result;
}
function cleanGlossPair(hans, hant) {
  const nextHans = cleanGloss(hans);
  const nextHant = cleanGloss(hant);
  return { glossHans: nextHans || nextHant, glossHant: nextHant || nextHans };
}
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
    request.onerror = () => reject(request.error || new Error('Mirror 数据读取失败'));
  });
}
function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Mirror 数据写入失败'));
    transaction.onabort = () => reject(transaction.error || new Error('Mirror 事务中止'));
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
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { databasePromise = null; reject(request.error || new Error('无法打开 Mirror 数据库')); };
  });
  return databasePromise;
}
async function put(storeName, value) {
  const db = await openDatabase();
  if (!db) {
    memoryStores[storeName].set(value.revision, clone(value));
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
  const corpus = entries.map((entry, index) => {
    const glosses = cleanGlossPair(entry.glossHans, entry.glossHant);
    return {
      slot: index + 1,
      text: entry.text,
      normalizedText: entry.normalizedText,
      kind: entry.kind,
      domainKey: entry.domainId,
      collectionKeys: privateRows[index].collections,
      partsOfSpeech: Array.isArray(entry.partsOfSpeech) ? entry.partsOfSpeech.slice(0, 8) : [],
      ...glosses,
      relationNoise: entry.kind === 'word' && Boolean(state.lowLevelRelationLexemes?.has(entry.normalizedText)),
    };
  });
  const catalog = {
    domains: [...state.domains].sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id))
      .map((item) => ({ key: item.id, name: item.name, contentMode: item.contentMode || 'structured', glossEnabled: Boolean(item.glossEnabled) })),
    collections: normalCollections.map((item) => ({ key: item.id, domainKey: item.domainId, name: item.name })),
  };
  const sourceCorpusHash = await hashJson(privateRows);
  const matchCorpusHash = await hashJson(corpus);
  const collectionCatalogHash = await hashJson(catalog);
  const matchPolicy = {
    classes: ['vocabulary', 'phrase', 'usage'],
    equalPriority: true,
    phraseAndUsageNeverSuppressedByComponentNoise: true,
    relationNoiseLexemes: [...(state.lowLevelRelationLexemes || [])].sort((left, right) => left.localeCompare(right, 'en')),
    relationNoiseBehavior: 'deprioritize standalone vocabulary matches; retain when materially relevant',
  };
  const matchPolicyHash = await hashJson(matchPolicy);
  const revision = await hashJson({ sourceCorpusHash, matchCorpusHash, collectionCatalogHash, matchPolicyHash });
  const context = {
    protocol: MIRROR_CONTEXT_PROTOCOL,
    revision,
    createdAt: new Date().toISOString(),
    sourceCorpusHash,
    matchCorpusHash,
    collectionCatalogHash,
    matchPolicyHash,
    corpus,
    catalog,
    matchPolicy,
    resultContract: {
      protocol: MIRROR_RESULT_PROTOCOL,
      kind: 'vix-mirror-result',
      required: [
        'protocol', 'kind', 'runId', 'contextRevision', 'sourceCorpusHash', 'matchCorpusHash',
        'collectionCatalogHash', 'matchPolicyHash', 'materialLabel', 'existingMatches', 'candidates',
      ],
      existingMatch: {
        required: ['slot', 'mirrorClass', 'matchType', 'surfaceForm', 'importance', 'evidence'],
        mirrorClass: 'vocabulary, phrase, or usage; all three classes have equal priority',
        matchType: 'exact, inflection, phrase, usage, or semantic',
        importance: 'core, related, or context',
        glossRepair: 'optional glossHans/glossHant only when the frozen corpus gloss is missing or visibly corrupted',
        lowLevelPolicy: 'corpus relationNoise only deprioritizes a standalone vocabulary component; never suppress a phrase or usage',
        evidence: 'array of {quote, location}; at least one short source excerpt',
      },
      candidate: {
        required: [
          'candidateId', 'text', 'normalizedText', 'kind', 'mirrorClass', 'partsOfSpeech', 'glossHans', 'glossHant',
          'domainKey', 'collectionKeys', 'evidence', 'relatedExistingSlots',
        ],
        mirrorClass: 'vocabulary, phrase, or usage; independent from storage kind',
        kind: 'word, phrase, or content; content is only valid in a nonStructured domain',
        tags: 'domainKey and collectionKeys copied from catalog; never invent keys',
        evidence: 'array of {quote, location}; keep quotes short',
        relatedExistingSlots: 'unique integer slots copied from corpus',
      },
    },
  };
  const validationContext = {
    revision, sourceCorpusHash, matchCorpusHash, collectionCatalogHash, matchPolicyHash, catalog, matchPolicy,
  };
  await put(CONTEXTS, {
    revision,
    context: validationContext,
    slotEntryIds: entries.map((entry) => entry.id),
    slotMetadata: corpus.map((entry) => ({
      text: entry.text, normalizedText: entry.normalizedText, kind: entry.kind, relationNoise: entry.relationNoise,
    })),
    savedAt: context.createdAt,
  });
  return clone(context);
}

function validateHash(value, field) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`${field} 无效`);
}
function validateEvidence(value) {
  return Array.isArray(value) ? value.slice(0, 8).map((item) => ({
    quote: clean(item?.quote, 400), location: clean(item?.location, 120),
  })).filter((item) => item.quote) : [];
}
function mirrorClass(value, fallback = 'vocabulary') {
  return ['vocabulary', 'phrase', 'usage'].includes(value) ? value : fallback;
}
function importance(value) {
  return ['core', 'related', 'context'].includes(value) ? value : 'related';
}
function validateExistingMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('已有词匹配格式无效');
  const slot = Number(value.slot);
  if (!Number.isSafeInteger(slot) || slot < 1) throw new Error('已有词匹配 slot 无效');
  const evidence = validateEvidence(value.evidence);
  if (!evidence.length) throw new Error('已有词匹配必须提供原文证据');
  const glosses = cleanGlossPair(value.glossHans, value.glossHant);
  return {
    slot,
    mirrorClass: mirrorClass(value.mirrorClass),
    matchType: ['exact', 'inflection', 'phrase', 'usage', 'semantic'].includes(value.matchType) ? value.matchType : 'semantic',
    surfaceForm: clean(value.surfaceForm, 160),
    lemma: clean(value.lemma, 160),
    importance: importance(value.importance),
    ...glosses,
    evidence,
  };
}
function validateCandidate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('候选词格式无效');
  const candidateId = clean(value.candidateId, 120);
  const text = clean(value.text, 160);
  if (!candidateId || !text) throw new Error('候选词缺少 ID 或文本');
  const kind = ['word', 'phrase', 'content'].includes(value.kind) ? value.kind : (text.split(/\s+/).length > 1 ? 'phrase' : 'word');
  const collectionKeys = Array.isArray(value.collectionKeys)
    ? [...new Set(value.collectionKeys.map((item) => clean(item, 180)).filter(Boolean))].slice(0, 16) : [];
  const evidence = validateEvidence(value.evidence);
  const glosses = cleanGlossPair(value.glossHans, value.glossHant);
  return {
    candidateId, text, normalizedText: clean(value.normalizedText, 160), kind,
    mirrorClass: mirrorClass(value.mirrorClass, kind === 'phrase' ? 'phrase' : kind === 'content' ? 'usage' : 'vocabulary'),
    lemma: clean(value.lemma, 160),
    importance: importance(value.importance),
    confidence: Number.isFinite(Number(value.confidence)) ? Math.max(0, Math.min(1, Number(value.confidence))) : null,
    partsOfSpeech: Array.isArray(value.partsOfSpeech) ? [...new Set(value.partsOfSpeech.map((item) => clean(item, 40)).filter(Boolean))].slice(0, 8) : [],
    ...glosses,
    domainKey: clean(value.domainKey, 180), collectionKeys, evidence,
    relatedExistingSlots: Array.isArray(value.relatedExistingSlots)
      ? [...new Set(value.relatedExistingSlots.filter((slot) => Number.isSafeInteger(slot) && slot > 0))].slice(0, 32) : [],
  };
}

export async function prepareMirrorResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Mirror 结果必须是 JSON 对象');
  const legacyResult = raw.protocol === LEGACY_MIRROR_RESULT_PROTOCOL;
  if (![MIRROR_RESULT_PROTOCOL, LEGACY_MIRROR_RESULT_PROTOCOL].includes(raw.protocol) || raw.kind !== 'vix-mirror-result') {
    throw new Error('Mirror 结果协议不兼容');
  }
  const runId = clean(raw.runId, 160);
  const contextRevision = clean(raw.contextRevision, 100);
  if (!runId || !contextRevision) throw new Error('Mirror 结果缺少 runId 或 contextRevision');
  validateHash(raw.sourceCorpusHash, 'sourceCorpusHash');
  validateHash(raw.matchCorpusHash, 'matchCorpusHash');
  validateHash(raw.collectionCatalogHash, 'collectionCatalogHash');
  if (!legacyResult) validateHash(raw.matchPolicyHash, 'matchPolicyHash');
  const session = await get(CONTEXTS, contextRevision);
  if (!session) throw new Error('本机找不到该 Mirror 结果对应的上下文');
  const context = session.context;
  if (raw.sourceCorpusHash !== context.sourceCorpusHash || raw.matchCorpusHash !== context.matchCorpusHash
    || raw.collectionCatalogHash !== context.collectionCatalogHash) throw new Error('Mirror 结果与本机冻结上下文不一致');
  if (!legacyResult && raw.matchPolicyHash !== context.matchPolicyHash) throw new Error('Mirror 匹配策略与本机冻结上下文不一致');
  const legacySlots = Array.isArray(raw.matchedSlots) ? raw.matchedSlots : [];
  if (legacySlots.some((slot) => !Number.isSafeInteger(slot) || slot < 1 || slot > session.slotEntryIds.length)
    || new Set(legacySlots).size !== legacySlots.length) throw new Error('Mirror matchedSlots 无效');
  const matches = legacyResult
    ? legacySlots.map((slot) => ({
      slot,
      mirrorClass: session.slotMetadata?.[slot - 1]?.kind === 'phrase' ? 'phrase'
        : session.slotMetadata?.[slot - 1]?.kind === 'content' ? 'usage' : 'vocabulary',
      matchType: 'semantic',
      surfaceForm: session.slotMetadata?.[slot - 1]?.text || '',
      lemma: '',
      importance: session.slotMetadata?.[slot - 1]?.relationNoise ? 'context' : 'related',
      evidence: [],
    }))
    : (Array.isArray(raw.existingMatches) ? raw.existingMatches.map(validateExistingMatch) : []);
  if (matches.some((item) => item.slot > session.slotEntryIds.length)) throw new Error('Mirror existingMatches slot 无效');
  const matchKeys = matches.map((item) => [item.slot, item.mirrorClass, item.surfaceForm].join('\u0000'));
  if (new Set(matchKeys).size !== matchKeys.length) throw new Error('Mirror existingMatches 重复');
  const candidates = Array.isArray(raw.candidates) ? raw.candidates.map(validateCandidate) : [];
  if (new Set(candidates.map((item) => item.candidateId)).size !== candidates.length) throw new Error('Mirror candidateId 重复');
  for (const candidate of candidates) {
    if (candidate.relatedExistingSlots.some((slot) => slot > session.slotEntryIds.length)) throw new Error('Mirror relatedExistingSlots 无效');
  }
  const domainByKey = new Map(context.catalog.domains.map((item) => [item.key, item]));
  const collectionByKey = new Map(context.catalog.collections.map((item) => [item.key, item]));
  const relationNoiseLexemes = new Set(context.matchPolicy?.relationNoiseLexemes || []);
  const reviewed = candidates.map((candidate) => {
    const domain = domainByKey.get(candidate.domainKey);
    const collections = candidate.collectionKeys.filter((key) => collectionByKey.get(key)?.domainKey === candidate.domainKey);
    const kindMatchesDomain = domain?.contentMode === 'nonStructured' ? candidate.kind === 'content' : candidate.kind !== 'content';
    const hasRequiredGloss = !domain?.glossEnabled || Boolean(candidate.glossHant || candidate.glossHans);
    const valid = Boolean(domain) && kindMatchesDomain && collections.length > 0 && candidate.evidence.length > 0 && hasRequiredGloss;
    const relatedEntryIds = candidate.relatedExistingSlots.map((slot) => session.slotEntryIds[slot - 1]);
    const relationNoise = candidate.kind === 'word' && relationNoiseLexemes.has(candidate.normalizedText);
    return {
      ...candidate,
      collectionKeys: collections,
      relatedEntryIds,
      relationNoise,
      selectedByDefault: !relationNoise || candidate.mirrorClass !== 'vocabulary' || candidate.importance === 'core',
      valid,
    };
  });
  const existingMatches = matches.map((match) => {
    const metadata = session.slotMetadata?.[match.slot - 1] || {};
    const relationNoise = Boolean(metadata.relationNoise);
    return {
      ...match,
      entryId: session.slotEntryIds[match.slot - 1],
      entryText: clean(metadata.text || match.lemma || match.surfaceForm, 160),
      entryKind: ['word', 'phrase', 'content'].includes(metadata.kind) ? metadata.kind : '',
      relationNoise,
      selectedByDefault: match.mirrorClass !== 'vocabulary' || !relationNoise || match.importance === 'core',
      valid: true,
    };
  });
  const createdAt = new Date().toISOString();
  const mirrorCore = {
    protocol: MIRROR_PROTOCOL,
    mirrorId: `mirror_${runId}`,
    runId,
    createdAt,
    sourceCorpusHash: raw.sourceCorpusHash,
    matchCorpusHash: raw.matchCorpusHash,
    requestSequence: 1,
    entryIds: [...new Set(existingMatches.filter((item) => item.selectedByDefault).map((item) => item.entryId))],
    materialLabel: clean(raw.materialLabel, 160),
    material: {
      label: clean(raw.materialLabel, 160),
      sourceDigest: clean(raw.sourceDigest, 180),
    },
    existingMatches,
    candidateImports: [],
    matchMode: 'balanced',
  };
  const mirrorHash = await hashJson(mirrorCore);
  return {
    runId, contextRevision, mirrorRecord: { ...mirrorCore, mirrorHash },
    existingMatches, candidates: reviewed, raw: clone(raw),
  };
}

export async function extendMirrorRecord(record, update) {
  const core = clone(record);
  delete core.mirrorHash;
  if (Array.isArray(update)) core.entryIds = [...new Set(update)];
  else {
    core.entryIds = [...new Set(update?.entryIds || core.entryIds || [])];
    core.existingMatches = clone(update?.existingMatches || core.existingMatches || []);
    core.candidateImports = clone(update?.candidateImports || core.candidateImports || []);
  }
  return { ...core, mirrorHash: await hashJson(core) };
}
