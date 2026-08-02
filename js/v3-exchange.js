import {
  buildProjection, canonicalizeBackup, cleanStudyStampReferences,
  createCollection, createDomain, createEntry, createMembership, isPhraseText, normalizeDisplayText,
  normalizeEnglish, normalizeGlossHant, safeId, systemDomainWordsCollectionId, systemPhraseCollectionId,
  toTraditional,
} from './v3-model.js';

export const VIX_FORMAT = 'vix-json';
export const VIX_VERSION = 1;
export const NEW_DOMAIN_TARGET = '__new_domain__';
export const NEW_COLLECTION_TARGET = '__new_collection__';

const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const array = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const validStableId = (value) => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,199}$/u.test(value);
const stableId = (prefix, value) => validStableId(value) ? value : safeId(prefix, value || prefix);
const entryPackageKey = (domainKey, normalizedText) => `entry:${domainKey}:${normalizedText}`;

function packageDomain(item, index) {
  const name = normalizeDisplayText(item?.name || item?.key || `词域 ${index + 1}`);
  if (!name) throw new Error('内容 JSON 存在空词域名称');
  return {
    key: normalizeDisplayText(item?.key || item?.id || safeId('domain', name)),
    name,
    order: Number.isFinite(item?.order) ? item.order : index,
    glossEnabled: Boolean(item?.glossEnabled),
  };
}

function packageCollection(item, index) {
  const name = normalizeDisplayText(item?.name || item?.key || `词表 ${index + 1}`);
  const kind = item?.kind === 'phrases' || item?.type === 'system-phrases' ? 'phrases' : 'normal';
  return {
    key: normalizeDisplayText(item?.key || item?.id || safeId('collection', `${item?.domainKey || item?.domainId || ''}:${name}`)),
    domainKey: normalizeDisplayText(item?.domainKey || item?.domainId || ''),
    name,
    label: normalizeDisplayText(item?.label || ''),
    kind,
    order: Number.isFinite(item?.order) ? item.order : index,
    hidden: Boolean(item?.hidden),
  };
}

function packageEntry(item, index) {
  const text = normalizeDisplayText(item?.text || item?.word || '');
  const normalizedText = normalizeEnglish(text);
  if (!normalizedText) throw new Error(`内容 JSON 第 ${index + 1} 个词条缺少英文`);
  const domainKey = normalizeDisplayText(item?.domainKey || item?.domainId || '');
  const glossHant = normalizeGlossHant(item?.glossHant || (item?.glossHans ? toTraditional(item.glossHans) : '') || item?.gloss || '');
  return {
    key: normalizeDisplayText(item?.key || item?.id || entryPackageKey(domainKey || 'target', normalizedText)),
    domainKey,
    text,
    normalizedText,
    kind: isPhraseText(text) ? 'phrase' : 'word',
    glossHant,
    glossHans: normalizeDisplayText(item?.glossHans || ''),
    glossSource: normalizeDisplayText(item?.glossSource || array(item?.sourceRefs).join(', ') || ''),
    sourceRefs: array(item?.sourceRefs).map(normalizeDisplayText).filter(Boolean),
  };
}

function packageMembership(item) {
  return {
    entryKey: normalizeDisplayText(item?.entryKey || item?.entryId || ''),
    entryText: normalizeDisplayText(item?.entryText || item?.text || ''),
    collectionKey: normalizeDisplayText(item?.collectionKey || item?.collectionId || ''),
    sourceLabel: normalizeDisplayText(item?.sourceLabel || ''),
    sourceOrder: Number.isFinite(item?.sourceOrder) ? item.sourceOrder : 0,
  };
}

export function isVixContentPackage(value) {
  return object(value).format === VIX_FORMAT && Number(value.version) === VIX_VERSION;
}

