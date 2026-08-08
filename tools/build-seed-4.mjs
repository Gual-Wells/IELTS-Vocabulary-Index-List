import fs from 'node:fs/promises';
import {
  buildRelationComponentsForEntries,
  canonicalizeBackup,
  createCollection,
  createEntry,
  createMembership,
  safeId,
  toTraditional,
} from '../js/v3-model.js';

const path = new URL('../data/seed.json', import.meta.url);
const raw = JSON.parse(await fs.readFile(path, 'utf8'));
const timestamp = '2026-08-08T06:30:00.000Z';
const domainId = 'domain_general_collocations';
const retiredCollectionIds = new Set(['collection_domain_general_english_cat_avl_1x4urox1g6jmbx']);
raw.collections = raw.collections.filter((c) => !retiredCollectionIds.has(c.id));
raw.memberships = raw.memberships.filter((m) => !retiredCollectionIds.has(m.collectionId));

const categories = [
  { id: 'collection_general_collocations_sentence_patterns', name: '句型', label: 'sentence-pattern', order: 0 },
  { id: 'collection_general_collocations_grammar_frameworks', name: '语法框架', label: 'grammar-framework', order: 1 },
  { id: 'collection_general_collocations_template_expressions', name: '模板表达', label: 'template-expression', order: 2 },
  { id: 'collection_general_collocations_discourse_markers', name: '语篇标记', label: 'discourse-marker', order: 3 },
];

const items = [
  ['sentence-pattern', 'It is [adjective] to [verb] ...', '用 It is + 形容词 + to do 表达对做某事的评价。'],
  ['sentence-pattern', 'It is [adjective] that ...', '用 It is + 形容词 + that 从句表达判断或评价。'],
  ['sentence-pattern', 'There is no doubt that ...', '表示“毫无疑问……”。'],
  ['sentence-pattern', 'There is no need to ...', '表示“没有必要……”。'],
  ['sentence-pattern', 'There is no point in [doing] ...', '表示“做……没有意义”。'],
  ['sentence-pattern', 'It takes [time] to ...', '表示完成某事需要一定时间。'],
  ['sentence-pattern', 'It is time to ...', '表示“该做……了”。'],
  ['sentence-pattern', 'It is worth [doing] ...', '表示“……值得做”。'],
  ['sentence-pattern', 'What matters is ...', '强调真正重要的内容。'],
  ['sentence-pattern', 'The fact is that ...', '引出需要强调的事实。'],
  ['sentence-pattern', 'The reason is that ...', '引出原因说明。'],
  ['sentence-pattern', 'One of the most [adjective] ...', '表达“最……的……之一”。'],
  ['grammar-framework', 'the more ..., the more ...', '表示两个变化之间“越……越……”的对应关系。'],
  ['grammar-framework', 'not only ... but also ...', '连接两个并列成分，表示“不仅……而且……”。'],
  ['grammar-framework', 'either ... or ...', '连接两个选择，表示“要么……要么……”。'],
  ['grammar-framework', 'neither ... nor ...', '连接两个否定并列项，表示“既不……也不……”。'],
  ['grammar-framework', 'both ... and ...', '连接两个并列项，表示“两者都……”。'],
  ['grammar-framework', 'whether ... or ...', '表达两个可能性或选择。'],
  ['grammar-framework', 'so [adjective] that ...', '表示程度达到某种结果，“如此……以至于……”。'],
  ['grammar-framework', 'such [noun] that ...', '用 such 引出程度并连接结果从句。'],
  ['grammar-framework', 'too [adjective] to ...', '表示“太……而不能/不适合……”。'],
  ['grammar-framework', '[adjective] enough to ...', '表示“足够……以至于可以……”。'],
  ['grammar-framework', 'as [adjective] as ...', '表示同等程度比较。'],
  ['grammar-framework', 'rather than ...', '表示取舍或对比，“而不是……”。'],
  ['template-expression', 'From my perspective, ...', '用于引出个人观点。'],
  ['template-expression', 'In my view, ...', '用于简洁地表达个人观点。'],
  ['template-expression', 'It should be noted that ...', '用于提醒读者注意一个重要事实。'],
  ['template-expression', 'It is important to note that ...', '用于突出一个需要注意的要点。'],
  ['template-expression', 'A key point is that ...', '用于提出关键要点。'],
  ['template-expression', 'The main reason is that ...', '用于引出主要原因。'],
  ['template-expression', 'This means that ...', '用于解释前文所意味着的结果。'],
  ['template-expression', 'This suggests that ...', '用于提出由证据支持的推断。'],
  ['template-expression', 'This is because ...', '用于直接解释原因。'],
  ['template-expression', 'For this reason, ...', '用于承接原因并引出结果。'],
  ['template-expression', 'Compared with ..., ...', '用于建立与另一对象的比较。'],
  ['template-expression', 'In terms of ..., ...', '用于限定讨论的方面或维度。'],
  ['discourse-marker', 'for example', '用于引出例子。'],
  ['discourse-marker', 'for instance', '用于引出例子。'],
  ['discourse-marker', 'in other words', '用于换一种说法解释前文。'],
  ['discourse-marker', 'in addition', '用于补充并列信息。'],
  ['discourse-marker', 'moreover', '用于进一步补充较强的论据或信息。'],
  ['discourse-marker', 'however', '用于引出转折或限制。'],
  ['discourse-marker', 'on the other hand', '用于引出另一面或对照观点。'],
  ['discourse-marker', 'in contrast', '用于明确呈现对比。'],
  ['discourse-marker', 'as a result', '用于引出结果。'],
  ['discourse-marker', 'therefore', '用于引出逻辑结果或结论。'],
  ['discourse-marker', 'consequently', '用于引出由前述原因产生的结果。'],
  ['discourse-marker', 'in conclusion', '用于引出总结性结论。'],
  ['discourse-marker', 'overall', '用于概括总体情况。'],
  ['discourse-marker', 'meanwhile', '用于引出同时发生或并行存在的情况。'],
];

