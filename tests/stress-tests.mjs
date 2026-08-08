import assert from 'node:assert/strict';
import {
  buildProjection, buildRelationComponentsForEntries, canonicalizeBackup, createCollection, createDomain, createEntry,
  createMembership, createStudyStamp, normalizeEnglish, safeId, validateBackup,
} from '../js/v3-model.js';

let rng = 0x5f3759df;
function random() { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 0x100000000; }
function pick(items) { return items[Math.floor(random() * items.length)]; }

const timestamp = '2026-08-08T00:00:00.000Z';
const structured = createDomain({ id: 'domain_structured', name: '通用英语', contentMode: 'structured', timestamp });
const contentDomain = createDomain({ id: 'domain_content', name: '通用英语搭配', contentMode: 'nonStructured', order: 1, timestamp });
const sA = createCollection({ id: 'collection_a', domainId: structured.id, name: 'A1', order: 0, timestamp });
const sB = createCollection({ id: 'collection_b', domainId: structured.id, name: 'COCA', order: 1, timestamp });
const sP = createCollection({ domainId: structured.id, name: '短语总表', type: 'system-phrases', order: 99, timestamp });
const cA = createCollection({ id: 'content_a', domainId: contentDomain.id, name: '句型', order: 0, timestamp });
const cB = createCollection({ id: 'content_b', domainId: contentDomain.id, name: '模板表达', order: 1, timestamp });
let backup = canonicalizeBackup({
  schemaVersion: 6, appVersion: '4.0.0', exportedAt: timestamp,
  domains: [structured, contentDomain], collections: [sA, sB, sP, cA, cB],
  entries: [], memberships: [], relationComponents: [], pins: [], annotations: [], studyStamps: [],
  settings: { closeLowLevelRelations: true, viewModes: {}, calendarMonths: {}, lastPositions: {} },
});

function normalsForDomain(domainId) { return backup.collections.filter((item) => item.domainId === domainId && item.type === 'normal'); }
function ensureEntry(domainId, text, kind, contentType = '') {
  const normalized = normalizeEnglish(text);
  let entry = backup.entries.find((item) => item.domainId === domainId && item.normalizedText === normalized);
  if (!entry) { entry = createEntry({ domainId, text, kind, contentType, timestamp }); backup.entries.push(entry); }
  return entry;
}
function ensureMembership(entry, collection) {
  if (!backup.memberships.some((item) => item.entryId === entry.id && item.collectionId === collection.id)) {
    backup.memberships.push(createMembership({ entryId: entry.id, collectionId: collection.id, sourceOrder: backup.memberships.length, timestamp }));
  }
}