export function normalizeVixPackage(value) {
  if (!isVixContentPackage(value)) throw new Error('JSON 不是受支持的 VIX 内容文件');
  const raw = object(value);
  const data = object(raw.data);
  const target = object(raw.target);
  const scope = ['global', 'domain', 'collection'].includes(target.scope) ? target.scope : 'global';
  const mode = raw.mode === 'replace' ? 'replace' : 'merge';
  const domains = array(data.domains).map(packageDomain);
  const collections = array(data.collections).map(packageCollection);
  const entries = array(data.entries).map(packageEntry);
  const memberships = array(data.memberships).map(packageMembership);
  const sources = array(raw.sources).map((item) => ({
    key: normalizeDisplayText(item?.key || item?.id || ''),
    title: normalizeDisplayText(item?.title || ''),
    publisher: normalizeDisplayText(item?.publisher || ''),
    url: normalizeDisplayText(item?.url || ''),
    retrievedAt: normalizeDisplayText(item?.retrievedAt || ''),
  })).filter((item) => item.key && item.title);
  if (scope !== 'global' && !domains.length && !target.domainKey && !target.domainId) {
    throw new Error('局部内容 JSON 缺少词域信息');
  }
  return {
    format: VIX_FORMAT,
    version: VIX_VERSION,
    exportedAt: normalizeDisplayText(raw.exportedAt || ''),
    target: {
      scope,
      domainKey: normalizeDisplayText(target.domainKey || target.domainId || ''),
      collectionKey: normalizeDisplayText(target.collectionKey || target.collectionId || ''),
    },
    mode,
    data: { domains, collections, entries, memberships },
    sources,
  };
}

function visibleContentCollections(backup, domainIds) {
  return backup.collections.filter((item) => domainIds.has(item.domainId) && !item.hidden);
}

export function createVixPackage(input, selection = { scope: 'global' }) {
  const backup = canonicalizeBackup(input);
  const scope = ['global', 'domain', 'collection'].includes(selection.scope) ? selection.scope : 'global';
  let domainIds = new Set(backup.domains.map((item) => item.id));
  let collections = visibleContentCollections(backup, domainIds);
  let entries = backup.entries;
  let memberships = backup.memberships.filter((item) => collections.some((collection) => collection.id === item.collectionId));
  let target = { scope, domainKey: '', collectionKey: '' };
  let context = {};

  if (scope === 'domain') {
    const domain = backup.domains.find((item) => item.id === selection.domainId);
    if (!domain) throw new Error('找不到要导出的独立域');
    domainIds = new Set([domain.id]);
    collections = visibleContentCollections(backup, domainIds);
    entries = backup.entries.filter((item) => item.domainId === domain.id);
    const collectionIds = new Set(collections.filter((item) => item.type === 'normal').map((item) => item.id));
    const entryIds = new Set(entries.map((item) => item.id));
    memberships = backup.memberships.filter((item) => entryIds.has(item.entryId) && collectionIds.has(item.collectionId));
    target = { scope, domainKey: domain.id, collectionKey: '' };
  } else if (scope === 'collection') {
    const collection = backup.collections.find((item) => item.id === selection.collectionId && !item.hidden);
    if (!collection) throw new Error('找不到要导出的词表');
    const domain = backup.domains.find((item) => item.id === collection.domainId);
    if (!domain) throw new Error('目标词表缺少词域');
    domainIds = new Set([domain.id]);
    collections = [collection];
    if (collection.type === 'system-phrases') {
      entries = backup.entries.filter((item) => item.domainId === domain.id && item.kind === 'phrase');
      memberships = [];
    } else {
      const memberIds = new Set(backup.memberships.filter((item) => item.collectionId === collection.id).map((item) => item.entryId));
      entries = backup.entries.filter((item) => memberIds.has(item.id));
      memberships = backup.memberships.filter((item) => item.collectionId === collection.id);
      const tokenTexts = new Set(entries.map((item) => item.normalizedText));
      const relatedPhraseIds = new Set(backup.phraseTokens.filter((item) => item.domainId === domain.id && tokenTexts.has(item.normalizedToken)).map((item) => item.phraseId));
      context = {
        relatedPhrases: backup.entries.filter((item) => relatedPhraseIds.has(item.id)).map((item) => ({ text: item.text, glossHant: item.glossHant })),
      };
    }
    target = { scope, domainKey: domain.id, collectionKey: collection.id };
  }

  const selectedDomains = backup.domains.filter((item) => domainIds.has(item.id));
  const entryKeys = new Map(entries.map((item) => [item.id, entryPackageKey(item.domainId, item.normalizedText)]));
  const includedCollectionIds = new Set(collections.filter((item) => item.type === 'normal').map((item) => item.id));
  return {
    format: VIX_FORMAT,
    version: VIX_VERSION,
    exportedAt: new Date().toISOString(),
    target,
    mode: 'replace',
    data: {
      domains: selectedDomains.map((item) => ({ key: item.id, name: item.name, order: item.order, glossEnabled: item.glossEnabled })),
      collections: collections.map((item) => ({
        key: item.id, domainKey: item.domainId, name: item.name, label: item.label,
        kind: item.type === 'system-phrases' ? 'phrases' : 'normal', order: item.order,
      })),
      entries: entries.map((item) => ({
        key: entryKeys.get(item.id), domainKey: item.domainId, text: item.text,
        glossHant: item.glossHant, glossSource: item.glossSource,
        sourceRefs: item.glossSource ? item.glossSource.split(/\s*,\s*/).filter(Boolean) : [],
      })),
      memberships: memberships.filter((item) => includedCollectionIds.has(item.collectionId)).map((item) => ({
        entryKey: entryKeys.get(item.entryId), collectionKey: item.collectionId,
        sourceLabel: item.sourceLabel, sourceOrder: item.sourceOrder,
      })),
    },
    sources: array(backup.settings?.contentSources),
    context,
  };
}

