import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCHEMA_VERSION, buildProjection, buildRelationComponentsForEntries, canonicalizeBackup,
  createCollection, createDomain, createEntry, createMembership, createStudyStamp,
  normalizeDisplayText, normalizeEnglish, normalizeGlossHant, relatedEntries, relationEdgeSuppressed, searchBackup,
  SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID,
  systemDomainWordsCollectionId, systemDomainContentCollectionId, systemPhraseCollectionId,
  uniqueProjectionCount, validateBackup,
} from '../js/v3-model.js';
import { parseCsv, parseJsonContent, parseTextList } from '../js/v3-import.js';
import { mergeBuiltInDomainBackup, DB_VERSION, BUILTIN_SEED_REVISION } from '../js/v3-db.js';
import { createAiCheckBatches, parseRetryAfter } from '../js/v3-ai.js';
import { createVixPackage, normalizeVixPackage, planVixImport, VIX_FORMAT, VIX_VERSION } from '../js/v3-exchange.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timestamp = '2026-08-08T00:00:00.000Z';

assert.equal(SCHEMA_VERSION, 6);
assert.equal(DB_VERSION, 5);
assert.equal(BUILTIN_SEED_REVISION, 7);
assert.equal(VIX_VERSION, 2);
assert.equal(normalizeDisplayText('  Can’t   wait  '), "Can't wait");
assert.equal(normalizeEnglish('well‑being'), 'well-being');
assert.equal(normalizeGlossHant('开发后台线程池'), '開發後台線程池');

const structured = createDomain({ id: 'domain_struct', name: '结构域', contentMode: 'structured', timestamp });
const structured2 = createDomain({ id: 'domain_struct_2', name: '外部结构域', contentMode: 'structured', order: 1, timestamp });
const nonStructured = createDomain({ id: 'domain_content', name: '通用英语搭配', contentMode: 'nonStructured', order: 2, timestamp });
const cPrimary = createCollection({ id: 'collection_primary', domainId: structured.id, name: 'A1', order: 0, timestamp });
const cSecondary = createCollection({ id: 'collection_secondary', domainId: structured.id, name: 'COCA Top 10000', order: 10, timestamp });
const cPhrases = createCollection({ domainId: structured.id, name: '短语总表', type: 'system-phrases', order: 99, timestamp });
const cOther = createCollection({ id: 'collection_other', domainId: structured2.id, name: '外部表', order: 0, timestamp });
const cOtherPhrases = createCollection({ domainId: structured2.id, name: '短语总表', type: 'system-phrases', order: 99, timestamp });
const cContentA = createCollection({ id: 'collection_content_a', domainId: nonStructured.id, name: '句型', order: 0, timestamp });
const cContentB = createCollection({ id: 'collection_content_b', domainId: nonStructured.id, name: '模板表达', order: 1, timestamp });

const access = createEntry({ domainId: structured.id, text: 'access', kind: 'word', partsOfSpeech: ['n.', 'v.'], timestamp });
const data = createEntry({ domainId: structured.id, text: 'data', kind: 'word', timestamp });
const phrase = createEntry({ domainId: structured.id, text: 'access data', kind: 'phrase', timestamp });
const externalAccess = createEntry({ domainId: structured2.id, text: 'access', kind: 'word', timestamp });
const content = createEntry({ domainId: nonStructured.id, text: 'access data pattern', kind: 'content', contentType: 'sentence-pattern', timestamp });
const entries = [access, data, phrase, externalAccess, content];

let fixture = canonicalizeBackup({
  schemaVersion: 6, appVersion: '4.0.0', exportedAt: timestamp,
  domains: [structured, structured2, nonStructured],
  collections: [cPrimary, cSecondary, cPhrases, cOther, cOtherPhrases, cContentA, cContentB],
  entries,
  memberships: [
    createMembership({ entryId: access.id, collectionId: cPrimary.id, timestamp }),
    createMembership({ entryId: access.id, collectionId: cSecondary.id, timestamp }),
    createMembership({ entryId: data.id, collectionId: cPrimary.id, timestamp }),
    createMembership({ entryId: phrase.id, collectionId: cPrimary.id, timestamp }),
    createMembership({ entryId: phrase.id, collectionId: cSecondary.id, timestamp }),
    createMembership({ entryId: externalAccess.id, collectionId: cOther.id, timestamp }),
    createMembership({ entryId: content.id, collectionId: cContentA.id, timestamp }),
    createMembership({ entryId: content.id, collectionId: cContentB.id, timestamp }),
  ],
  relationComponents: buildRelationComponentsForEntries(entries),
  pins: [], annotations: [], studyStamps: [],
  settings: { closeLowLevelRelations: true, viewModes: {}, calendarMonths: {}, lastPositions: {} },
});
assert.equal(validateBackup(fixture), true);
assert.equal(fixture.entries.find((item) => item.id === access.id).partsOfSpeech.length, 2);
assert.equal(fixture.entries.find((item) => item.id === content.id).contentType, 'sentence-pattern');

