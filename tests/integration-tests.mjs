import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildProjection, canonicalizeBackup, normalizeEnglish,
  SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_WORDS_ID, systemDomainWordsCollectionId,
} from '../js/v3-model.js';
import {
  buildChatGPTPrompt, buildChatGPTShortcutUrl, buildOxfordLookupUrl,
  CHATGPT_SHORTCUT_NAME, createEntryContext, ENTRY_CONTEXT_FORMAT,
} from '../js/v3-integrations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));

function groupBy(items, keyFn) {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const list = result.get(key) || [];
    list.push(item);
    result.set(key, list);
  }
  return result;
}

function buildTestState(backup) {
  const domainById = new Map(backup.domains.map((item) => [item.id, item]));
  const collectionById = new Map(backup.collections.map((item) => [item.id, item]));
  collectionById.set(SYSTEM_GLOBAL_WORDS_ID, { id: SYSTEM_GLOBAL_WORDS_ID, domainId: '', name: '全局词汇总表', type: 'system-global-words', virtual: true });
  collectionById.set(SYSTEM_GLOBAL_PHRASES_ID, { id: SYSTEM_GLOBAL_PHRASES_ID, domainId: '', name: '全局短语总表', type: 'system-global-phrases', virtual: true });
  for (const domain of backup.domains) collectionById.set(systemDomainWordsCollectionId(domain.id), { id: systemDomainWordsCollectionId(domain.id), domainId: domain.id, name: '词汇总表', type: 'system-domain-words', virtual: true });

  const entryById = new Map(backup.entries.map((item) => [item.id, item]));
  const wordsByNormalizedText = groupBy(backup.entries.filter((item) => item.kind === 'word'), (item) => item.normalizedText);
  const phrasesByNormalizedText = groupBy(backup.entries.filter((item) => item.kind === 'phrase'), (item) => item.normalizedText);
  const membershipsByEntry = groupBy(backup.memberships, (item) => item.entryId);
  const tokensByPhrase = groupBy(backup.phraseTokens, (item) => item.phraseId);
  const wordsByDomainText = new Map(backup.entries.filter((item) => item.kind === 'word').map((item) => [`${item.domainId}:${item.normalizedText}`, item]));
  const phrasesByDomainToken = new Map();
  for (const token of backup.phraseTokens) {
    const phrase = entryById.get(token.phraseId);
    if (!phrase) continue;
    const key = `${token.domainId}:${token.normalizedToken}`;
    const list = phrasesByDomainToken.get(key) || [];
    if (!list.some((item) => item.id === phrase.id)) list.push(phrase);
    phrasesByDomainToken.set(key, list);
  }
  const relatedPhrasesByEntry = new Map();
  const phraseComponentsByEntry = new Map();
  for (const entry of backup.entries) {
    if (entry.kind === 'word') {
      relatedPhrasesByEntry.set(entry.id, [...(phrasesByDomainToken.get(`${entry.domainId}:${entry.normalizedText}`) || [])]
        .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en')));
    } else {
      phraseComponentsByEntry.set(entry.id, [...(tokensByPhrase.get(entry.id) || [])]
        .sort((a, b) => a.tokenIndex - b.tokenIndex)
        .map((token) => ({ ...token, entry: wordsByDomainText.get(`${entry.domainId}:${token.normalizedToken}`) || null })));
    }
  }
  return {
    ...backup,
    projection: buildProjection(backup),
    domainById,
    collectionById,
    entryById,
    wordsByNormalizedText,
    phrasesByNormalizedText,
    membershipsByEntry,
    relatedPhrasesByEntry,
    phraseComponentsByEntry,
    pinByEntry: new Map(backup.pins.map((item) => [item.entryId, item])),
    annotationByEntry: new Map(backup.annotations.map((item) => [item.entryId, item])),
    studyStampByKey: new Map(backup.studyStamps.map((item) => [item.key, item])),
  };
}

const state = buildTestState(seed);
assert.equal(buildOxfordLookupUrl('thread pool'), 'hk-com-oupc-oecd-lookup://x-callback-url/s?q=thread%20pool');
assert.throws(() => buildOxfordLookupUrl('  '), /没有可查询/);

const dataEntry = seed.entries.find((item) => item.domainId === 'domain_computer_terms' && item.kind === 'word' && item.normalizedText === 'data');
assert.ok(dataEntry);
const dataCollection = seed.collections.find((item) => item.id === 'collection_computer_software_data');
assert.ok(dataCollection);
const context = createEntryContext(state, dataEntry, dataCollection.id, { appVersion: '3.5.0', viewMode: 'alphabet', section: 'word' });
assert.equal(context.format, ENTRY_CONTEXT_FORMAT);
assert.equal(context.subject.scope, 'domain-entry');
assert.equal(context.subject.instanceEntryIds.length, 1);
assert.deepEqual(context.entries.find((item) => item.id === dataEntry.id), dataEntry);
assert.ok(context.memberships.some((item) => item.entryId === dataEntry.id));
assert.ok(context.relations.filter((item) => item.type === 'related-phrase').length >= 20);
assert.ok(context.sources.length >= 1);
assert.equal(JSON.stringify(context).includes('Groq API Key'), true, '排除声明应保留隐私边界');
assert.equal(Object.hasOwn(context, 'settings'), false);

const prompt = buildChatGPTPrompt(context);
assert.ok(prompt.includes('请使用网页搜索'));
assert.ok(prompt.includes('"format":"vix-entry-context"'));
const shortcutUrl = buildChatGPTShortcutUrl(prompt);
const parsed = new URL(shortcutUrl);
assert.equal(parsed.protocol, 'shortcuts:');
assert.equal(parsed.hostname, 'run-shortcut');
assert.equal(parsed.searchParams.get('name'), CHATGPT_SHORTCUT_NAME);
assert.equal(parsed.searchParams.get('input'), 'text');
assert.equal(parsed.searchParams.get('text'), prompt);
assert.ok(shortcutUrl.length < 100000, `当前代表条目 URL 过长：${shortcutUrl.length}`);
const dataGlobal = state.projection.get(SYSTEM_GLOBAL_WORDS_ID).find((item) => item.normalizedText === normalizeEnglish('data'));
assert.ok(dataGlobal);
const dataGlobalUrl = buildChatGPTShortcutUrl(buildChatGPTPrompt(createEntryContext(state, dataGlobal, SYSTEM_GLOBAL_WORDS_ID, { appVersion: '3.5.0', viewMode: 'alphabet', section: 'word' })));
assert.ok(dataGlobalUrl.length < 100000, `全局高关联条目 URL 过长：${dataGlobalUrl.length}`);

const addressGlobal = state.projection.get(SYSTEM_GLOBAL_WORDS_ID).find((item) => item.normalizedText === normalizeEnglish('address'));
assert.ok(addressGlobal);
const globalContext = createEntryContext(state, addressGlobal, SYSTEM_GLOBAL_WORDS_ID, { appVersion: '3.5.0', viewMode: 'date', section: 'word' });
assert.equal(globalContext.subject.scope, 'domain-entry');
assert.equal(globalContext.subject.projectedFromGlobal, true);
assert.deepEqual(globalContext.subject.instanceEntryIds, [addressGlobal.id]);
assert.equal(globalContext.domains.some((item) => item.id === addressGlobal.domainId), true);
assert.equal(globalContext.currentView.domainId, null);

console.log(`integration-tests: OK (largest tested URL ${Math.max(shortcutUrl.length, dataGlobalUrl.length)} chars)`);