function declaredTargetMismatch(pkg, selection) {
  if (!selection || selection.targetMode === 'file') return null;
  if (pkg.target.scope !== selection.scope) return `文件范围为${pkg.target.scope}，当前选择为${selection.scope}`;
  if (selection.scope === 'domain' && selection.domainId && selection.domainId !== NEW_DOMAIN_TARGET && pkg.target.domainKey && pkg.target.domainKey !== selection.domainId) {
    return `文件目标独立域为 ${pkg.target.domainKey}，当前选择为 ${selection.domainId}`;
  }
  if (selection.scope === 'collection' && selection.collectionId && selection.collectionId !== NEW_COLLECTION_TARGET && pkg.target.collectionKey && pkg.target.collectionKey !== selection.collectionId) {
    return `文件目标词表为 ${pkg.target.collectionKey}，当前选择为 ${selection.collectionId}`;
  }
  return null;
}

function contentIdentity(domainId, normalizedText) {
  return `${domainId}\u0000${normalizedText}`;
}

function collectionIdentity(domainId, name, type) {
  return `${domainId}\u0000${type}\u0000${normalizeEnglish(name)}`;
}

function summaryBetween(before, after, conflicts, skippedDuplicates = 0, membershipIssues = []) {
  const byId = (items) => new Map(items.map((item) => [item.id, item]));
  const bDomains = byId(before.domains); const aDomains = byId(after.domains);
  const bCollections = byId(before.collections); const aCollections = byId(after.collections);
  const bEntries = byId(before.entries); const aEntries = byId(after.entries);
  const beforeMemberships = new Set(before.memberships.map((item) => `${item.entryId}\u0000${item.collectionId}`));
  const afterMemberships = new Set(after.memberships.map((item) => `${item.entryId}\u0000${item.collectionId}`));
  let updatedGlosses = 0;
  for (const [id, item] of aEntries) if (bEntries.has(id) && (bEntries.get(id).glossHant !== item.glossHant || bEntries.get(id).glossSource !== item.glossSource)) updatedGlosses += 1;
  return {
    addedDomains: [...aDomains.keys()].filter((id) => !bDomains.has(id)).length,
    removedDomains: [...bDomains.keys()].filter((id) => !aDomains.has(id)).length,
    addedCollections: [...aCollections.keys()].filter((id) => !bCollections.has(id)).length,
    removedCollections: [...bCollections.keys()].filter((id) => !aCollections.has(id)).length,
    addedWords: [...aEntries.values()].filter((item) => item.kind === 'word' && !bEntries.has(item.id)).length,
    addedPhrases: [...aEntries.values()].filter((item) => item.kind === 'phrase' && !bEntries.has(item.id)).length,
    removedWords: [...bEntries.values()].filter((item) => item.kind === 'word' && !aEntries.has(item.id)).length,
    removedPhrases: [...bEntries.values()].filter((item) => item.kind === 'phrase' && !aEntries.has(item.id)).length,
    updatedGlosses,
    addedMemberships: [...afterMemberships].filter((key) => !beforeMemberships.has(key)).length,
    removedMemberships: [...beforeMemberships].filter((key) => !afterMemberships.has(key)).length,
    skippedDuplicates,
    skippedMemberships: membershipIssues.length,
    conflicts: conflicts.length,
  };
}

