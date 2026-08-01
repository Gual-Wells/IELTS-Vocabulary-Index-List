import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, createCollection, createDomain,
  createEntry, createMembership, isPhraseText, migrateLegacyBackup, normalizeDisplayText,
  normalizeEnglish, normalizeGlossHant, parseLegacySourceLine, phraseComponents,
  relatedPhrases, safeId, searchBackup, systemPhraseCollectionId, tokenizeEnglish, validateBackup,
} from '../js/v3-model.js';
import { parseCsv, parseImportContent, parseJsonContent, parseTextList } from '../js/v3-import.js';
import { createAiCheckBatches, parseRetryAfter } from '../js/v3-ai.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');

assert.equal(normalizeDisplayText('  Can’t   wait  '), "Can't wait");
assert.equal(normalizeEnglish('  Can’t   wait  '), "can't wait");
assert.equal(normalizeEnglish('well‑being'), 'well-being');
assert.equal(normalizeEnglish('zero\u200bwidth'), 'zerowidth');
assert.equal(isPhraseText('thread pool'), true);
assert.equal(isPhraseText('thread-pool'), false);
assert.deepEqual(tokenizeEnglish("don't give up"), ["don't", 'give', 'up']);
assert.equal(normalizeGlossHant('开发后台线程池'), '開發後台線程池');
assert.equal(parseLegacySourceLine('access n., v.').text, 'access');
assert.equal(parseLegacySourceLine('access n., v.').sourceLabel, 'n., v.');
assert.equal(parseLegacySourceLine('# A'), null);
assert.equal(parseLegacySourceLine('#hashtag n.').text, '#hashtag');

const legacy = {
  schemaVersion: 1,
  appVersion: '2.4.1',
  categories: [
    { id: 'cat_a1', name: 'A1', order: 0 },
    { id: 'cat_awl', name: 'AWL', order: 1 },
  ],
  entries: [
    {
      id: 'old_access', word: 'access', normalizedWord: 'access', categoryId: 'cat_a1', pos: ['n.', 'v.'], manualPos: ['adj.'],
      sources: {
        cat_a1: { word: 'access', pos: ['n.', 'v.'], order: 4 },
        cat_awl: { word: 'access', pos: ['n.'], order: 1 },
      },
    },
    {
      id: 'old_phrase', word: 'thread pool', normalizedWord: 'thread pool', categoryId: 'cat_awl', pos: ['n.'],
      sources: { cat_awl: { word: 'thread pool', pos: ['n.'], order: 2 } },
    },
    {
      id: 'old_thread', word: 'thread', normalizedWord: 'thread', categoryId: 'cat_awl', pos: ['n.'],
      sources: { cat_awl: { word: 'thread', pos: ['n.'], order: 3 } },
    },
  ],
  pins: [{ entryId: 'old_access', categoryId: 'cat_a1', order: 7, createdAt: '2026-07-31T00:00:00.000Z' }],
  annotations: [{ entryId: 'old_access', spelling: { incorrect: true, suggestion: 'access' }, reason: 'test' }],
  settings: { numberMode: 'group', 'lastPosition:cat_a1': 'old_access' },
};
const backup = migrateLegacyBackup(legacy, { timestamp: '2026-08-01T00:00:00.000Z' });
assert.equal(backup.schemaVersion, 3);
assert.equal(backup.domains.length, 1);
assert.equal(backup.collections.filter((item) => item.type === 'normal').length, 2);
assert.equal(backup.collections.filter((item) => item.type === 'system-phrases').length, 1);
assert.equal(backup.entries.length, 3);
assert.equal(backup.memberships.length, 4);
assert.equal(backup.phraseTokens.length, 2);
assert.equal(backup.settings.numberMode, 'group');
assert.equal(Object.values(backup.settings.lastPositions)[0], backup.entries.find((item) => item.text === 'access').id);
assert.equal(backup.pins[0].order, 7);
assert.ok(backup.memberships.filter((item) => item.entryId === backup.entries.find((entry) => entry.text === 'access').id).every((item) => item.sourceLabel === 'adj.'), '人工词性覆盖必须迁移为来源标签');
assert.ok(backup.memberships.every((item) => !Object.hasOwn(item, 'sourceText')), '来源关系不得重复保存英文文本');
assert.equal(validateBackup(backup), true);