for (let step = 0; step < 600; step += 1) {
  const op = Math.floor(random() * 11);
  if (op <= 2 || backup.entries.length < 5) {
    const entry = ensureEntry(structured.id, `word${Math.floor(random() * 140)}`, 'word');
    ensureMembership(entry, pick(normalsForDomain(structured.id)));
  } else if (op === 3) {
    const entry = ensureEntry(structured.id, `word${Math.floor(random() * 80)} pool`, 'phrase');
    ensureMembership(entry, pick(normalsForDomain(structured.id)));
  } else if (op === 4) {
    const entry = ensureEntry(contentDomain.id, `word${Math.floor(random() * 80)} pattern`, 'content', random() < .5 ? 'sentence-pattern' : 'template-expression');
    ensureMembership(entry, pick(normalsForDomain(contentDomain.id)));
  } else if (op === 5 && backup.entries.length) {
    const entry = pick(backup.entries);
    ensureMembership(entry, pick(normalsForDomain(entry.domainId)));
  } else if (op === 6 && backup.memberships.length) {
    const membership = pick(backup.memberships);
    const remaining = backup.memberships.filter((item) => item.entryId === membership.entryId && item.id !== membership.id);
    if (remaining.length) backup.memberships = backup.memberships.filter((item) => item.id !== membership.id);
  } else if (op === 7 && backup.entries.length > 5) {
    const entry = pick(backup.entries);
    backup.entries = backup.entries.filter((item) => item.id !== entry.id);
    backup.memberships = backup.memberships.filter((item) => item.entryId !== entry.id);
    backup.pins = backup.pins.filter((item) => item.entryId !== entry.id);
    backup.studyStamps = backup.studyStamps.filter((item) => item.entryId !== entry.id);
  } else if (op === 8 && backup.entries.length) {
    const projection = buildProjection({ ...backup, relationComponents: buildRelationComponentsForEntries(backup.entries) });
    const entry = pick(backup.entries);
    const context = normalsForDomain(entry.domainId).find((collection) => (projection.get(collection.id) || []).some((item) => item.id === entry.id));
    if (context && !backup.pins.some((pin) => pin.entryId === entry.id)) {
      backup.pins.push({ id: safeId('pin', entry.id), entryId: entry.id, domainId: entry.domainId, contextCollectionId: context.id, order: 0, createdAt: timestamp });
    }
  } else if (op === 9 && backup.entries.length) {
    const entry = pick(backup.entries);
    const key = `entry:${entry.id}`;
    const stamp = createStudyStamp({ entryId: entry.id, reviewDateKey: `2026-08-${String(1 + Math.floor(random() * 8)).padStart(2, '0')}`, reviewedAt: timestamp, revision: step + 1 });
    backup.studyStamps = [...backup.studyStamps.filter((item) => item.key !== key), stamp];
  } else if (op === 10) {
    const domainId = random() < .5 ? structured.id : contentDomain.id;
    const normals = normalsForDomain(domainId);
    if (normals.length >= 2) {
      const [first, second] = normals;
      backup.collections = backup.collections.map((collection) => collection.id === first.id ? { ...collection, order: second.order } : collection.id === second.id ? { ...collection, order: first.order } : collection);
    }
  }

  backup.relationComponents = buildRelationComponentsForEntries(backup.entries);
  // PINs must follow the current canonical visible ordinary projection after priority moves.
  const projection = buildProjection(backup);
  backup.pins = backup.pins.flatMap((pin) => {
    if ((projection.get(pin.contextCollectionId) || []).some((item) => item.id === pin.entryId)) return [pin];
    const entry = backup.entries.find((item) => item.id === pin.entryId);
    const next = entry ? normalsForDomain(entry.domainId).find((collection) => (projection.get(collection.id) || []).some((item) => item.id === entry.id)) : null;
    return next ? [{ ...pin, contextCollectionId: next.id }] : [];
  });
  backup = canonicalizeBackup(backup);
  if (step % 20 === 0) {
    assert.equal(validateBackup(backup), true);
    assert.equal(new Set(backup.entries.map((item) => `${item.domainId}\0${item.normalizedText}`)).size, backup.entries.length);
    assert.ok(backup.entries.every((entry) => backup.memberships.some((membership) => membership.entryId === entry.id)));
    assert.ok(backup.studyStamps.every((stamp) => backup.entries.some((entry) => entry.id === stamp.entryId)));
    const p = buildProjection(backup);
    for (const entry of backup.entries) {
      const visibleNormals = normalsForDomain(entry.domainId).filter((collection) => (p.get(collection.id) || []).some((item) => item.id === entry.id));
      assert.equal(visibleNormals.length, 1, `优先级占有必须给 ${entry.text} 唯一普通表投影`);
    }
  }
}

assert.equal(validateBackup(backup), true);
assert.ok(backup.entries.some((item) => item.kind === 'word'));
assert.ok(backup.entries.some((item) => item.kind === 'phrase'));
assert.ok(backup.entries.some((item) => item.kind === 'content'));
console.log(`stress-tests: OK (${backup.entries.length} entries, ${backup.memberships.length} memberships, ${backup.relationComponents.length} relation components)`);
