import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPhraseTokens, buildProjection, canonicalizeBackup, createCollection, createDomain,
  createEntry, createMembership, isPhraseText, migrateLegacyBackup, normalizeDisplayText,
  normalizeEnglish, normalizeGlossHant, parseLegacySourceLine, phraseComponents,
  relatedPhrases, safeId, searchBackup, systemPhraseCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, tokenizeEnglish, validateBackup,
} from '../js/v3-model.js';
import { parseCsv, parseImportContent, parseJsonContent, parseTextList } from '../js/v3-import.js';
import { mergeBuiltInDomainBackup } from '../js/v3-db.js';
import { createAiCheckBatches, parseRetryAfter } from '../js/v3-ai.js';
import { createVixPackage, normalizeVixPackage, planVixImport, VIX_FORMAT, VIX_VERSION } from '../js/v3-exchange.js';

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
assert.equal(normalizeGlossHant('访问控制'), '訪問控制');
assert.equal(normalizeGlossHant('准确率指标'), '準確率指標');
assert.equal(normalizeGlossHant('软件供应链'), '軟件供應鏈');
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
const domainTotalProjection = projection.get(systemDomainWordsCollectionId(backup.domains[0].id));
assert.equal(domainTotalProjection.length, 2);
assert.ok(domainTotalProjection.every((item) => item.kind === 'word'));
const globalProjection = projection.get(SYSTEM_GLOBAL_WORDS_ID);
assert.equal(globalProjection.length, 2);
const globalPhraseProjection = projection.get(SYSTEM_GLOBAL_PHRASES_ID);
assert.equal(globalPhraseProjection.length, 1);
assert.equal(globalPhraseProjection[0].id, phrase.id);
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
const crossProjection = buildProjection(crossDomain);
assert.equal(crossProjection.get(SYSTEM_GLOBAL_WORDS_ID).filter((item) => item.normalizedText === 'access').length, 1, '全局总表必须全局去重');
assert.equal(crossProjection.get(SYSTEM_GLOBAL_PHRASES_ID).length, 1, '全局短语表必须全局去重');
assert.equal(crossProjection.get(systemDomainWordsCollectionId(secondDomain.id)).filter((item) => item.normalizedText === 'access').length, 1, '词域总表必须域内去重');
const virtualContextBackup = canonicalizeBackup({
  ...crossDomain,
  pins: [
    { id: safeId('pin', access.id), entryId: access.id, domainId: access.domainId, contextCollectionId: SYSTEM_GLOBAL_WORDS_ID, order: 0, createdAt: '2026-08-01T00:00:00.000Z' },
    { id: safeId('pin', phrase.id), entryId: phrase.id, domainId: phrase.domainId, contextCollectionId: SYSTEM_GLOBAL_PHRASES_ID, order: 0, createdAt: '2026-08-01T00:00:00.000Z' },
  ],
  settings: { ...crossDomain.settings, lastPositions: {
    ...crossDomain.settings.lastPositions,
    [`lastPosition:global:${SYSTEM_GLOBAL_WORDS_ID}`]: access.id,
    [`lastPosition:global:${SYSTEM_GLOBAL_PHRASES_ID}`]: phrase.id,
  } },
});
assert.equal(validateBackup(virtualContextBackup), true, '虚拟总表必须支持 PIN 与独立上次位置');
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