const access = backup.entries.find((item) => item.text === 'access');
const thread = backup.entries.find((item) => item.text === 'thread');
const phrase = backup.entries.find((item) => item.text === 'thread pool');
assert.deepEqual(relatedPhrases(backup, thread.id).map((item) => item.id), [phrase.id]);
assert.equal(relatedPhrases(backup, access.id).length, 0);
assert.deepEqual(phraseComponents(backup, phrase.id).map((item) => item.entry?.text || null), ['thread', null]);
const projection = buildProjection(backup);
const a1Projection = projection.get(backup.collections.find((item) => item.name === 'A1').id);
assert.ok(a1Projection.some((item) => item.id === access.id));
assert.ok(a1Projection.every((item) => item.kind === 'word'), '普通词表投影只能包含词汇');
const phraseProjection = projection.get(systemPhraseCollectionId(backup.domains[0].id));
assert.ok(phraseProjection.some((item) => item.id === phrase.id));
assert.ok(phraseProjection.every((item) => item.kind === 'phrase'), '短语表投影只能包含短语');
assert.equal(searchBackup(backup, 'thr').length, 2);
assert.equal(searchBackup(backup, 'thred').some((item) => item.text === 'thread'), true, '轻微拼写错误应命中');

const secondDomain = createDomain({ name: '计算机科学', order: 1, glossEnabled: true, timestamp: '2026-08-01T00:00:00.000Z' });
const secondCollection = createCollection({ domainId: secondDomain.id, name: '基础', timestamp: '2026-08-01T00:00:00.000Z' });
const secondPhrases = createCollection({ domainId: secondDomain.id, name: '短语', type: 'system-phrases', timestamp: '2026-08-01T00:00:00.000Z' });
const secondAccess = createEntry({ domainId: secondDomain.id, text: 'access', glossHant: '訪問', timestamp: '2026-08-01T00:00:00.000Z' });
const crossDomain = canonicalizeBackup({
  ...backup,
  domains: [...backup.domains, secondDomain],
  collections: [...backup.collections, secondCollection, secondPhrases],
  entries: [...backup.entries, secondAccess],
  memberships: [...backup.memberships, createMembership({ entryId: secondAccess.id, collectionId: secondCollection.id, timestamp: '2026-08-01T00:00:00.000Z' })],
});
assert.equal(crossDomain.entries.filter((item) => item.normalizedText === 'access').length, 2, '同形词可存在于不同词域');
assert.throws(() => canonicalizeBackup({ ...crossDomain, entries: [...crossDomain.entries, { ...secondAccess, id: 'duplicate' }] }), /重复/);
assert.equal(canonicalizeBackup({ ...crossDomain, settings: { ...crossDomain.settings, numberMode: 'none' } }).settings.numberMode, 'none');
assert.equal(canonicalizeBackup({ ...crossDomain, settings: { ...crossDomain.settings, numberMode: 'group' } }).settings.numberMode, 'group');

const textParsed = parseTextList('# Demo\n## A\naccess n., v.\naccess v.\nthread pool n.\n');
assert.equal(textParsed.errors.length, 0);
assert.equal(textParsed.entries.length, 2);
assert.equal(textParsed.entries[0].sourceLabel, 'n., v.');
const csvParsed = parseCsv('text,sourceLabel,gloss\n"thread","n.","线程"\n"thread pool","","线程池"\n');
assert.equal(csvParsed.entries.length, 2);
assert.equal(csvParsed.entries[1].gloss, '线程池');
assert.throws(() => parseCsv('text,sourceLabel\n"broken,n.\n'), /未闭合/);
assert.equal(parseJsonContent('[{"text":"thread","sourceLabel":"n."}]').kind, 'entries');
assert.equal(parseImportContent(JSON.stringify(backup), 'backup.json').kind, 'backup');

assert.equal(parseRetryAfter('2'), 2000);
assert.equal(parseRetryAfter(new Date(5000).toUTCString(), 0), 5000);
const batches = createAiCheckBatches(Array.from({ length: 75 }, (_, index) => ({ id: `e${index}`, text: `word-${index}` })));
assert.ok(batches.length >= 3);
assert.ok(batches.every((batch) => batch.length <= 32));

// When the retained 2.4.1 seed is present, verify the real migration contract.
const seedPath = path.join(root, 'data', 'seed.json');
if (fs.existsSync(seedPath)) {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  assert.equal(seed.entries.length, 5005);
  const migrated = migrateLegacyBackup(seed, { timestamp: '2026-08-01T00:00:00.000Z' });
  assert.equal(migrated.entries.length, 5005);
  assert.equal(migrated.collections.filter((item) => item.type === 'normal').length, 7);
  assert.equal(migrated.memberships.length, 6407);
  assert.equal(migrated.phraseTokens.length, 20);
  const fullProjection = buildProjection(migrated);
  for (const collection of migrated.collections) {
    const visible = fullProjection.get(collection.id) || [];
    if (collection.type === 'normal') assert.ok(visible.every((entry) => entry.kind === 'word'));
    else assert.ok(visible.every((entry) => entry.kind === 'phrase'));
  }
  assert.ok(migrated.memberships.every((item) => !Object.hasOwn(item, 'sourceText')));
}

console.log('run-tests: OK');
