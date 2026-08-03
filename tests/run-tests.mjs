import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProjection, canonicalizeBackup, cleanStudyStampReferences, createCollection, createDomain, createEntry,
  createMembership, createStudyStamp, isPhraseText, migrateLegacyBackup,
  normalizeDisplayText, normalizeEnglish, normalizeGlossHant, parseLegacySourceLine, positionScopeDomainId,
  phraseComponents, relatedPhrases, safeId, searchBackup, systemPhraseCollectionId,
  systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID,
  tokenizeEnglish, uniqueProjectionCount, validateBackup,
} from '../js/v3-model.js';
import { parseCsv, parseImportContent, parseJsonContent, parseTextList } from '../js/v3-import.js';
import { mergeBuiltInDomainBackup } from '../js/v3-db.js';
import { createAiCheckBatches, parseRetryAfter } from '../js/v3-ai.js';
import { createVixPackage, normalizeVixPackage, planVixImport, VIX_FORMAT, VIX_VERSION } from '../js/v3-exchange.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const timestamp = '2026-08-02T01:51:00.000Z';

assert.equal(normalizeDisplayText('  Can’t   wait  '), "Can't wait");
assert.equal(normalizeEnglish('  Can’t   wait  '), "can't wait");
assert.equal(normalizeEnglish('well‑being'), 'well-being');
assert.equal(normalizeEnglish('zero\u200bwidth'), 'zerowidth');
assert.equal(isPhraseText('thread pool'), true);
assert.equal(isPhraseText('thread-pool'), false);
assert.deepEqual(tokenizeEnglish("don't give up"), ["don't", 'give', 'up']);
assert.equal(normalizeGlossHant('开发后台线程池'), '開發後台線程池');
assert.equal(normalizeGlossHant('访问控制'), '訪問控制');
assert.equal(parseLegacySourceLine('access n., v.').sourceLabel, 'n., v.');
assert.equal(parseLegacySourceLine('# A'), null);

assert.equal(positionScopeDomainId({ id: SYSTEM_GLOBAL_WORDS_ID, domainId: '', virtual: true }), 'global');
assert.equal(positionScopeDomainId({ id: SYSTEM_GLOBAL_PHRASES_ID, domainId: '', virtual: true }, { domainId: 'domain_x' }), 'global');
assert.equal(positionScopeDomainId({ id: 'ordinary', domainId: 'domain_x' }), 'domain_x');

const legacy = {
  schemaVersion: 1,
  appVersion: '2.4.1',
  categories: [
    { id: 'cat_a1', name: 'A1', order: 0 },
    { id: 'cat_awl', name: 'AWL', order: 1 },
  ],
  entries: [
    {
      id: 'old_access', word: 'access', categoryId: 'cat_a1', manualPos: ['adj.'],
      sources: { cat_a1: { pos: ['n.'], order: 4 }, cat_awl: { pos: ['n.'], order: 1 } },
    },
    { id: 'old_phrase', word: 'thread pool', sources: { cat_awl: { pos: ['n.'], order: 2 } } },
    { id: 'old_thread', word: 'thread', sources: { cat_awl: { pos: ['n.'], order: 3 } } },
  ],
  pins: [{ entryId: 'old_access', categoryId: 'cat_a1', order: 7, createdAt: timestamp }],
  annotations: [{ entryId: 'old_access', spelling: { incorrect: true, suggestion: 'access' }, reason: 'test' }],
  settings: { numberMode: 'group', 'lastPosition:cat_a1': 'old_access' },
};
const backup = migrateLegacyBackup(legacy, { timestamp });
assert.equal(backup.schemaVersion, 5);
assert.equal(backup.appVersion, '3.5.1');
assert.equal(backup.domains.length, 1);
assert.equal(backup.collections.filter((item) => item.type === 'normal').length, 2);
assert.equal(backup.collections.find((item) => item.type === 'system-phrases').name, '短语总表');
assert.equal(backup.entries.length, 3);
assert.equal(backup.memberships.length, 4);
assert.equal(backup.settings.numberMode, 'group');
assert.equal(validateBackup(backup), true);