function normalizePersonalReferences(backup) {
  const entryById = new Map(backup.entries.map((item) => [item.id, item]));
  const collectionById = new Map(backup.collections.map((item) => [item.id, item]));
  const projection = buildProjection(backup);
  backup.pins = array(backup.pins).flatMap((pin) => {
    let entry = entryById.get(pin.entryId);
    if (!entry) return [];
    if ((projection.get(pin.contextCollectionId) || []).some((item) => item.id === entry.id)) return [{ ...pin, domainId: entry.domainId }];
    const fallback = entry.kind === 'phrase' ? systemPhraseCollectionId(entry.domainId) : systemDomainWordsCollectionId(entry.domainId);
    if (!(projection.get(fallback) || []).some((item) => item.id === entry.id)) return [];
    return [{ ...pin, domainId: entry.domainId, contextCollectionId: fallback }];
  });
  backup.annotations = array(backup.annotations).filter((item) => entryById.has(item.entryId));
  cleanStudyStampReferences(backup);
  const lastPositions = { ...object(backup.settings?.lastPositions) };
  for (const [key, entryId] of Object.entries(lastPositions)) {
    const parts = key.split(':');
    const collectionId = parts.length >= 5 ? parts.slice(2, -2).join(':') : parts.slice(2).join(':');
    if ((projection.get(collectionId) || []).some((item) => item.id === entryId)) continue;
    delete lastPositions[key];
  }
  const validCollectionIds = new Set(projection.keys());
  const viewModes = Object.fromEntries(Object.entries(object(backup.settings?.viewModes))
    .filter(([collectionId]) => validCollectionIds.has(collectionId)));
  const calendarMonths = Object.fromEntries(Object.entries(object(backup.settings?.calendarMonths))
    .filter(([key]) => validCollectionIds.has(key.slice(0, key.lastIndexOf(':')))));
  backup.settings = { ...backup.settings, lastPositions, viewModes, calendarMonths };
  // Remove source records no longer referenced only when they are malformed; valid catalog records remain useful audit metadata.
  backup.settings.contentSources = array(backup.settings.contentSources).filter((item) => item?.key && item?.title);
  return backup;
}

function buildTargetSelection(pkg, selection, current) {
  const useFile = selection?.targetMode === 'file';
  const scope = useFile ? pkg.target.scope : (selection?.scope || pkg.target.scope);
  const mode = selection?.mode || pkg.mode;
  let domainId = useFile ? pkg.target.domainKey : (selection?.domainId || pkg.target.domainKey);
  let collectionId = useFile ? pkg.target.collectionKey : (selection?.collectionId || pkg.target.collectionKey);
  if (scope === 'domain' && domainId !== NEW_DOMAIN_TARGET && !current.domains.some((item) => item.id === domainId)) {
    const match = current.domains.find((item) => normalizeEnglish(item.name) === normalizeEnglish(domainId));
    if (match) domainId = match.id;
  }
  return { scope, mode: mode === 'replace' ? 'replace' : 'merge', domainId, collectionId };
}

