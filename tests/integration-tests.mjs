import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProjection, canonicalizeBackup, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID,
  SYSTEM_GLOBAL_CONTENT_ID, systemDomainWordsCollectionId, systemDomainContentCollectionId,
} from '../js/v3-model.js';
import {
  buildChatGPTPrompt, buildChatGPTShortcutUrl, buildOxfordLookupUrl, buildCollinsExternalUrl,
  CHATGPT_SHORTCUT_NAME, createEntryContext, ENTRY_CONTEXT_FORMAT, ENTRY_CONTEXT_VERSION,
} from '../js/v3-integrations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) { const key = keyFn(item); const list = map.get(key) || []; list.push(item); map.set(key, list); }
  return map;
}

function buildState(backup) {
  const projection = buildProjection(backup);
  const entryById = new Map(backup.entries.map((item) => [item.id, item]));
  const domainById = new Map(backup.domains.map((item) => [item.id, item]));
  const collectionById = new Map(backup.collections.map((item) => [item.id, item]));
  collectionById.set(SYSTEM_GLOBAL_WORDS_ID, { id: SYSTEM_GLOBAL_WORDS_ID, name: '全局词汇总表', type: 'system-global-words', virtual: true });
  collectionById.set(SYSTEM_GLOBAL_PHRASES_ID, { id: SYSTEM_GLOBAL_PHRASES_ID, name: '全局短语总表', type: 'system-global-phrases', virtual: true });
  collectionById.set(SYSTEM_GLOBAL_CONTENT_ID, { id: SYSTEM_GLOBAL_CONTENT_ID, name: '全局非结构内容', type: 'system-global-content', virtual: true });
  for (const domain of backup.domains) {
    if (domain.contentMode === 'nonStructured') collectionById.set(systemDomainContentCollectionId(domain.id), { id: systemDomainContentCollectionId(domain.id), domainId: domain.id, name: '内容总表', type: 'system-domain-content', virtual: true });
    else collectionById.set(systemDomainWordsCollectionId(domain.id), { id: systemDomainWordsCollectionId(domain.id), domainId: domain.id, name: '词汇总表', type: 'system-domain-words', virtual: true });
  }
  const entriesByNormalizedText = groupBy(backup.entries, (item) => item.normalizedText);
  const adjacency = new Map(backup.entries.map((item) => [item.id, new Set()]));
  for (const component of backup.relationComponents) {
    const source = entryById.get(component.sourceEntryId);
    if (!source) continue;
    for (const target of entriesByNormalizedText.get(component.normalizedText) || []) {
      if (target.id === source.id) continue;
      adjacency.get(source.id).add(target.id);
      adjacency.get(target.id).add(source.id);
    }
  }
  const relatedEntriesByEntry = new Map(backup.entries.map((entry) => [entry.id, [...adjacency.get(entry.id)].map((id) => entryById.get(id)).filter(Boolean)]));
  return {
    ...backup, projection, entryById, domainById, collectionById, entriesByNormalizedText,
    membershipsByEntry: groupBy(backup.memberships, (item) => item.entryId),
    visibleEntryIdsByCollection: new Map([...projection].map(([id, entries]) => [id, new Set(entries.map((item) => item.id))])),
    relatedEntriesByEntry,
  };
}

const state = buildState(seed);
assert.equal(buildOxfordLookupUrl('thread pool'), 'hk-com-oupc-oecd-lookup://x-callback-url/s?q=thread%20pool');
assert.equal(buildCollinsExternalUrl('Thread Pool'), 'https://www.collinsdictionary.com/dictionary/english/thread-pool');
assert.throws(() => buildOxfordLookupUrl('  '), /没有可查询/);

const dataEntry = seed.entries.find((item) => item.domainId === 'domain_computer_terms' && item.kind === 'word' && item.normalizedText === 'data');
assert.ok(dataEntry);
const visibleCollection = seed.collections
  .filter((item) => item.domainId === dataEntry.domainId && item.type === 'normal')
  .find((item) => state.visibleEntryIdsByCollection.get(item.id)?.has(dataEntry.id));
