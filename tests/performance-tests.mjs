import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { migrateLegacyBackup, searchBackup } from '../js/v3-model.js';
import { createVixPackage, planVixImport } from '../js/v3-exchange.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
const backup = migrateLegacyBackup(seed, { timestamp: '2026-08-01T00:00:00.000Z' });

const start = performance.now();
for (let index = 0; index < 25; index += 1) searchBackup({ entries: backup.entries }, 'bal', { limit: 180 });
const elapsed = performance.now() - start;
assert.ok(elapsed < 2500, `25 次本地搜索耗时过长：${elapsed.toFixed(1)}ms`);

const store = fs.readFileSync(path.join(root, 'js/v3-store.js'), 'utf8');
assert.match(store, /return state\.relatedPhrasesByEntry\.get\(entryId\) \|\| \[\]/);
assert.match(store, /return state\.phraseComponentsByEntry\.get\(phraseId\) \|\| \[\]/);
assert.match(store, /const entries = entryIds \? state\.entries\.filter/);
assert.match(store, /return searchBackup\(\{ entries \}, query, searchOptions\)/);
const collectionPackage = createVixPackage(backup, {
  scope: 'collection', collectionId: 'collection_computer_artificial_intelligence',
});
collectionPackage.mode = 'merge';
const exchangeStart = performance.now();
const plan = planVixImport(backup, collectionPackage, {
  scope: 'collection', domainId: 'domain_computer_terms',
  collectionId: 'collection_computer_artificial_intelligence', mode: 'merge', targetMode: 'current',
}, 'current');
const exchangeElapsed = performance.now() - exchangeStart;
assert.equal(plan.summary.removedDomains, 0);
assert.equal(plan.summary.removedWords, 0);
assert.equal(plan.summary.removedPhrases, 0);
assert.ok(exchangeElapsed < 8000, `词表预检耗时过长：${exchangeElapsed.toFixed(1)}ms`);

console.log(`performance-tests: OK (${elapsed.toFixed(1)}ms / 25 searches; ${exchangeElapsed.toFixed(1)}ms collection preflight)`);