export function planVixImport(currentInput, rawPackage, selection = {}, conflictPolicy = 'current') {
  const before = canonicalizeBackup(currentInput);
  const pkg = normalizeVixPackage(rawPackage);
  const mismatch = declaredTargetMismatch(pkg, selection);
  const target = buildTargetSelection(pkg, selection, before);
  if (!['global', 'domain', 'collection'].includes(target.scope)) throw new Error('无效导入范围');
  if (!['merge', 'replace'].includes(target.mode)) throw new Error('无效写入方式');

  const draft = clone(before);
  let domains = [...draft.domains];
  let collections = [...draft.collections];
  let entries = [...draft.entries];
  let memberships = [...draft.memberships];
  const conflicts = [];
  const membershipIssues = [];
  let skippedDuplicates = 0;
  const timestamp = new Date().toISOString();

  const existingDomainById = new Map(domains.map((item) => [item.id, item]));
  const existingDomainByName = new Map(domains.map((item) => [normalizeEnglish(item.name), item]));
  const incomingDomains = pkg.data.domains.length ? pkg.data.domains : [{ key: pkg.target.domainKey || 'imported-domain', name: pkg.target.domainKey || '导入词域', order: domains.length, glossEnabled: false }];
  if (target.scope !== 'global' && incomingDomains.length > 1) throw new Error('局部导入文件只能包含一个词域');

  const domainMap = new Map();
  const targetExistingDomain = target.scope !== 'global' && target.domainId && target.domainId !== NEW_DOMAIN_TARGET
    ? existingDomainById.get(target.domainId) : null;
  for (const incoming of incomingDomains) {
    let domain = null;
    if (target.scope !== 'global') domain = targetExistingDomain;
    else domain = existingDomainById.get(incoming.key) || existingDomainByName.get(normalizeEnglish(incoming.name));
    if (!domain) {
      const id = target.scope !== 'global' && target.domainId && target.domainId !== NEW_DOMAIN_TARGET
        ? target.domainId : stableId('domain', incoming.key || incoming.name);
      domain = createDomain({ id, name: incoming.name, order: incoming.order, glossEnabled: incoming.glossEnabled, timestamp });
      domains.push(domain);
      existingDomainById.set(domain.id, domain);
    } else {
      const updated = createDomain({ ...domain, name: incoming.name || domain.name, glossEnabled: incoming.glossEnabled ?? domain.glossEnabled, updatedAt: timestamp, timestamp });
      domains = domains.map((item) => item.id === domain.id ? updated : item);
      domain = updated;
    }
    domainMap.set(incoming.key, domain.id);
    if (!domainMap.has('')) domainMap.set('', domain.id);
  }

  const targetDomainId = target.scope === 'global' ? '' : [...domainMap.values()][0];
  if (target.scope !== 'global' && !targetDomainId) throw new Error('没有可用的目标独立域');

  if (target.mode === 'replace') {
    if (target.scope === 'global') {
      const incomingIds = new Set(domainMap.values());
      domains = domains.filter((item) => incomingIds.has(item.id));
      collections = [];
      entries = [];
      memberships = [];
    } else if (target.scope === 'domain') {
      collections = collections.filter((item) => item.domainId !== targetDomainId);
      const removedEntryIds = new Set(entries.filter((item) => item.domainId === targetDomainId).map((item) => item.id));
      entries = entries.filter((item) => item.domainId !== targetDomainId);
      memberships = memberships.filter((item) => !removedEntryIds.has(item.entryId));
    }
  }

  const collectionByIdentity = new Map(collections.map((item) => [collectionIdentity(item.domainId, item.name, item.type), item]));
  const collectionById = new Map(collections.map((item) => [item.id, item]));
  const collectionMap = new Map();
  let targetCollection = null;
  if (target.scope === 'collection' && target.collectionId && target.collectionId !== NEW_COLLECTION_TARGET) {
    targetCollection = collectionById.get(target.collectionId);
    if (!targetCollection && selection?.targetMode !== 'file') throw new Error('找不到选择的目标词表');
    if (targetCollection?.hidden) throw new Error('不能直接导入隐藏词表');
  }

  const incomingCollections = [...pkg.data.collections];
  if (target.scope === 'collection' && !incomingCollections.length) {
    incomingCollections.push({ key: pkg.target.collectionKey || 'imported-collection', domainKey: incomingDomains[0]?.key || '', name: targetCollection?.name || '导入词表', label: '', kind: targetCollection?.type === 'system-phrases' ? 'phrases' : 'normal', order: targetCollection?.order || 2, hidden: false });
  }
  if (target.scope === 'collection' && incomingCollections.length > 1) {
    const matching = incomingCollections.filter((item) => targetCollection?.type === 'system-phrases' ? item.kind === 'phrases' : item.kind === 'normal');
    if (matching.length !== 1) throw new Error('词表级导入文件必须明确一个目标词表');
    incomingCollections.splice(0, incomingCollections.length, matching[0]);
  }

  for (const incoming of incomingCollections) {
    const domainId = target.scope === 'global' ? domainMap.get(incoming.domainKey) : targetDomainId;
    if (!domainId) throw new Error(`词表 ${incoming.name} 指向未知词域`);
    const type = incoming.kind === 'phrases' ? 'system-phrases' : 'normal';
    let collection = target.scope === 'collection' ? targetCollection : null;
    if (!collection) collection = collectionById.get(incoming.key) || collectionByIdentity.get(collectionIdentity(domainId, incoming.name, type));
    if (!collection) {
      const id = type === 'system-phrases' ? systemPhraseCollectionId(domainId) : stableId('collection', incoming.key || `${domainId}:${incoming.name}`);
      collection = createCollection({ id, domainId, name: incoming.name, label: incoming.label, type, order: incoming.order, hidden: false, timestamp });
      collections.push(collection);
    } else {
      collection = createCollection({ ...collection, domainId, name: incoming.name || collection.name, label: incoming.label ?? collection.label, type, order: collection.type === 'system-phrases' ? 1 : incoming.order, hidden: false, updatedAt: timestamp, timestamp });
      collections = collections.map((item) => item.id === collection.id ? collection : item);
    }
    collectionById.set(collection.id, collection);
    collectionMap.set(incoming.key, collection.id);
    if (!collectionMap.has('')) collectionMap.set('', collection.id);
    if (target.scope === 'collection') targetCollection = collection;
  }

  // Every domain has exactly one phrase collection, including packages that omit it.
  for (const domainId of new Set(domainMap.values())) {
    const phraseId = systemPhraseCollectionId(domainId);
    if (!collections.some((item) => item.id === phraseId)) {
      collections.push(createCollection({ id: phraseId, domainId, name: '短语总表', type: 'system-phrases', order: 1, timestamp }));
    }
  }

  if (target.scope === 'collection' && target.mode === 'replace') {
    if (!targetCollection) throw new Error('没有可替换的目标词表');
    if (targetCollection.type === 'system-phrases') {
      const removed = new Set(entries.filter((item) => item.domainId === targetDomainId && item.kind === 'phrase').map((item) => item.id));
      entries = entries.filter((item) => !removed.has(item.id));
      memberships = memberships.filter((item) => !removed.has(item.entryId));
    } else {
      memberships = memberships.filter((item) => item.collectionId !== targetCollection.id);
    }
  }

  const entryByIdentity = new Map(entries.map((item) => [contentIdentity(item.domainId, item.normalizedText), item]));
  const entryCandidatesByReference = new Map();
  const entryCandidatesByNormalizedText = new Map();
  const registerCandidate = (map, key, entry) => {
    const reference = normalizeDisplayText(key);
    if (!reference || !entry) return;
    const candidates = map.get(reference) || [];
    if (!candidates.some((item) => item.id === entry.id)) candidates.push(entry);
    map.set(reference, candidates);
  };
  const onlyCandidate = (map, key) => {
    const candidates = map.get(key) || [];
    return candidates.length === 1 ? candidates[0] : null;
  };
  const entryByPackageKey = new Map();
  for (const incoming of pkg.data.entries) {
    const domainId = target.scope === 'global' ? domainMap.get(incoming.domainKey) : targetDomainId;
    if (!domainId) throw new Error(`词条 ${incoming.text} 指向未知词域`);
    if (target.scope === 'collection' && targetCollection?.type === 'system-phrases' && incoming.kind !== 'phrase') continue;
    const identity = contentIdentity(domainId, incoming.normalizedText);
    let entry = entryByIdentity.get(identity);
    if (!entry) {
      entry = createEntry({ id: stableId('entry', `${domainId}:${incoming.normalizedText}`), domainId, text: incoming.text, glossHant: incoming.glossHant, glossSource: incoming.glossSource, timestamp });
      entries.push(entry);
      entryByIdentity.set(identity, entry);
    } else {
      let glossHant = entry.glossHant;
      let glossSource = entry.glossSource;
      if (incoming.glossHant && incoming.glossHant !== entry.glossHant) {
        if (entry.glossHant) conflicts.push({ type: 'gloss', text: entry.text, current: entry.glossHant, incoming: incoming.glossHant });
        if (!entry.glossHant || conflictPolicy === 'import') { glossHant = incoming.glossHant; glossSource = incoming.glossSource || entry.glossSource; }
      }
      const updated = createEntry({ ...entry, text: incoming.text || entry.text, glossHant, glossSource, updatedAt: timestamp, timestamp });
      entries = entries.map((item) => item.id === entry.id ? updated : item);
      entry = updated;
      entryByIdentity.set(identity, updated);
      skippedDuplicates += 1;
    }
    const qualifiedKey = entryPackageKey(incoming.domainKey || pkg.target.domainKey || '', incoming.normalizedText);
    registerCandidate(entryCandidatesByReference, incoming.key, entry);
    registerCandidate(entryCandidatesByReference, qualifiedKey, entry);
    registerCandidate(entryCandidatesByNormalizedText, incoming.normalizedText, entry);
    entryByPackageKey.set(incoming.key, entry);
    entryByPackageKey.set(qualifiedKey, entry);
  }

  const membershipSet = new Set(memberships.map((item) => `${item.entryId}\u0000${item.collectionId}`));
  const addMembership = (entry, collectionId, sourceLabel = '', sourceOrder = 0) => {
    const collection = collections.find((item) => item.id === collectionId);
    if (!entry || !collection || collection.type !== 'normal') return;
    const key = `${entry.id}\u0000${collectionId}`;
    if (membershipSet.has(key)) { skippedDuplicates += 1; return; }
    memberships.push(createMembership({ entryId: entry.id, collectionId, sourceLabel, sourceOrder, timestamp }));
    membershipSet.add(key);
  };

  const resolveMembershipEntry = (incoming) => {
    const rawKey = normalizeDisplayText(incoming.entryKey);
    if (rawKey) {
      const exactCandidates = entryCandidatesByReference.get(rawKey) || [];
      if (exactCandidates.length === 1) return exactCandidates[0];
      if (exactCandidates.length > 1) {
        membershipIssues.push({
          type: 'ambiguous-entry-reference',
          reference: rawKey,
          collectionKey: incoming.collectionKey,
          candidates: exactCandidates.map((item) => ({ id: item.id, domainId: item.domainId, text: item.text })),
        });
        return null;
      }

      // A bare entryKey is accepted only when it resolves to exactly one concrete Entry.
      // Cross-domain homographs are dirty/ambiguous input and are never guessed.
      if (!rawKey.startsWith('entry:')) {
        const normalized = normalizeEnglish(rawKey);
        const bareCandidates = entryCandidatesByNormalizedText.get(normalized) || [];
        if (bareCandidates.length === 1) return bareCandidates[0];
        if (bareCandidates.length > 1) {
          membershipIssues.push({
            type: 'ambiguous-bare-entry-key',
            reference: rawKey,
            collectionKey: incoming.collectionKey,
            candidates: bareCandidates.map((item) => ({ id: item.id, domainId: item.domainId, text: item.text })),
          });
          return null;
        }
      }
    }

    const rawText = normalizeDisplayText(incoming.entryText);
    if (rawText) {
      const normalized = normalizeEnglish(rawText);
      const textCandidates = entryCandidatesByNormalizedText.get(normalized) || [];
      if (textCandidates.length === 1) return textCandidates[0];
      if (textCandidates.length > 1) {
        membershipIssues.push({
          type: 'ambiguous-entry-text',
          reference: rawText,
          collectionKey: incoming.collectionKey,
          candidates: textCandidates.map((item) => ({ id: item.id, domainId: item.domainId, text: item.text })),
        });
        return null;
      }
    }

    membershipIssues.push({
      type: 'unresolved-entry-reference',
      reference: rawKey || rawText || '(空)',
      collectionKey: incoming.collectionKey,
      candidates: [],
    });
    return null;
  };

  for (const incoming of pkg.data.memberships) {
    const entry = resolveMembershipEntry(incoming);
    const collectionId = target.scope === 'collection' && targetCollection?.type === 'normal'
      ? targetCollection.id : collectionMap.get(incoming.collectionKey);
    const targetCollectionForMembership = collections.find((item) => item.id === collectionId);
    if (!entry) continue;
    if (!targetCollectionForMembership || targetCollectionForMembership.type !== 'normal') {
      membershipIssues.push({
        type: 'unresolved-collection-reference',
        reference: incoming.entryKey || incoming.entryText || entry.text,
        collectionKey: incoming.collectionKey || '(空)',
        candidates: [{ id: entry.id, domainId: entry.domainId, text: entry.text }],
      });
      continue;
    }
    addMembership(entry, collectionId, incoming.sourceLabel, incoming.sourceOrder);
  }

  if (target.scope === 'collection' && targetCollection?.type === 'normal') {
    let order = 0;
    for (const incoming of pkg.data.entries) {
      const entry = entryByPackageKey.get(incoming.key);
      if (entry) addMembership(entry, targetCollection.id, incoming.glossSource, order++);
    }
  }

  // Imported words without a visible normal collection receive one hidden provenance collection.
  for (const domainId of new Set(domainMap.values())) {
    const domainWords = entries.filter((item) => item.domainId === domainId && item.kind === 'word');
    const normalCollectionIds = new Set(collections.filter((item) => item.domainId === domainId && item.type === 'normal').map((item) => item.id));
    const assigned = new Set(memberships.filter((item) => normalCollectionIds.has(item.collectionId)).map((item) => item.entryId));
    const missing = domainWords.filter((item) => !assigned.has(item.id));
    if (missing.length) {
      const hiddenId = stableId('collection', `${domainId}:import-source`);
      let hidden = collections.find((item) => item.id === hiddenId);
      if (!hidden) {
        hidden = createCollection({ id: hiddenId, domainId, name: '导入来源', label: '', type: 'normal', order: 1000, hidden: true, timestamp });
        collections.push(hidden);
      }
      missing.forEach((entry, index) => addMembership(entry, hidden.id, 'VIX', index));
    }
  }

  if (target.mode === 'replace' && target.scope === 'collection' && targetCollection?.type === 'normal') {
    const normalIds = new Set(collections.filter((item) => item.type === 'normal').map((item) => item.id));
    const referencedWords = new Set(memberships.filter((item) => normalIds.has(item.collectionId)).map((item) => item.entryId));
    entries = entries.filter((item) => item.kind === 'phrase' || referencedWords.has(item.id));
    const validEntryIds = new Set(entries.map((item) => item.id));
    memberships = memberships.filter((item) => validEntryIds.has(item.entryId));
  }

  const sourceMap = new Map(array(draft.settings?.contentSources).map((item) => [item.key, item]));
  for (const source of pkg.sources) sourceMap.set(source.key, source);
  const nextRaw = normalizePersonalReferences({
    ...draft,
    appVersion: '3.5.0',
    exportedAt: timestamp,
    domains,
    collections,
    entries,
    memberships,
    settings: { ...draft.settings, contentSources: [...sourceMap.values()] },
  });
  const nextBackup = canonicalizeBackup(nextRaw);
  // canonicalizeBackup intentionally keeps a compact settings whitelist; restore the validated source catalog.
  nextBackup.settings.contentSources = [...sourceMap.values()];
  const summary = summaryBetween(before, nextBackup, conflicts, skippedDuplicates, membershipIssues);
  return { package: pkg, target, mismatch, conflicts, membershipIssues, conflictPolicy, summary, nextBackup };
}
