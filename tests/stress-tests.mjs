import assert from 'node:assert/strict';
import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, createCollection, createDomain, createEntry,
  createMembership, normalizeEnglish, safeId,
} from '../js/v3-model.js';

let seed = 0x5f3759df;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function pick(items) { return items[Math.floor(random() * items.length)]; }

const timestamp = '2026-08-01T00:00:00.000Z';
const domains = [createDomain({ name: '通用英语', id: 'domain_general_english', timestamp })];
const collections = [
  createCollection({ domainId: domains[0].id, name: 'A1', order: 0, timestamp }),
  createCollection({ domainId: domains[0].id, name: 'AWL', order: 1, timestamp }),
  createCollection({ domainId: domains[0].id, name: '短语', type: 'system-phrases', timestamp }),
];
let backup = canonicalizeBackup({ schemaVersion: 3, appVersion: '3.0.4', exportedAt: timestamp, domains, collections, entries: [], memberships: [], pins: [], annotations: [], settings: {} });

function addWord(text, collection) {
  const normalized = normalizeEnglish(text);
  let entry = backup.entries.find((item) => item.domainId === collection.domainId && item.normalizedText === normalized);
  if (!entry) { entry = createEntry({ domainId: collection.domainId, text, timestamp }); backup.entries.push(entry); }
  if (!backup.memberships.some((item) => item.entryId === entry.id && item.collectionId === collection.id)) {
    backup.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceOrder: backup.memberships.length, timestamp }));
  }
}

for (let step = 0; step < 600; step += 1) {
  const operation = Math.floor(random() * 8);
  const normalCollections = backup.collections.filter((item) => item.type === 'normal');
  if (operation <= 2 || backup.entries.length < 3) {
    addWord(`word ${Math.floor(random() * 90)}`.replace(' ', random() < 0.82 ? '' : ' '), pick(normalCollections));
  } else if (operation === 3) {
    const number = Math.floor(random() * 40);
    const text = `word${number} pool`;
    const normalized = normalizeEnglish(text);
    if (!backup.entries.some((item) => item.domainId === domains[0].id && item.normalizedText === normalized)) backup.entries.push(createEntry({ domainId: domains[0].id, text, timestamp }));
  } else if (operation === 4 && backup.entries.some((item) => item.kind === 'word')) {
    const entry = pick(backup.entries.filter((item) => item.kind === 'word'));
    const collection = pick(normalCollections);
    if (!backup.memberships.some((item) => item.entryId === entry.id && item.collectionId === collection.id)) backup.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceOrder: step, timestamp }));
  } else if (operation === 5 && backup.memberships.length) {
    const membership = pick(backup.memberships);
    const entry = backup.entries.find((item) => item.id === membership.entryId);
    const remaining = backup.memberships.filter((item) => item.entryId === membership.entryId && item.id !== membership.id);
    if (entry?.kind === 'phrase' || remaining.length) backup.memberships = backup.memberships.filter((item) => item.id !== membership.id);
  } else if (operation === 6 && backup.entries.length) {
    const entry = pick(backup.entries);
    if (entry.kind === 'phrase' || backup.memberships.filter((item) => item.entryId === entry.id).length > 1) {
      backup.entries = backup.entries.filter((item) => item.id !== entry.id);
      backup.memberships = backup.memberships.filter((item) => item.entryId !== entry.id);
      backup.pins = backup.pins.filter((item) => item.entryId !== entry.id);
      backup.annotations = backup.annotations.filter((item) => item.entryId !== entry.id);
    }
  } else if (operation === 7 && backup.entries.length) {
    const entry = pick(backup.entries);
    if (!backup.pins.some((item) => item.entryId === entry.id)) {
      const context = entry.kind === 'phrase' ? backup.collections.find((item) => item.type === 'system-phrases') : backup.collections.find((item) => item.type === 'normal' && backup.memberships.some((membership) => membership.entryId === entry.id && membership.collectionId === item.id));
      if (context) backup.pins.push({ id: safeId('pin', entry.id), entryId: entry.id, domainId: entry.domainId, contextCollectionId: context.id, order: backup.pins.filter((pin) => pin.contextCollectionId === context.id).length, createdAt: timestamp });
    }
  }
  backup.phraseTokens = backup.entries.flatMap(buildPhraseTokens);
  const projection = buildProjection(backup);
  backup.pins = backup.pins.flatMap((pin) => {
    if ((projection.get(pin.contextCollectionId) || []).some((item) => item.id === pin.entryId)) return [pin];
    const nextContext = [...projection.entries()].find(([, items]) => items.some((item) => item.id === pin.entryId))?.[0];
    return nextContext ? [{ ...pin, contextCollectionId: nextContext }] : [];
  });
  backup = canonicalizeBackup(backup);
  if (step % 25 === 0) {
    assert.ok(backup.memberships.every((item) => !Object.hasOwn(item, 'sourceText')));
    assert.equal(new Set(backup.entries.map((item) => `${item.domainId}\0${item.normalizedText}`)).size, backup.entries.length);
  }
}

console.log(`stress-tests: OK (${backup.entries.length} entries, ${backup.memberships.length} memberships)`);