// Verify the complete 3.0.7 seed contract: retained General English plus classified computer terms and VIX exchange.
const seedPath = path.join(root, 'data', 'seed.json');
if (fs.existsSync(seedPath)) {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const migrated = migrateLegacyBackup(seed, { timestamp: '2026-08-01T00:00:00.000Z' });
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.domains.length, 2);
  assert.equal(migrated.entries.length, 6126);
  assert.equal(migrated.entries.filter((item) => item.kind === 'word').length, 5539);
  assert.equal(migrated.entries.filter((item) => item.kind === 'phrase').length, 587);
  assert.equal(migrated.memberships.length, 7495);
  assert.equal(migrated.phraseTokens.length, 1312);
  assert.equal(migrated.settings.builtInSeedRevision, 2);
  assert.equal(migrated.settings.contentSources.length, 14);
  const computerDomain = migrated.domains.find((item) => item.id === 'domain_computer_terms');
  assert.ok(computerDomain?.glossEnabled);
  const computerEntries = migrated.entries.filter((item) => item.domainId === computerDomain.id);
  assert.equal(computerEntries.length, 1121);
  assert.equal(computerEntries.filter((item) => item.kind === 'word').length, 544);
  assert.equal(computerEntries.filter((item) => item.kind === 'phrase').length, 577);
  assert.ok(computerEntries.every((item) => item.glossHant && item.glossSource));
  const hiddenSource = migrated.collections.find((item) => item.domainId === computerDomain.id && item.hidden);
  assert.ok(hiddenSource && hiddenSource.type === 'normal');
  const computerCollections = migrated.collections
    .filter((item) => item.domainId === computerDomain.id && item.type === 'normal' && !item.hidden)
    .sort((a, b) => a.order - b.order);
  assert.deepEqual(computerCollections.map((item) => item.name), ['计算机基础与系统', '软件开发与数据', '网络、云与安全', '人工智能']);
  const expectedComputerCounts = new Map([
    ['计算机基础与系统', 214], ['软件开发与数据', 197], ['网络、云与安全', 114], ['人工智能', 19],
  ]);
  const visibleComputerIds = new Set(computerCollections.map((item) => item.id));
  const membershipCountByWord = new Map();
  for (const membership of migrated.memberships.filter((item) => visibleComputerIds.has(item.collectionId))) {
    membershipCountByWord.set(membership.entryId, (membershipCountByWord.get(membership.entryId) || 0) + 1);
  }
  for (const entry of computerEntries.filter((item) => item.kind === 'word')) assert.equal(membershipCountByWord.get(entry.id), 1, `${entry.text} 必须只进入一个大领域普通词表`);
  const fullProjection = buildProjection(migrated);
  assert.equal(fullProjection.get(systemDomainWordsCollectionId('domain_general_english')).length, 4995);
  assert.equal(fullProjection.get(systemPhraseCollectionId('domain_general_english')).length, 10);
  assert.equal(fullProjection.get(systemDomainWordsCollectionId(computerDomain.id)).length, 544);
  assert.equal(fullProjection.get(systemPhraseCollectionId(computerDomain.id)).length, 577);
  assert.equal(fullProjection.get(hiddenSource.id).length, 0, '隐藏来源不得抢占用户可见投影');
  for (const collection of computerCollections) assert.equal(fullProjection.get(collection.id).length, expectedComputerCounts.get(collection.name));
  assert.equal(computerCollections.reduce((sum, item) => sum + fullProjection.get(item.id).length, 0), 544);
  assert.equal(fullProjection.get(SYSTEM_GLOBAL_WORDS_ID).length, 5322);
  assert.equal(fullProjection.get(SYSTEM_GLOBAL_PHRASES_ID).length, 587);
  for (const collection of migrated.collections) {
    const visible = fullProjection.get(collection.id) || [];
    if (collection.type === 'normal') assert.ok(visible.every((entry) => entry.kind === 'word'));
    else assert.ok(visible.every((entry) => entry.kind === 'phrase'));
  }
  assert.ok(migrated.memberships.every((item) => !Object.hasOwn(item, 'sourceText')));

  const legacyOnly = migrateLegacyBackup(legacy, { timestamp: '2026-08-01T00:00:00.000Z' });
  const mergedBuiltIn = mergeBuiltInDomainBackup(legacyOnly, migrated);
  assert.equal(mergedBuiltIn.domains.length, 2, '2.x 直接升级必须同时获得内置计算机术语域');
  assert.equal(mergedBuiltIn.entries.length, legacyOnly.entries.length + 1121);
  assert.equal(mergeBuiltInDomainBackup(mergedBuiltIn, migrated).memberships.length, mergedBuiltIn.memberships.length, '内置域合并必须幂等');

  const pre306CollectionIds = new Set(migrated.collections.filter((item) => !visibleComputerIds.has(item.id)).map((item) => item.id));
  const pre306 = canonicalizeBackup({
    ...migrated,
    appVersion: '3.0.5',
    collections: migrated.collections.filter((item) => pre306CollectionIds.has(item.id)),
    memberships: migrated.memberships.filter((item) => pre306CollectionIds.has(item.collectionId)),
    settings: { ...migrated.settings, builtInSeedRevision: 1 },
  });
  const upgraded306 = mergeBuiltInDomainBackup(pre306, migrated);
  assert.equal(upgraded306.settings.builtInSeedRevision, 2);
  assert.equal(upgraded306.collections.filter((item) => item.domainId === computerDomain.id && item.type === 'normal' && !item.hidden).length, 4);
  assert.equal(upgraded306.memberships.length, 7495);

  const globalPackage = createVixPackage(migrated, { scope: 'global' });
  assert.equal(globalPackage.format, VIX_FORMAT);
  assert.equal(globalPackage.version, VIX_VERSION);
  assert.equal(globalPackage.target.scope, 'global');
  assert.equal(globalPackage.data.domains.length, 2);
  assert.ok(!Object.hasOwn(globalPackage, 'pins'));
  assert.equal(normalizeVixPackage(globalPackage).data.entries.length, migrated.entries.length);
  assert.equal(parseJsonContent(JSON.stringify(globalPackage)).kind, 'content-package');

  const aiCollection = computerCollections.find((item) => item.name === '人工智能');
  const aiPackage = createVixPackage(migrated, { scope: 'collection', collectionId: aiCollection.id });
  assert.equal(aiPackage.target.collectionKey, aiCollection.id);
  assert.equal(aiPackage.data.entries.length, 19);
  const noChangePlan = planVixImport(migrated, aiPackage, { scope: 'collection', domainId: computerDomain.id, collectionId: aiCollection.id, mode: 'merge', targetMode: 'current' });
  assert.equal(noChangePlan.summary.addedWords, 0);
  assert.equal(noChangePlan.summary.removedWords, 0);

  const incrementPackage = {
    format: VIX_FORMAT, version: VIX_VERSION, mode: 'merge',
    target: { scope: 'collection', domainKey: computerDomain.id, collectionKey: aiCollection.id },
    data: {
      domains: [{ key: computerDomain.id, name: computerDomain.name, glossEnabled: true }],
      collections: [{ key: aiCollection.id, domainKey: computerDomain.id, name: aiCollection.name, kind: 'normal', order: aiCollection.order }],
      entries: [
        { key: 'entry-agentic-workflow', domainKey: computerDomain.id, text: 'agentic', glossHans: '智能体式', sourceRefs: ['NIST-AI'] },
        { key: 'entry-agentic-workflow-phrase', domainKey: computerDomain.id, text: 'agentic workflow', glossHans: '智能体工作流', sourceRefs: ['NIST-AI'] },
      ],
      memberships: [{ entryKey: 'entry-agentic-workflow', collectionKey: aiCollection.id, sourceLabel: 'NIST-AI' }],
    },
    sources: [],
  };
  const incrementPlan = planVixImport(migrated, incrementPackage, { scope: 'collection', domainId: computerDomain.id, collectionId: aiCollection.id, mode: 'merge', targetMode: 'current' }, 'import');
  assert.equal(incrementPlan.summary.addedWords, 1);
  assert.equal(incrementPlan.summary.addedPhrases, 1);
  const addedWord = incrementPlan.nextBackup.entries.find((item) => item.domainId === computerDomain.id && item.normalizedText === 'agentic');
  const addedPhrase = incrementPlan.nextBackup.entries.find((item) => item.domainId === computerDomain.id && item.normalizedText === 'agentic workflow');
  assert.ok(addedWord && addedPhrase);
  assert.ok(incrementPlan.nextBackup.memberships.some((item) => item.entryId === addedWord.id && item.collectionId === aiCollection.id));
  assert.ok(!incrementPlan.nextBackup.memberships.some((item) => item.entryId === addedPhrase.id), '短语不得污染普通词表 Membership');
  assert.equal(validateBackup(incrementPlan.nextBackup), true);

  const exampleDirectory = path.join(root, 'data', 'examples');
  for (const filename of fs.readdirSync(exampleDirectory).filter((name) => name.endsWith('.json'))) {
    const example = JSON.parse(fs.readFileSync(path.join(exampleDirectory, filename), 'utf8'));
    assert.equal(normalizeVixPackage(example).format, VIX_FORMAT, `${filename} 必须符合 VIX 基础格式`);
  }
  const globalReplaceExample = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'vix-global-replace-sample.json'), 'utf8'));
  const globalReplacePlan = planVixImport(migrated, globalReplaceExample, { scope: 'global', mode: 'replace', targetMode: 'file' }, 'import');
  assert.deepEqual(globalReplacePlan.nextBackup.domains.map((item) => item.id), ['domain_demo']);
  assert.equal(globalReplacePlan.nextBackup.entries.length, 2, '全局替换不得保留同 ID 词域中的旧内容');
  assert.equal(globalReplacePlan.nextBackup.memberships.length, 1);

  const newCollectionExample = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'vix-new-collection.json'), 'utf8'));
  const newCollectionPlan = planVixImport(migrated, newCollectionExample, {
    scope: 'collection', domainId: computerDomain.id, collectionId: '__new_collection__', mode: 'replace', targetMode: 'current',
  }, 'import');
  assert.ok(newCollectionPlan.nextBackup.collections.some((item) => item.id === 'collection_computer_research'));
  assert.equal(buildProjection(newCollectionPlan.nextBackup).get('collection_computer_research').length, 2);
}


console.log('run-tests: OK');
