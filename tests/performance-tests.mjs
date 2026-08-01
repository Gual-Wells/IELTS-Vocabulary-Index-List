import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { migrateLegacyBackup, searchBackup } from '../js/v3-model.js';

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
assert.match(store, /return searchBackup\(\{ entries: state\.entries \}, query, options\)/);
console.log(`performance-tests: OK (${elapsed.toFixed(1)}ms / 25 searches)`);