assert.ok(visibleCollection);
const context = createEntryContext(state, dataEntry, visibleCollection.id, { appVersion: '4.0.1' });
assert.equal(context.format, ENTRY_CONTEXT_FORMAT);
assert.equal(context.version, ENTRY_CONTEXT_VERSION);
assert.equal(context.subject.entryId, dataEntry.id);
assert.equal(context.subject.domain.name, '计算机术语');
assert.ok(context.relations.length <= 16);
assert.ok(context.relationCount >= context.relations.length);
for (const forbidden of ['pins', 'studyStamps', 'annotations', 'memberships', 'relationComponents', 'settings']) {
  assert.equal(Object.hasOwn(context, forbidden), false, `紧凑上下文不得携带 ${forbidden}`);
}
assert.ok(context.exclusions.includes('PIN'));

const prompt = buildChatGPTPrompt(context);
const shortcutUrl = buildChatGPTShortcutUrl(prompt);
const parsed = new URL(shortcutUrl);
assert.equal(parsed.protocol, 'shortcuts:');
assert.equal(parsed.hostname, 'run-shortcut');
assert.equal(parsed.searchParams.get('name'), CHATGPT_SHORTCUT_NAME);
assert.equal(parsed.searchParams.get('text'), prompt);
assert.ok(shortcutUrl.length < 9000, `代表条目 Shortcut URL 仍过长：${shortcutUrl.length}`);

let maxUrl = { length: 0, text: '' };
for (const entry of seed.entries) {
  const collection = seed.collections.filter((item) => item.domainId === entry.domainId && item.type === 'normal')
    .find((item) => state.visibleEntryIdsByCollection.get(item.id)?.has(entry.id));
  if (!collection) continue;
  const ctx = createEntryContext(state, entry, collection.id, { appVersion: '4.0.1' });
  const url = buildChatGPTShortcutUrl(buildChatGPTPrompt(ctx));
  if (url.length > maxUrl.length) maxUrl = { length: url.length, text: entry.text };
}
assert.ok(maxUrl.length < 12000, `全 Seed 最大 Shortcut URL 超出紧凑预算：${maxUrl.text} / ${maxUrl.length}`);
assert.ok(maxUrl.length < 30636 * 0.5, `紧凑上下文应显著低于 3.5.x 约 30k 风险基线：${maxUrl.length}`);

const globalAccess = state.projection.get(SYSTEM_GLOBAL_WORDS_ID).find((item) => item.normalizedText === 'access');
if (globalAccess) {
  const globalContext = createEntryContext(state, globalAccess, SYSTEM_GLOBAL_WORDS_ID, { appVersion: '4.0.1' });
  assert.equal(globalContext.subject.entryId, globalAccess.id, '总表查询仍针对具体 Entry');
  assert.equal(globalContext.subject.projectedFromTotal, true);
}

const ui = fs.readFileSync(path.join(root, 'js/v3-ui.js'), 'utf8');
const integrations = fs.readFileSync(path.join(root, 'js/v3-integrations.js'), 'utf8');
assert.ok(ui.indexOf("const oxford =") < ui.indexOf("const collins ="));
assert.ok(ui.indexOf("const collins =") < ui.indexOf("const groq ="));
assert.ok(ui.indexOf("const groq =") < ui.indexOf("const chatgpt ="));
assert.ok(ui.includes('providerOptions'));
for (const label of ['Oxford', 'Collins', 'Groq', 'ChatGPT']) assert.ok(ui.includes(`'${label}'`));
assert.ok(ui.includes('activeProviderQuery.controller.abort()'));
assert.ok(ui.includes('if (!providerQueryIsCurrent(sequence)) return'));
assert.ok(integrations.includes("const MAX_CONTEXT_RELATIONS = 16"));
assert.ok(integrations.includes("'/dictionaries'"));

console.log(`integration-tests: OK (max Shortcut URL ${maxUrl.length} chars @ ${maxUrl.text})`);
