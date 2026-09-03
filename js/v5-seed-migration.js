import {
  canonicalizeBackup,
  normalizeEnglish,
  safeId,
  validateBackup,
} from './v3-model.js';
import { APP_VERSION } from './v5-version.js';

const ENTITY_FIELDS = Object.freeze({
  domains: ['name', 'order', 'glossEnabled', 'contentMode', 'relationExcluded'],
  collections: ['domainId', 'name', 'label', 'type', 'order', 'hidden'],
  entries: ['domainId', 'kind', 'contentType', 'partsOfSpeech', 'text', 'normalizedText', 'glossHans', 'glossHant', 'glossSource'],
  memberships: ['entryId', 'collectionId', 'sourceLabel', 'sourceOrder'],
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedFromBase(kind, current, base) {
  if (!current || !base) return Boolean(current) !== Boolean(base);
  return ENTITY_FIELDS[kind].some((field) => !same(current[field], base[field]));
}

function mergeRecord(kind, base, current, target) {
  if (!current) return clone(target);
  if (!base) return clone(current);
  const next = { ...clone(target), id: current.id, createdAt: current.createdAt || target.createdAt };
  let userChanged = false;
  for (const field of ENTITY_FIELDS[kind]) {
    if (!same(current[field], base[field])) {
      next[field] = clone(current[field]);
      userChanged = true;
    }
  }
  next.updatedAt = userChanged ? current.updatedAt : target.updatedAt;
  return next;
}

function parseLastPositionCollectionId(key) {
  const parts = String(key || '').split(':');
  return parts.length >= 5 ? parts.slice(2, -2).join(':') : parts.slice(2).join(':');
}

function naturalDomain(item) {
  return normalizeEnglish(item?.name || '');
}

function naturalCollection(item) {
  return `${item?.domainId || ''}\u0000${normalizeEnglish(item?.name || '')}\u0000${item?.type || 'normal'}`;
}

function naturalEntry(item) {
  return `${item?.domainId || ''}\u0000${item?.normalizedText || normalizeEnglish(item?.text || '')}`;
}

function alignTargetIds(base, current, target) {
  const aligned = clone(target);
  const align = (kind, naturalKey) => {
    const baseByNatural = new Map(base[kind].map((item) => [naturalKey(item), item]));
    const currentByNatural = new Map(current[kind].map((item) => [naturalKey(item), item]));
    const idMap = new Map();
    for (const item of aligned[kind]) {
      const matchedBase = baseByNatural.get(naturalKey(item));
      const matchedCurrent = currentByNatural.get(naturalKey(item));
      const preferredId = matchedBase?.id || matchedCurrent?.id || item.id;
      idMap.set(item.id, preferredId);
      item.id = preferredId;
    }
    return idMap;
  };

  const domainIds = align('domains', naturalDomain);
  for (const item of aligned.collections) item.domainId = domainIds.get(item.domainId) || item.domainId;
  for (const item of aligned.entries) item.domainId = domainIds.get(item.domainId) || item.domainId;
  const collectionIds = align('collections', naturalCollection);
  const entryIds = align('entries', naturalEntry);
  for (const membership of aligned.memberships) {
    membership.entryId = entryIds.get(membership.entryId) || membership.entryId;
    membership.collectionId = collectionIds.get(membership.collectionId) || membership.collectionId;
    membership.id = safeId('membership', `${membership.entryId}:${membership.collectionId}`);
  }
  return aligned;
}

function mergeById(kind, baseItems, currentItems, targetItems, forcePreserve, report) {
  const baseById = new Map(baseItems.map((item) => [item.id, item]));
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  const targetById = new Map(targetItems.map((item) => [item.id, item]));
  const result = [];

  for (const target of targetItems) {
    const base = baseById.get(target.id);
    const current = currentById.get(target.id);
    if (base && !current) {
      report.userDeletionsPreserved += 1;
      continue;
    }
    if (!current) {
      result.push(clone(target));
      report.seedRecordsAdded += 1;
      continue;
    }
    const merged = mergeRecord(kind, base, current, target);
    if (base && changedFromBase(kind, current, base)) report.userEditsPreserved += 1;
    else if (!base) report.userRecordsPreserved += 1;
    result.push(merged);
  }

  for (const current of currentItems) {
    if (targetById.has(current.id)) continue;
    const base = baseById.get(current.id);
    if (!base) {
      result.push(clone(current));
      report.userRecordsPreserved += 1;
      continue;
    }
    if (changedFromBase(kind, current, base) || forcePreserve.has(current.id)) {
      result.push(clone(current));
      report.retiredRecordsRetained += 1;
    } else {
      report.retiredRecordsRemoved += 1;
    }
  }
  return result;
}

function membershipKey(item) {
  return `${item?.entryId || ''}\u0000${item?.collectionId || ''}`;
}

function mergeMemberships(baseItems, currentItems, targetItems, forceEntryIds, forceCollectionIds, retainedEntryIds, retainedCollectionIds, report) {
  const baseByKey = new Map(baseItems.map((item) => [membershipKey(item), item]));
  const currentByKey = new Map(currentItems.map((item) => [membershipKey(item), item]));
  const targetByKey = new Map(targetItems.map((item) => [membershipKey(item), item]));
  const result = [];
  for (const target of targetItems) {
    const key = membershipKey(target);
    const base = baseByKey.get(key);
    const current = currentByKey.get(key);
    if (base && !current) {
      report.userDeletionsPreserved += 1;
      continue;
    }
    if (!current) {
      result.push(clone(target));
      report.seedRecordsAdded += 1;
      continue;
    }
    const merged = mergeRecord('memberships', base, current, target);
    merged.id = current.id || target.id;
    if (base && changedFromBase('memberships', current, base)) report.userEditsPreserved += 1;
    else if (!base) report.userRecordsPreserved += 1;
    result.push(merged);
  }
  for (const current of currentItems) {
    const key = membershipKey(current);
    if (targetByKey.has(key)) continue;
    const base = baseByKey.get(key);
    if (!base || changedFromBase('memberships', current, base)
      || forceEntryIds.has(current.entryId) || forceCollectionIds.has(current.collectionId)) {
      result.push(clone(current));
      if (base) report.retiredRecordsRetained += 1;
      else report.userRecordsPreserved += 1;
    } else {
      report.retiredRecordsRemoved += 1;
    }
  }
  return result.filter((item) => retainedEntryIds.has(item.entryId) && retainedCollectionIds.has(item.collectionId));
}

function mergeContentSources(currentSources, targetSources) {
  const merged = new Map((targetSources || []).map((item) => [item.key, clone(item)]));
  for (const item of currentSources || []) merged.set(item.key, clone(item));
  return [...merged.values()];
}

/**
 * Reconcile a device snapshot with the current built-in Seed using Seed4 as
 * the common ancestor.
 * Built-in data follows field-level three-way merge; user-owned records and
 * explicit deletions win. Target IDs are aligned to existing device IDs so
 * pins, annotations and saved positions never need a lossy rewrite.
 */
export function reconcileSeedUpgrade(baseInput, currentInput, targetInput, { toRevision = 7, appliedAt = new Date().toISOString() } = {}) {
  const base = canonicalizeBackup(baseInput);
  const current = canonicalizeBackup(currentInput);
  const target = alignTargetIds(base, current, canonicalizeBackup(targetInput));
  const report = {
    protocol: 'vix-seed-three-way-report/1',
    fromRevision: Number(current.settings.builtInSeedRevision || 0),
    toRevision,
    appliedAt,
    seedRecordsAdded: 0,
    retiredRecordsRemoved: 0,
    retiredRecordsRetained: 0,
    userRecordsPreserved: 0,
    userEditsPreserved: 0,
    userDeletionsPreserved: 0,
  };

  const baseDomainIds = new Set(base.domains.map((item) => item.id));
  const baseCollectionById = new Map(base.collections.map((item) => [item.id, item]));
  const baseEntryById = new Map(base.entries.map((item) => [item.id, item]));
  const baseMembershipByKey = new Map(base.memberships.map((item) => [membershipKey(item), item]));
  const forceDomainIds = new Set();
  const forceCollectionIds = new Set();
  const forceEntryIds = new Set();

  for (const domain of current.domains) {
    const baseDomain = base.domains.find((item) => item.id === domain.id);
    if (!baseDomain || changedFromBase('domains', domain, baseDomain)) forceDomainIds.add(domain.id);
  }
  for (const collection of current.collections) {
    const baseCollection = baseCollectionById.get(collection.id);
    if (!baseCollection || changedFromBase('collections', collection, baseCollection)) forceCollectionIds.add(collection.id);
    if (!baseDomainIds.has(collection.domainId)) forceDomainIds.add(collection.domainId);
  }
  for (const entry of current.entries) {
    const baseEntry = baseEntryById.get(entry.id);
    if (!baseEntry || changedFromBase('entries', entry, baseEntry)) forceEntryIds.add(entry.id);
    if (!baseDomainIds.has(entry.domainId)) forceDomainIds.add(entry.domainId);
  }
  for (const membership of current.memberships) {
    const baseMembership = baseMembershipByKey.get(membershipKey(membership));
    if (!baseMembership || changedFromBase('memberships', membership, baseMembership)) {
      forceEntryIds.add(membership.entryId);
      forceCollectionIds.add(membership.collectionId);
    }
  }
  for (const pin of current.pins) {
    forceEntryIds.add(pin.entryId);
    if (baseCollectionById.has(pin.contextCollectionId)) forceCollectionIds.add(pin.contextCollectionId);
  }
  for (const annotation of current.annotations) forceEntryIds.add(annotation.entryId);
  for (const stamp of current.studyStamps) forceEntryIds.add(stamp.entryId);
  for (const [key, entryId] of Object.entries(current.settings.lastPositions || {})) {
    forceEntryIds.add(entryId);
    const collectionId = parseLastPositionCollectionId(key);
    if (baseCollectionById.has(collectionId)) forceCollectionIds.add(collectionId);
  }
  for (const collection of current.collections) {
    if (forceCollectionIds.has(collection.id)) forceDomainIds.add(collection.domainId);
  }
  for (const entry of current.entries) {
    if (forceEntryIds.has(entry.id)) forceDomainIds.add(entry.domainId);
  }

  const domains = mergeById('domains', base.domains, current.domains, target.domains, forceDomainIds, report);
  const domainIds = new Set(domains.map((item) => item.id));
  const collections = mergeById('collections', base.collections, current.collections, target.collections, forceCollectionIds, report)
    .filter((item) => domainIds.has(item.domainId));
  const collectionIds = new Set(collections.map((item) => item.id));
  const entries = mergeById('entries', base.entries, current.entries, target.entries, forceEntryIds, report)
    .filter((item) => domainIds.has(item.domainId));
  const entryIds = new Set(entries.map((item) => item.id));
  const memberships = mergeMemberships(base.memberships, current.memberships, target.memberships,
    forceEntryIds, forceCollectionIds, entryIds, collectionIds, report);
  const sourcedEntryIds = new Set(memberships.map((item) => item.entryId));
  const finalEntries = entries.filter((item) => sourcedEntryIds.has(item.id));
  const finalEntryIds = new Set(finalEntries.map((item) => item.id));
  const finalMemberships = memberships.filter((item) => finalEntryIds.has(item.entryId));
  const pins = current.pins.filter((item) => finalEntryIds.has(item.entryId)
    && (!baseCollectionById.has(item.contextCollectionId) || collectionIds.has(item.contextCollectionId)));
  const annotations = current.annotations.filter((item) => finalEntryIds.has(item.entryId));
  const studyStamps = current.studyStamps.filter((item) => finalEntryIds.has(item.entryId));

  const reconciled = canonicalizeBackup({
    schemaVersion: target.schemaVersion,
    appVersion: APP_VERSION,
    exportedAt: appliedAt,
    domains,
    collections,
    entries: finalEntries,
    memberships: finalMemberships,
    pins,
    annotations,
    studyStamps,
    settings: {
      ...current.settings,
      builtInSeedRevision: toRevision,
      migrationComplete: true,
      migrationSource: `Seed ${report.fromRevision} -> Seed ${toRevision} three-way reconciliation`,
      migrationNoticePending: false,
      contentSources: mergeContentSources(current.settings.contentSources, target.settings.contentSources),
    },
  });
  validateBackup(reconciled);
  report.result = {
    domains: reconciled.domains.length,
    collections: reconciled.collections.length,
    entries: reconciled.entries.length,
    memberships: reconciled.memberships.length,
    pins: reconciled.pins.length,
    annotations: reconciled.annotations.length,
    studyStamps: reconciled.studyStamps.length,
  };
  return { backup: reconciled, report };
}
