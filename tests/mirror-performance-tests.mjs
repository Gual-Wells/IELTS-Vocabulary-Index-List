import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { SuppressionRuntime, deriveEffectiveProjection, setMirrorSuppression } from '../js/v5-suppression-runtime.js';

const entries = Array.from({ length: 23917 }, (_, index) => ({ id: `entry_${index}` }));
const structuralProjection = new Map(Array.from({ length: 24 }, (_, index) => [
  `collection_${index}`,
  entries.slice(index * 900, Math.min(entries.length, index * 900 + 3000)),
]));
const allowed = entries.slice(0, 650).map((entry) => entry.id);
const runtime = new SuppressionRuntime();

const started = performance.now();
setMirrorSuppression(runtime, entries.map((entry) => entry.id), allowed);
const projection = deriveEffectiveProjection(structuralProjection, runtime);
const elapsed = performance.now() - started;

assert.equal(runtime.suppressedIds().size, entries.length - allowed.length);
assert.ok([...projection.values()].every((items) => items.every((entry) => allowed.includes(entry.id))));
assert.ok(elapsed < 500, `Mirror projection took ${elapsed.toFixed(1)}ms`);

console.log(`mirror-performance-tests: OK (${elapsed.toFixed(1)}ms for ${entries.length} entries)`);
