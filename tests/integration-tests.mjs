import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProjection, canonicalizeBackup } from '../js/v3-model.js';
import { buildOxfordLookupUrl, createEntryContext, ENTRY_CONTEXT_FORMAT, ENTRY_CONTEXT_VERSION } from '../js/v3-integrations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));
const groupBy = (items, key) => {
  const result = new Map();
  for (const item of items) { const id = key(item); const list = result.get(id) || []; list.push(item); result.set(id, list); }
  return result;
};
const projection = buildProjection(seed);
const entryById = new Map(seed.entries.map((item) => [item.id, item]));
const domainById = new Map(seed.domains.map((item) => [item.id, item]));
const collectionById = new Map(seed.collections.map((item) => [item.id, item]));
const entriesByNormalizedText = groupBy(seed.entries, (item) => item.normalizedText);
const membershipsByEntry = groupBy(seed.memberships, (item) => item.entryId);
const visibleEntryIdsByCollection = new Map([...projection].map(([id, entries]) => [id, new Set(entries.map((item) => item.id))]));
const relatedEntriesByEntry = new Map(seed.entries.map((entry) => [entry.id, []]));
for (const component of seed.relationComponents) {
  const source = entryById.get(component.sourceEntryId);
  if (!source) continue;
  for (const target of entriesByNormalizedText.get(component.normalizedText) || []) {
    if (target.id === source.id) continue;
    relatedEntriesByEntry.get(source.id).push(target);
    relatedEntriesByEntry.get(target.id).push(source);
  }
}
const state = { ...seed, projection, entryById, domainById, collectionById, entriesByNormalizedText, membershipsByEntry, visibleEntryIdsByCollection, relatedEntriesByEntry };

assert.equal(buildOxfordLookupUrl('thread pool'), 'hk-com-oupc-oecd-lookup://x-callback-url/s?q=thread%20pool');
assert.throws(() => buildOxfordLookupUrl('  '));

const entry = seed.entries.find((item) => item.normalizedText === 'data' && item.domainId === 'domain_computer_terms');
const collection = seed.collections.find((item) => item.type === 'normal' && visibleEntryIdsByCollection.get(item.id)?.has(entry.id));
assert.ok(entry && collection);
const context = createEntryContext(state, entry, collection.id, { appVersion: '5.1.0' });
assert.equal(context.format, ENTRY_CONTEXT_FORMAT);
assert.equal(context.version, ENTRY_CONTEXT_VERSION);
assert.equal(context.subject.entryId, entry.id);
assert.ok(context.relations.length <= 16);
for (const forbidden of ['pins', 'studyStamps', 'annotations', 'memberships', 'relationComponents', 'settings']) assert.equal(Object.hasOwn(context, forbidden), false);

const source = fs.readFileSync(path.join(root, 'js/v3-integrations.js'), 'utf8').toLowerCase();
assert.ok(!source.includes('collins'));
assert.ok(!source.includes('chatgpt'));
const instructions = fs.readFileSync(path.join(root, 'integration/vix-function/VIX_PERSONALIZED_INSTRUCTIONS.md'), 'utf8');
assert.match(instructions, /exact uppercase `VIX:`/);
assert.match(instructions, /vix-function-context\/1/);
assert.match(instructions, /vix-mirror-file\/1/);
assert.match(instructions, /vocabulary, multiword phrases, and contextual usages as equal-priority classes/);
assert.match(instructions, /Match complete phrases\/usages before standalone component words/);
assert.match(instructions, /Do not print its full snapshot/);
assert.match(instructions, /local function owns its encrypted write token/);
assert.match(instructions, /substantive Traditional Chinese/);
assert.ok(!instructions.includes('Bearer '));

console.log('integration-tests: OK');
