import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { buildRelationComponentsForEntries, canonicalizeBackup, searchBackup } from '../js/v3-model.js';
import { createVixPackage, planVixImport } from '../js/v3-exchange.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backup = canonicalizeBackup(JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8')));

let start = performance.now();
for (let index = 0; index < 25; index += 1) searchBackup(backup, 'bal', { limit: 180 });
const searchElapsed = performance.now() - start;
assert.ok(searchElapsed < 2500, `25 次本地搜索耗时过长：${searchElapsed.toFixed(1)}ms`);

start = performance.now();
const rebuilt = buildRelationComponentsForEntries(backup.entries);
const relationElapsed = performance.now() - start;
assert.equal(rebuilt.length, backup.relationComponents.length);
assert.ok(relationElapsed < 5000, `全 Seed 关系组件重建耗时过长：${relationElapsed.toFixed(1)}ms`);

const collection = backup.collections.find((item) => item.id === 'collection_computer_artificial_intelligence')
  || backup.collections.find((item) => item.type === 'normal' && item.domainId === 'domain_computer_terms');
assert.ok(collection);
const collectionPackage = createVixPackage(backup, { scope: 'collection', collectionId: collection.id });
collectionPackage.mode = 'merge';
start = performance.now();
const plan = planVixImport(backup, collectionPackage, {
  scope: 'collection', domainId: collection.domainId, collectionId: collection.id, mode: 'merge', targetMode: 'current',
}, 'current');
const exchangeElapsed = performance.now() - start;
assert.equal(plan.summary.removedDomains, 0);
assert.ok(exchangeElapsed < 8000, `词表 VIX v2 预检耗时过长：${exchangeElapsed.toFixed(1)}ms`);

console.log(`performance-tests: OK (${searchElapsed.toFixed(1)}ms / 25 searches; ${relationElapsed.toFixed(1)}ms relations; ${exchangeElapsed.toFixed(1)}ms VIX preflight)`);