// Priority ownership is one rule for word / phrase / content. Memberships remain factual, visible projection is unique.
const projection = buildProjection(fixture);
assert.ok(projection.get(cPrimary.id).some((item) => item.id === access.id));
assert.ok(!projection.get(cSecondary.id).some((item) => item.id === access.id));
assert.ok(projection.get(cPrimary.id).some((item) => item.id === phrase.id));
assert.ok(!projection.get(cSecondary.id).some((item) => item.id === phrase.id));
assert.ok(projection.get(cContentA.id).some((item) => item.id === content.id));
assert.ok(!projection.get(cContentB.id).some((item) => item.id === content.id));
assert.ok(projection.get(systemDomainWordsCollectionId(structured.id)).every((item) => item.kind === 'word'));
assert.ok(projection.get(systemPhraseCollectionId(structured.id)).every((item) => item.kind === 'phrase'));
assert.deepEqual(projection.get(systemDomainContentCollectionId(nonStructured.id)).map((item) => item.id), [content.id]);
assert.equal(projection.get(SYSTEM_GLOBAL_WORDS_ID).length, 3);
assert.equal(projection.get(SYSTEM_GLOBAL_PHRASES_ID).length, 1);
assert.equal(projection.get(SYSTEM_GLOBAL_CONTENT_ID).length, 1);
assert.equal(uniqueProjectionCount(projection.get(SYSTEM_GLOBAL_WORDS_ID)), 2, '跨域同形保留具体行但唯一计数按规范文本');

// Relation matching is exact structural and globally symmetric, including non-structured content and cross-domain homographs.
const accessRelated = relatedEntries(fixture, access.id).map((item) => item.id);
const externalRelated = relatedEntries(fixture, externalAccess.id).map((item) => item.id);
const phraseRelated = relatedEntries(fixture, phrase.id).map((item) => item.id);
const contentRelated = relatedEntries(fixture, content.id).map((item) => item.id);
assert.ok(accessRelated.includes(phrase.id));
assert.ok(externalRelated.includes(phrase.id), '跨域同形词必须同等接收精确关系');
assert.ok(phraseRelated.includes(access.id) && phraseRelated.includes(externalAccess.id));
assert.ok(contentRelated.includes(phrase.id) && phraseRelated.includes(content.id), '非结构内容参与完整双向关系');
for (const left of fixture.entries) {
  for (const right of relatedEntries(fixture, left.id)) {
    assert.ok(relatedEntries(fixture, right.id).some((candidate) => candidate.id === left.id), `${left.text} ↔ ${right.text} 必须对称`);
  }
}
assert.ok(!relatedEntries(fixture, access.id).some((item) => item.normalizedText === 'accessible'), '关系不得使用模糊匹配');
const relationDomains = new Map(fixture.domains.map((domain) => [domain.id, domain]));
assert.equal(relationEdgeSuppressed(access, phrase, { domainById: relationDomains, lowLevelLexemes: new Set(['access']), closeLowLevelRelations: true }), true, '低级词开关只过滤有效关系');
assert.equal(relationEdgeSuppressed(access, phrase, { domainById: relationDomains, lowLevelLexemes: new Set(['access']), closeLowLevelRelations: false }), false, '关闭过滤后必须立即恢复原始边');
const excludedDomains = new Map([...relationDomains, [structured2.id, { ...structured2, relationExcluded: true }]]);
assert.equal(relationEdgeSuppressed(externalAccess, phrase, { domainById: excludedDomains, lowLevelLexemes: new Set(), closeLowLevelRelations: false }), true, 'Domain 不参与关联必须是可逆投影过滤');

// Search remains fuzzy and independent from relation rules.
assert.ok(searchBackup(fixture, 'acces').some((item) => item.id === access.id));
assert.ok(searchBackup(fixture, 'patern').some((item) => item.id === content.id));

// Content-bound study state is concrete Entry state.
const stamp = createStudyStamp({ entryId: content.id, reviewDateKey: '2026-08-08', reviewedAt: timestamp });
fixture = canonicalizeBackup({ ...fixture, studyStamps: [stamp] });
assert.deepEqual(fixture.studyStamps.map((item) => item.key), [`entry:${content.id}`]);

