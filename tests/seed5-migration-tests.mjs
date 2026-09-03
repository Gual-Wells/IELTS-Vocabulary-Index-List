import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  canonicalizeBackup,
  createCollection,
  createEntry,
  createMembership,
  createStudyStamp,
  safeId,
  SYSTEM_GLOBAL_WORDS_ID,
} from '../js/v3-model.js';
import { reconcileSeedUpgrade } from '../js/v5-seed-migration.js';

const seed4 = JSON.parse(fs.readFileSync(new URL('../data/seed-4.json', import.meta.url), 'utf8'));
const seed5 = JSON.parse(fs.readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const generalDomainId = 'domain_general_english';

test('untouched Seed4 becomes Seed5 while keeping matching device IDs', () => {
  const { backup, report } = reconcileSeedUpgrade(seed4, seed4, seed5, { appliedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(backup.settings.builtInSeedRevision, 5);
  assert.equal(backup.entries.length, seed5.entries.length);
  assert.equal(backup.memberships.length, seed5.memberships.length);
  assert.equal(backup.collections.length, seed5.collections.length);
  const oldA1 = seed4.collections.find((item) => item.domainId === generalDomainId && item.name === 'A1');
  const migratedA1 = backup.collections.find((item) => item.domainId === generalDomainId && item.name === 'A1');
  assert.equal(migratedA1.id, oldA1.id);
  assert.ok(backup.collections.some((item) => item.name === 'C2'));
  assert.ok(backup.settings.contentSources.some((item) => item.key === 'SEED5:cefrj-1.6' && item.sha256));
  assert.equal(report.userEditsPreserved, 0);
});

test('three-way reconciliation preserves user edits, records, deletion and study state', () => {
  const current = structuredClone(seed4);
  const targetTexts = new Set(seed5.entries.filter((item) => item.domainId === generalDomainId).map((item) => item.normalizedText));
  const shared = current.entries.filter((item) => item.domainId === generalDomainId && item.kind === 'word' && targetTexts.has(item.normalizedText));
  assert.ok(shared.length > 3);
  const edited = shared[0];
  edited.glossHans = '用户保留释义';
  edited.glossHant = '用戶保留釋義';
  edited.glossSource = 'manual';
  edited.updatedAt = '2026-09-01T12:00:00.000Z';
  const editedMembership = current.memberships.find((item) => item.entryId === edited.id);
  assert.ok(editedMembership);

  const deleted = shared[1];
  current.entries = current.entries.filter((item) => item.id !== deleted.id);
  current.memberships = current.memberships.filter((item) => item.entryId !== deleted.id);

  const a1 = current.collections.find((item) => item.domainId === generalDomainId && item.name === 'A1');
  a1.label = '我的 A1 注记';
  a1.updatedAt = '2026-09-01T12:00:00.000Z';

  const customCollection = createCollection({
    id: 'collection_user_research', domainId: generalDomainId, name: 'Research Notes', order: 900,
  });
  const customEntry = createEntry({
    id: 'entry_user_agentic_retrieval', domainId: generalDomainId, text: 'agentic retrieval workflow', kind: 'phrase',
    glossHans: '用户词条', glossHant: '用戶詞條', glossSource: 'manual',
  });
  const customMembership = createMembership({ entryId: customEntry.id, collectionId: customCollection.id, sourceLabel: 'manual' });
  current.collections.push(customCollection);
  current.entries.push(customEntry);
  current.memberships.push(customMembership);
  current.pins.push({
    id: safeId('pin', edited.id), entryId: edited.id, domainId: edited.domainId,
    contextCollectionId: SYSTEM_GLOBAL_WORDS_ID, order: 0, createdAt: '2026-09-01T12:00:00.000Z',
  });
  current.annotations.push({
    entryId: edited.id, domainId: edited.domainId, spelling: { incorrect: false, suggestion: '' },
    reason: '用户批注', createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z',
  });
  current.studyStamps.push(createStudyStamp({ entryId: edited.id, reviewDateKey: '2026-09-01' }));
  current.settings.builtInSeedRevision = 4;

  const canonicalCurrent = canonicalizeBackup(current);
  const { backup, report } = reconcileSeedUpgrade(seed4, canonicalCurrent, seed5, { appliedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(backup.entries.find((item) => item.id === edited.id)?.glossHant, '用戶保留釋義');
  assert.ok(!backup.entries.some((item) => item.id === deleted.id));
  assert.ok(backup.collections.some((item) => item.id === customCollection.id));
  assert.ok(backup.entries.some((item) => item.id === customEntry.id));
  assert.ok(backup.memberships.some((item) => item.entryId === customEntry.id && item.collectionId === customCollection.id));
  assert.equal(backup.collections.find((item) => item.id === a1.id)?.label, '我的 A1 注记');
  assert.ok(backup.pins.some((item) => item.entryId === edited.id));
  assert.ok(backup.annotations.some((item) => item.entryId === edited.id));
  assert.ok(backup.studyStamps.some((item) => item.entryId === edited.id));
  assert.ok(report.userEditsPreserved >= 2);
  assert.ok(report.userRecordsPreserved >= 3);
  assert.ok(report.userDeletionsPreserved >= 1);
});