const access = backup.entries.find((item) => item.text === 'access');
const thread = backup.entries.find((item) => item.text === 'thread');
const phrase = backup.entries.find((item) => item.text === 'thread pool');
assert.deepEqual(relatedPhrases(backup, thread.id).map((item) => item.id), [phrase.id]);
assert.deepEqual(phraseComponents(backup, phrase.id).map((item) => item.entry?.text || null), ['thread', null]);
const projection = buildProjection(backup);
const awlId = backup.collections.find((item) => item.name === 'AWL').id;
const a1Id = backup.collections.find((item) => item.name === 'A1').id;
assert.ok(projection.get(awlId).some((item) => item.kind === 'word'));
assert.ok(projection.get(awlId).some((item) => item.kind === 'phrase'), '普通表必须同时投影词汇和短语');
assert.equal(projection.get(a1Id).some((item) => item.id === access.id), true, '多归属词汇应由最高优先级词表占有');
assert.equal(projection.get(awlId).some((item) => item.id === access.id), false, '低优先级词表不得重复显示同一普通词汇');
const prioritySwapped = canonicalizeBackup({
  ...backup,
  pins: [],
  settings: { ...backup.settings, lastPositions: {} },
  collections: backup.collections.map((collection) => collection.id === a1Id
    ? { ...collection, order: 10 }
    : collection.id === awlId ? { ...collection, order: -1 } : collection),
});
const swappedProjection = buildProjection(prioritySwapped);
assert.equal(swappedProjection.get(a1Id).some((item) => item.id === access.id), false);
assert.equal(swappedProjection.get(awlId).some((item) => item.id === access.id), true, '调整优先级必须重新分配普通词汇显示归属');
assert.equal(prioritySwapped.entries.find((item) => item.id === access.id).id, access.id, '优先级变化不得改写具体 Entry');
assert.ok(projection.get(systemPhraseCollectionId(backup.domains[0].id)).every((item) => item.kind === 'phrase'));
assert.ok(projection.get(systemDomainWordsCollectionId(backup.domains[0].id)).every((item) => item.kind === 'word'));
assert.ok(projection.get(SYSTEM_GLOBAL_WORDS_ID).every((item) => item.kind === 'word'));
assert.ok(projection.get(SYSTEM_GLOBAL_PHRASES_ID).every((item) => item.kind === 'phrase'));
assert.equal(searchBackup(backup, 'thred').some((item) => item.text === 'thread'), true);

// 3.0.x full backups must upgrade in place instead of falling into 2.x migration.
const v307Backup = { ...backup, schemaVersion: 3, appVersion: '3.0.7' };
const upgraded = migrateLegacyBackup(v307Backup, { timestamp });
assert.equal(upgraded.schemaVersion, 5);
assert.equal(upgraded.entries.length, backup.entries.length);
assert.equal(upgraded.memberships.length, backup.memberships.length);

// Study state and four-mode positions belong only to the complete backup.
const entryStamp = createStudyStamp({ entryId: access.id, reviewDateKey: '2026-08-02', reviewedAt: timestamp });
const globalStamp = createStudyStamp({ scope: 'global', kind: 'word', normalizedText: 'access', reviewDateKey: '2026-08-01', reviewedAt: timestamp });
const stateful = canonicalizeBackup({
  ...backup,
  studyStamps: [entryStamp, globalStamp],
  settings: {
    ...backup.settings,
    viewModes: { [awlId]: 'date' },
    calendarMonths: { [`${awlId}:word`]: '2026-08', [`${awlId}:phrase`]: '2026-07' },
    lastPositions: {
      [`lastPosition:${thread.domainId}:${awlId}:alphabet:word`]: thread.id,
      [`lastPosition:${phrase.domainId}:${awlId}:date:phrase`]: phrase.id,
    },
  },
});
assert.equal(stateful.studyStamps.length, 1);
assert.equal(stateful.studyStamps[0].scope, 'entry');
assert.equal(stateful.studyStamps[0].entryId, access.id);
assert.equal(stateful.studyStamps[0].reviewDateKey, '2026-08-02');
assert.equal(stateful.settings.viewModes[awlId], 'date');
assert.equal(validateBackup(stateful), true);