raw.collections = raw.collections.filter((c) => c.domainId !== domainId);
for (const c of categories) raw.collections.push(createCollection({ ...c, domainId, type: 'normal', hidden: false, timestamp }));
raw.entries = raw.entries.filter((e) => e.domainId !== domainId);
raw.memberships = raw.memberships.filter((m) => !String(m.collectionId).startsWith('collection_general_collocations_'));

const collectionByType = new Map(categories.map((c) => [c.label, c.id]));
items.forEach(([type, text, glossHans], index) => {
  const entry = createEntry({
    id: safeId('entry', `${domainId}:${text}`),
    domainId,
    text,
    kind: 'content',
    contentType: type,
    glossHans,
    glossHant: toTraditional(glossHans),
    glossSource: 'VIX-4-CURATED',
    timestamp,
  });
  raw.entries.push(entry);
  raw.memberships.push(createMembership({
    entryId: entry.id,
    collectionId: collectionByType.get(type),
    sourceLabel: 'VIX 4.0 curated',
    sourceOrder: index,
    timestamp,
  }));
});
raw.relationComponents = buildRelationComponentsForEntries(raw.entries, { timestamp });
raw.schemaVersion = 6;
raw.appVersion = '4.0.0';
raw.exportedAt = timestamp;
raw.settings = {
  ...raw.settings,
  migrationComplete: true,
  migrationSource: '4.0-generation',
  migrationNoticePending: false,
  builtInSeedRevision: 4,
  closeLowLevelRelations: true,
  lastPositions: {},
  viewModes: {},
  calendarMonths: {},
};
raw.settings.contentSources = [
  ...(raw.settings.contentSources || []).filter((s) => s.key !== 'VIX-4-CURATED'),
  { key: 'VIX-4-CURATED', title: 'Vocabulary Index 4.0 curated grammar and discourse starter set', publisher: 'Vocabulary Index', url: '', retrievedAt: '2026-08-08' },
];
const out = canonicalizeBackup(raw);
out.settings.contentSources = raw.settings.contentSources;
await fs.writeFile(path, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ domains: out.domains.length, collections: out.collections.length, entries: out.entries.length, memberships: out.memberships.length, relationComponents: out.relationComponents.length }, null, 2));
