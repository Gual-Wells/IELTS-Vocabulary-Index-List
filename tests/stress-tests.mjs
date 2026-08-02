import assert from 'node:assert/strict';
import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, createCollection, createDomain, createEntry,
  createMembership, createStudyStamp, normalizeEnglish, safeId, validateBackup,
} from '../js/v3-model.js';

let seed = 0x5f3759df;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function pick(items) { return items[Math.floor(random() * items.length)]; }

const timestamp = '2026-08-02T00:00:00.000Z';
const domain = createDomain({ name: '通用英语', id: 'domain_general_english', timestamp });
const collections = [
  createCollection({ domainId: domain.id, name: 'A1', order: 0, timestamp }),
  createCollection({ domainId: domain.id, name: 'AWL', order: 1, timestamp }),
  createCollection({ domainId: domain.id, name: '短语总表', type: 'system-phrases', order: 1, timestamp }),
];
let backup = canonicalizeBackup({
  schemaVersion: 5, appVersion: '3.5.0', exportedAt: timestamp,
  domains: [domain], collections, entries: [], memberships: [], phraseTokens: [], pins: [], annotations: [], studyStamps: [],
  settings: { viewModes: {}, calendarMonths: {}, lastPositions: {}, builtInSeedRevision: 3 },
});

function ensureEntry(text) {
  const normalized = normalizeEnglish(text);
  let entry = backup.entries.find((item) => item.domainId === domain.id && item.normalizedText === normalized);
  if (!entry) {
    entry = createEntry({ domainId: domain.id, text, timestamp });
    backup.entries.push(entry);
  }
  return entry;
}

function ensureMembership(entry, collection) {
  if (!backup.memberships.some((item) => item.entryId === entry.id && item.collectionId === collection.id)) {
    backup.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceOrder: backup.memberships.length, timestamp }));
  }
}

for (let step = 0; step < 800; step += 1) {
  const operation = Math.floor(random() * 10);
  const normalCollections = backup.collections.filter((item) => item.type === 'normal');
  if (operation <= 2 || backup.entries.length < 3) {
    const word = ensureEntry(`word${Math.floor(random() * 120)}`);
    ensureMembership(word, pick(normalCollections));
  } else if (operation === 3) {
    const phrase = ensureEntry(`word${Math.floor(random() * 70)} pool`);
    // 3.5.0 ordinary collections may contain phrases.
    if (random() < 0.85) ensureMembership(phrase, pick(normalCollections));
  } else if (operation === 4 && backup.entries.length) {
    const entry = pick(backup.entries);
    ensureMembership(entry, pick(normalCollections));
  } else if (operation === 5 && backup.memberships.length) {
    const membership = pick(backup.memberships);
    const entry = backup.entries.find((item) => item.id === membership.entryId);
    const remaining = backup.memberships.filter((item) => item.entryId === membership.entryId && item.id !== membership.id);
    // Words must retain at least one normal membership; phrases may remain only in the derived phrase total.
    if (entry?.kind === 'phrase' || remaining.length) backup.memberships = backup.memberships.filter((item) => item.id !== membership.id);
  } else if (operation === 6 && backup.entries.length) {
    const entry = pick(backup.entries);
    if (entry.kind === 'phrase' || backup.memberships.filter((item) => item.entryId === entry.id).length > 1) {
      backup.entries = backup.entries.filter((item) => item.id !== entry.id);
      backup.memberships = backup.memberships.filter((item) => item.entryId !== entry.id);
      backup.pins = backup.pins.filter((item) => item.entryId !== entry.id);
      backup.annotations = backup.annotations.filter((item) => item.entryId !== entry.id);
      backup.studyStamps = backup.studyStamps.filter((item) => item.scope === 'global' || item.entryId !== entry.id);
    }
  } else if (operation === 7 && backup.entries.length) {
    const entry = pick(backup.entries);
    const projection = buildProjection(backup);
    const context = normalCollections.find((collection) => (projection.get(collection.id) || []).some((item) => item.id === entry.id));
    if (context && !backup.pins.some((item) => item.entryId === entry.id)) {
      backup.pins.push({ id: safeId('pin', entry.id), entryId: entry.id, domainId: entry.domainId, contextCollectionId: context.id, order: backup.pins.filter((pin) => pin.contextCollectionId === context.id).length, createdAt: timestamp });
    }
  } else if (operation === 8 && backup.entries.length) {
    const entry = pick(backup.entries);
    const key = `entry:${entry.id}`;
    const stamp = createStudyStamp({ key, entryId: entry.id, reviewDateKey: `2026-08-${String(1 + Math.floor(random() * 2)).padStart(2, '0')}`, reviewedAt: timestamp, revision: step + 1 });
    backup.studyStamps = [...backup.studyStamps.filter((item) => item.key !== key), stamp];
  } else if (operation === 9) {
    const collection = pick(normalCollections);
    backup.settings.viewModes = { ...backup.settings.viewModes, [collection.id]: random() < 0.5 ? 'alphabet' : 'date' };
    backup.settings.calendarMonths = { ...backup.settings.calendarMonths, [`${collection.id}:word`]: '2026-08', [`${collection.id}:phrase`]: '2026-08' };
  }

  backup.phraseTokens = backup.entries.flatMap(buildPhraseTokens);
  const projection = buildProjection(backup);
  backup.pins = backup.pins.flatMap((pin) => {
    if ((projection.get(pin.contextCollectionId) || []).some((item) => item.id === pin.entryId)) return [pin];
    const nextContext = normalCollections.find((collection) => (projection.get(collection.id) || []).some((item) => item.id === pin.entryId))?.id;
    return nextContext ? [{ ...pin, contextCollectionId: nextContext }] : [];
  });
  backup = canonicalizeBackup(backup);
  if (step % 25 === 0) {
    assert.equal(validateBackup(backup), true);
    assert.ok(backup.memberships.every((item) => !Object.hasOwn(item, 'sourceText')));
    assert.equal(new Set(backup.entries.map((item) => `${item.domainId}\0${item.normalizedText}`)).size, backup.entries.length);
    assert.ok(backup.studyStamps.every((item) => item.scope === 'global' || backup.entries.some((entry) => entry.id === item.entryId)));
  }
}

const finalProjection = buildProjection(backup);
assert.ok(backup.collections.filter((item) => item.type === 'normal').some((collection) => (finalProjection.get(collection.id) || []).some((item) => item.kind === 'phrase')));
console.log(`stress-tests: OK (${backup.entries.length} entries, ${backup.memberships.length} memberships, ${backup.studyStamps.length} study stamps)`);