const dirtyReferences = structuredClone(stateful);
dirtyReferences.studyStamps.push(
  { ...entryStamp, key: 'entry:missing', entryId: 'missing-entry' },
  { ...globalStamp, key: 'global:word:missing', normalizedText: 'missing' },
);
cleanStudyStampReferences(dirtyReferences);
assert.equal(dirtyReferences.studyStamps.length, 1, '孤儿及旧全局学习日期必须在破坏性操作规范化阶段清理');

// Cross-domain duplicates aggregate only in system global projections.
const secondDomain = createDomain({ name: '计算机科学', order: 1, glossEnabled: true, timestamp });
const secondCollection = createCollection({ domainId: secondDomain.id, name: '基础', timestamp });
const secondPhrases = createCollection({ domainId: secondDomain.id, name: '短语总表', type: 'system-phrases', timestamp });
const secondAccess = createEntry({ domainId: secondDomain.id, text: 'access', glossHant: '訪問', timestamp });
const secondThreadPool = createEntry({ domainId: secondDomain.id, text: 'thread pool', glossHant: '線程池', timestamp });
const crossDomain = canonicalizeBackup({
  ...backup,
  domains: [...backup.domains, secondDomain],
  collections: [...backup.collections, secondCollection, secondPhrases],
  entries: [...backup.entries, secondAccess, secondThreadPool],
  memberships: [
    ...backup.memberships,
    createMembership({ entryId: secondAccess.id, collectionId: secondCollection.id, timestamp }),
    createMembership({ entryId: secondThreadPool.id, collectionId: secondCollection.id, timestamp }),
  ],
});
const crossProjection = buildProjection(crossDomain);
assert.equal(crossDomain.entries.filter((item) => item.normalizedText === 'access').length, 2);
assert.equal(crossProjection.get(SYSTEM_GLOBAL_WORDS_ID).filter((item) => item.normalizedText === 'access').length, 2);
assert.equal(uniqueProjectionCount(crossProjection.get(SYSTEM_GLOBAL_WORDS_ID)), uniqueProjectionCount(projection.get(SYSTEM_GLOBAL_WORDS_ID)), '跨域同形词增加渲染行但不增加唯一词形总数');
assert.deepEqual(crossProjection.get(SYSTEM_GLOBAL_WORDS_ID).filter((item) => item.normalizedText === 'access').map((item) => item.domainId), [backup.domains[0].id, secondDomain.id]);
assert.equal(crossProjection.get(SYSTEM_GLOBAL_PHRASES_ID).filter((item) => item.normalizedText === 'thread pool').length, 2);
assert.equal(uniqueProjectionCount(crossProjection.get(SYSTEM_GLOBAL_PHRASES_ID)), uniqueProjectionCount(projection.get(SYSTEM_GLOBAL_PHRASES_ID)), '跨域同形短语增加渲染行但不增加唯一短语总数');
assert.deepEqual(crossProjection.get(SYSTEM_GLOBAL_PHRASES_ID).filter((item) => item.normalizedText === 'thread pool').map((item) => item.domainId), [backup.domains[0].id, secondDomain.id]);
assert.ok(!crossDomain.collections.some((item) => [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(item.id)), '全局总表不得成为持久化词表');

const reorderedCrossDomain = canonicalizeBackup({
  ...crossDomain,
  domains: crossDomain.domains.map((domain) => ({ ...domain, order: domain.id === secondDomain.id ? 0 : 1 })),
});
const reorderedProjection = buildProjection(reorderedCrossDomain);
assert.deepEqual(reorderedProjection.get(SYSTEM_GLOBAL_WORDS_ID).filter((item) => item.normalizedText === 'access').map((item) => item.domainId), [secondDomain.id, backup.domains[0].id]);
assert.deepEqual(reorderedProjection.get(SYSTEM_GLOBAL_PHRASES_ID).filter((item) => item.normalizedText === 'thread pool').map((item) => item.domainId), [secondDomain.id, backup.domains[0].id]);

const schema4WithAmbiguousGlobalDate = canonicalizeBackup({
  ...crossDomain,
  schemaVersion: 4,
  appVersion: '3.3.1',
  studyStamps: [{
    key: 'global:word:access', scope: 'global', kind: 'word', normalizedText: 'access',
    reviewDateKey: '2026-08-03', reviewedAt: timestamp, revision: 1,
  }],
});
assert.equal(schema4WithAmbiguousGlobalDate.studyStamps.length, 1);
assert.equal(schema4WithAmbiguousGlobalDate.studyStamps[0].entryId, access.id, '旧全局日期必须迁移给旧域顺序下的代表 Entry');
assert.equal(schema4WithAmbiguousGlobalDate.settings.studyStampMigrationIssues.length, 1);
assert.deepEqual(schema4WithAmbiguousGlobalDate.settings.studyStampMigrationIssues[0].candidateEntryIds, [access.id, secondAccess.id]);

// Text/CSV/JSON import compatibility.
const textParsed = parseTextList('# Demo\n## A\naccess n., v.\naccess v.\nthread pool n.\n');
assert.equal(textParsed.entries.length, 2);
const csvParsed = parseCsv('text,sourceLabel,gloss\n"thread","n.","线程"\n"thread pool","","线程池"\n');
assert.equal(csvParsed.entries.length, 2);
assert.throws(() => parseCsv('text,sourceLabel\n"broken,n.\n'), /未闭合/);
assert.equal(parseJsonContent('[{"text":"thread"}]').kind, 'entries');
assert.equal(parseImportContent(JSON.stringify(v307Backup), 'backup.json').kind, 'backup');

assert.equal(parseRetryAfter('2'), 2000);
assert.ok(createAiCheckBatches(Array.from({ length: 75 }, (_, index) => ({ id: `e${index}`, text: `word-${index}` }))).every((batch) => batch.length <= 32));

// Complete 3.5.1 seed contract.
const rawSeed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
const seed = migrateLegacyBackup(rawSeed, { timestamp });
assert.equal(seed.schemaVersion, 5);
assert.equal(seed.appVersion, '3.5.1');
assert.equal(seed.settings.builtInSeedRevision, 3);
assert.equal(seed.studyStamps.length, 0);
assert.equal(seed.domains.length, 2);
assert.ok(seed.collections.filter((item) => item.type === 'system-phrases').every((item) => item.name === '短语总表'));

const computerDomainId = 'domain_computer_terms';
const computerEntries = seed.entries.filter((item) => item.domainId === computerDomainId);
const computerWords = computerEntries.filter((item) => item.kind === 'word');
const computerPhrases = computerEntries.filter((item) => item.kind === 'phrase');
assert.equal(computerWords.length, 544);
assert.equal(computerPhrases.length, 577);
const visibleComputerCollections = seed.collections.filter((item) => item.domainId === computerDomainId && item.type === 'normal' && !item.hidden);
assert.deepEqual(visibleComputerCollections.map((item) => item.name).sort(), ['人工智能', '计算机基础与系统', '网络、云与安全', '软件开发与数据'].sort());
const computerPhraseMembershipCounts = new Map(visibleComputerCollections.map((item) => [item.id, 0]));
for (const phraseEntry of computerPhrases) {
  const memberships = seed.memberships.filter((item) => item.entryId === phraseEntry.id && computerPhraseMembershipCounts.has(item.collectionId));
  assert.equal(memberships.length, 1, `计算机短语必须恰好进入一个普通表：${phraseEntry.text}`);
  computerPhraseMembershipCounts.set(memberships[0].collectionId, computerPhraseMembershipCounts.get(memberships[0].collectionId) + 1);
}
const countsByName = Object.fromEntries(visibleComputerCollections.map((collection) => [collection.name, computerPhraseMembershipCounts.get(collection.id)]));
assert.deepEqual(countsByName, { '计算机基础与系统': 139, '软件开发与数据': 222, '网络、云与安全': 165, '人工智能': 51 });
assert.equal(Object.values(countsByName).reduce((sum, value) => sum + value, 0), 577);

const generalPhrases = seed.entries.filter((item) => item.domainId === 'domain_general_english' && item.kind === 'phrase');
assert.equal(generalPhrases.length, 10);
assert.ok(generalPhrases.every((entry) => seed.memberships.filter((item) => item.entryId === entry.id && seed.collections.find((collection) => collection.id === item.collectionId)?.type === 'normal').length === 1));

const seedProjection = buildProjection(seed);
assert.equal(seedProjection.get(systemDomainWordsCollectionId(computerDomainId)).length, 544);
assert.equal(seedProjection.get(systemPhraseCollectionId(computerDomainId)).length, 577);
assert.ok(visibleComputerCollections.every((collection) => {
  const list = seedProjection.get(collection.id);
  return list.some((entry) => entry.kind === 'word') && list.some((entry) => entry.kind === 'phrase');
}), '四个计算机普通表都应为词汇＋短语复合视图');
assert.ok(seedProjection.get(SYSTEM_GLOBAL_WORDS_ID).every((entry) => entry.kind === 'word'));
assert.ok(seedProjection.get(SYSTEM_GLOBAL_PHRASES_ID).every((entry) => entry.kind === 'phrase'));

// Built-in seed revision adds the new phrase memberships without losing user state.
const minimalBase = canonicalizeBackup({
  ...seed,
  memberships: seed.memberships.filter((item) => !computerPhrases.some((entry) => entry.id === item.entryId)),
  studyStamps: [createStudyStamp({ entryId: computerWords[0].id, reviewDateKey: '2026-08-02', reviewedAt: timestamp })],
  settings: { ...seed.settings, builtInSeedRevision: 2 },
});
const mergedSeed = mergeBuiltInDomainBackup(minimalBase, seed);
assert.equal(mergedSeed.settings.builtInSeedRevision, 3);
assert.equal(mergedSeed.studyStamps.length, 1);
assert.equal(mergedSeed.memberships.filter((item) => computerPhrases.some((entry) => entry.id === item.entryId) && visibleComputerCollections.some((collection) => collection.id === item.collectionId)).length, 577);

// VIX JSON ordinary collections can carry both words and phrases, while personal study state stays out.
const aiCollection = visibleComputerCollections.find((item) => item.name === '人工智能');
const vix = createVixPackage(stateful, { scope: 'collection', collectionId: awlId });
assert.equal(vix.format, VIX_FORMAT);
assert.equal(vix.version, VIX_VERSION);
assert.equal(Object.hasOwn(vix, 'studyStamps'), false);
assert.equal(Object.hasOwn(vix.data, 'studyStamps'), false);
const normalized = normalizeVixPackage(vix);
assert.equal(normalized.target.scope, 'collection');

const aiPackage = createVixPackage(seed, { scope: 'collection', collectionId: aiCollection.id });
assert.ok(aiPackage.data.entries.some((item) => item.text.includes(' ')), '普通表内容包必须导出短语');
assert.ok(aiPackage.data.memberships.some((item) => aiPackage.data.entries.find((entry) => entry.key === item.entryKey)?.text.includes(' ')), '普通表内容包必须导出短语 Membership');
aiPackage.mode = 'merge';
const plan = planVixImport(seed, aiPackage, {
  scope: 'collection', domainId: computerDomainId, collectionId: aiCollection.id, mode: 'merge', targetMode: 'current',
}, 'current');
assert.equal(plan.summary.removedDomains, 0);
assert.equal(plan.summary.removedWords, 0);
assert.equal(plan.summary.removedPhrases, 0);
assert.equal(validateBackup(plan.nextBackup), true);

// Dirty VIX bare references that match multiple concrete cross-domain Entries are skipped and reported.
const dirtyBareReferencePackage = {
  format: VIX_FORMAT,
  version: VIX_VERSION,
  target: { scope: 'global' },
  mode: 'merge',
  data: {
    domains: [
      { key: 'dirty_domain_a', name: 'Dirty A', order: 20 },
      { key: 'dirty_domain_b', name: 'Dirty B', order: 21 },
    ],
    collections: [
      { key: 'dirty_collection_a', domainKey: 'dirty_domain_a', name: 'Dirty List A', kind: 'normal', order: 2 },
      { key: 'dirty_collection_b', domainKey: 'dirty_domain_b', name: 'Dirty List B', kind: 'normal', order: 2 },
    ],
    entries: [
      { key: 'entry:dirty_domain_a:access', domainKey: 'dirty_domain_a', text: 'access' },
      { key: 'entry:dirty_domain_b:access', domainKey: 'dirty_domain_b', text: 'access' },
    ],
    memberships: [
      { entryKey: 'access', collectionKey: 'dirty_collection_a' },
      { entryKey: 'entry:dirty_domain_b:access', collectionKey: 'dirty_collection_b' },
    ],
  },
};
const dirtyPlan = planVixImport(seed, dirtyBareReferencePackage, { targetMode: 'file' }, 'current');
assert.equal(dirtyPlan.summary.skippedMemberships, 1);
assert.equal(dirtyPlan.membershipIssues.length, 1);
assert.equal(dirtyPlan.membershipIssues[0].type, 'ambiguous-bare-entry-key');
const dirtyDomainA = dirtyPlan.nextBackup.domains.find((domain) => domain.name === 'Dirty A');
const dirtyDomainB = dirtyPlan.nextBackup.domains.find((domain) => domain.name === 'Dirty B');
const dirtyAccessA = dirtyPlan.nextBackup.entries.find((entry) => entry.domainId === dirtyDomainA.id && entry.normalizedText === 'access');
const dirtyAccessB = dirtyPlan.nextBackup.entries.find((entry) => entry.domainId === dirtyDomainB.id && entry.normalizedText === 'access');
const dirtyListA = dirtyPlan.nextBackup.collections.find((collection) => collection.name === 'Dirty List A');
const dirtyListB = dirtyPlan.nextBackup.collections.find((collection) => collection.name === 'Dirty List B');
assert.equal(dirtyPlan.nextBackup.memberships.some((membership) => membership.entryId === dirtyAccessA.id && membership.collectionId === dirtyListA.id), false);
assert.equal(dirtyPlan.nextBackup.memberships.some((membership) => membership.entryId === dirtyAccessB.id && membership.collectionId === dirtyListB.id), true);
assert.equal(validateBackup(dirtyPlan.nextBackup), true);


// Replacing a system phrase collection must remove stale normal memberships and personal study references.
const computerPhraseCollectionId = systemPhraseCollectionId(computerDomainId);
const phrasePackage = createVixPackage(seed, { scope: 'collection', collectionId: computerPhraseCollectionId });
const retainedPhrase = phrasePackage.data.entries[0];
phrasePackage.data.entries = [retainedPhrase];
phrasePackage.mode = 'replace';
const removedPhrase = computerPhrases.find((entry) => entry.normalizedText !== normalizeEnglish(retainedPhrase.text));
const seedWithRemovedPhraseStamp = canonicalizeBackup({
  ...seed,
  studyStamps: [createStudyStamp({ entryId: removedPhrase.id, reviewDateKey: '2026-08-02', reviewedAt: timestamp })],
});
const phraseReplacePlan = planVixImport(seedWithRemovedPhraseStamp, phrasePackage, {
  scope: 'collection', domainId: computerDomainId, collectionId: computerPhraseCollectionId, mode: 'replace', targetMode: 'current',
}, 'current');
const phraseReplaceIds = new Set(phraseReplacePlan.nextBackup.entries.map((entry) => entry.id));
assert.equal(phraseReplacePlan.nextBackup.entries.filter((entry) => entry.domainId === computerDomainId && entry.kind === 'phrase').length, 1);
assert.ok(phraseReplacePlan.nextBackup.memberships.every((membership) => phraseReplaceIds.has(membership.entryId)), '系统短语替换不得留下孤儿 Membership');
assert.ok(phraseReplacePlan.nextBackup.studyStamps.every((stamp) => stamp.entryId !== removedPhrase.id), '系统短语替换不得留下孤儿学习日期');
assert.equal(validateBackup(phraseReplacePlan.nextBackup), true);

// Seed relation targets shown by the UI must actually be visible in at least one ordinary collection.
const accessWord = seed.entries.find((entry) => entry.domainId === computerDomainId && entry.kind === 'word' && entry.normalizedText === 'access');
const accessRelations = relatedPhrases(seed, accessWord.id);
assert.ok(accessRelations.length >= 5);
for (const related of accessRelations) {
  const visibleTarget = seed.memberships.some((membership) => membership.entryId === related.id
    && visibleComputerCollections.some((collection) => collection.id === membership.collectionId)
    && seedProjection.get(membership.collectionId)?.some((entry) => entry.id === related.id));
  assert.ok(visibleTarget, `关联短语缺少实际可见普通表目标：${related.text}`);
}

assert.throws(() => canonicalizeBackup({ ...seed, entries: [...seed.entries, { ...seed.entries[0], id: safeId('duplicate', 'x') }] }), /重复/);
console.log('run-tests: OK');