// Structured / nonStructured content constraints are hard model invariants.
assert.throws(() => canonicalizeBackup({
  ...fixture,
  entries: fixture.entries.map((item) => item.id === access.id ? { ...item, kind: 'content', contentType: 'bad' } : item),
}), /结构化词域不能包含 content/);
assert.throws(() => canonicalizeBackup({
  ...fixture,
  entries: fixture.entries.map((item) => item.id === content.id ? { ...item, kind: 'word', contentType: '' } : item),
}), /非结构词域只能包含 content|多词文本不能标记为普通词/);

// Schema generation is deliberately discontinuous.
assert.throws(() => validateBackup({ ...fixture, schemaVersion: 5 }), /必须为 6/);
assert.throws(() => parseJsonContent(JSON.stringify({ ...fixture, schemaVersion: 5 })), /不兼容/);
assert.throws(() => parseJsonContent(JSON.stringify({ categories: [], entries: [] })), /旧世代|不兼容/);

// Current import formats still work for ordinary content rows.
assert.deepEqual(parseTextList('access n.\nthread pool n.').entries.map((item) => item.text), ['access', 'thread pool']);
assert.equal(parseCsv('text,sourceLabel,gloss\naccess,n.,访问').entries[0].text, 'access');

// VIX v2 is the only supported content-package protocol.
const vix = createVixPackage(fixture, { scope: 'domain', domainId: nonStructured.id });
assert.equal(vix.format, VIX_FORMAT);
assert.equal(vix.version, 2);
assert.equal(normalizeVixPackage(vix).data.domains[0].contentMode, 'nonStructured');
assert.throws(() => normalizeVixPackage({ ...vix, version: 1 }), /受支持/);
for (const file of fs.readdirSync(path.join(root, 'data/examples')).filter((name) => name.endsWith('.json'))) {
  const example = JSON.parse(fs.readFileSync(path.join(root, 'data/examples', file), 'utf8'));
  assert.equal(normalizeVixPackage(example).version, 2, `${file} 必须是可解析的 VIX v2 示例`);
}

// Full-generation replacement does not merge the old generation.
const replacement = mergeBuiltInDomainBackup(fixture, canonicalizeBackup({ ...fixture, entries: fixture.entries.filter((item) => item.id !== data.id), memberships: fixture.memberships.filter((item) => item.entryId !== data.id) }));
assert.equal(replacement.entries.some((item) => item.id === data.id), false);

assert.equal(parseRetryAfter('2'), 2000);
assert.equal(createAiCheckBatches(Array.from({ length: 130 }, (_, index) => ({ id: String(index), text: `word-${index}` }))).length >= 2, true);

const seed = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));
const contentExample = JSON.parse(fs.readFileSync(path.join(root, 'data/examples/vix-nonstructured-domain.json'), 'utf8'));
const contentPlan = planVixImport(seed, contentExample);
assert.equal(contentPlan.summary.addedContent, 1, 'nonStructured VIX 预检必须正确统计新增 content');
assert.equal(contentPlan.membershipIssues.length, 0);
assert.equal(seed.schemaVersion, 6);
assert.equal(seed.appVersion, '5.0.0-alpha.9');
assert.equal(seed.settings.builtInSeedRevision, 7);
assert.ok(seed.collections.some((item) => item.name === 'C2'));
assert.ok(seed.collections.some((item) => item.name === 'NAWL'));
assert.ok(seed.collections.some((item) => item.name === 'COCA 10000'));
assert.ok(seed.collections.some((item) => item.name === 'TEM 8'));
assert.ok(seed.settings.contentSources.some((item) => item.key === 'SEED5:cefrj-1.6' && item.sha256));
assert.equal(seed.domains.length, 3);
assert.ok(seed.domains.some((item) => item.name === '通用英语搭配' && item.contentMode === 'nonStructured'));
assert.ok(!seed.domains.some((item) => item.name === '深拓英语'));
assert.ok(seed.entries.filter((item) => item.kind === 'content').length >= 250);
assert.ok(seed.entries.filter((item) => item.domainId === 'domain_computer_terms').length >= 1400);
assert.ok(seed.settings.contentSources.some((item) => item.key === 'VIX-6-CURATED'));
assert.ok(seed.settings.contentSources.some((item) => item.key === 'VIX-7-CURATED'));
assert.equal(validateBackup(seed), true);

console.log(`run-tests: OK (${seed.entries.length} seed entries; ${seed.relationComponents.length} relation components)`);
