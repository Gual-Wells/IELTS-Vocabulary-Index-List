#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeGlossHant, toTraditional, MAX_GLOSS_TEXT } from '../js/v3-model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME = path.join(ROOT, 'data', 'seed5-runtime');
const BASELINES = path.join(ROOT, 'data', 'seed-baselines');
const STAGE = process.env.SEED9_HANS_OUT || '/tmp/seed9-hans.json';
const GENERATED_AT = process.env.SEED9_GENERATED_AT || '2026-09-11T00:00:00.000Z';
const MAX_CHUNK_BYTES = 4194304;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const compact = (value) => JSON.stringify(value);
const sha256Buffer = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha256File = (p) => sha256Buffer(fs.readFileSync(p));
const byteLength = (s) => Buffer.byteLength(s, 'utf8');

function entryFiles() {
  return fs.readdirSync(RUNTIME).filter((n) => /^entries-\d+\.json$/.test(n)).sort().map((n) => path.join(RUNTIME, n));
}
function membershipFiles() {
  return fs.readdirSync(RUNTIME).filter((n) => /^memberships-\d+\.json$/.test(n)).sort().map((n) => path.join(RUNTIME, n));
}
function relationFiles() {
  return fs.readdirSync(RUNTIME).filter((n) => /^relations-\d+\.json$/.test(n)).sort().map((n) => path.join(RUNTIME, n));
}
function loadAll(files) {
  return files.flatMap((p) => readJson(p));
}
function withoutGloss(e) {
  const { gloss, ...rest } = e;
  return rest;
}
function descriptor(p, count) {
  const buf = fs.readFileSync(p);
  return { path: path.relative(ROOT, p).replaceAll('\\', '/'), bytes: buf.length, sha256: sha256Buffer(buf), count };
}
function verifyDescriptor(d) {
  const p = path.join(ROOT, d.path);
  const buf = fs.readFileSync(p);
  if (buf.length !== d.bytes) throw new Error(`byte-size drift before rebuild: ${d.path}`);
  const hash = sha256Buffer(buf);
  if (hash !== d.sha256) throw new Error(`sha256 drift before rebuild: ${d.path}`);
}

const oldManifest = readJson(path.join(RUNTIME, 'manifest.json'));
if (oldManifest.protocol !== 'vix-seed-runtime/1' || Number(oldManifest.seedRevision) !== 8) {
  throw new Error(`expected Seed 8 runtime, got ${oldManifest.seedRevision}`);
}
if (oldManifest.counts?.entries !== 23917) throw new Error('Seed 8 entry count mismatch');
for (const d of [...oldManifest.memberships, ...oldManifest.relationComponents]) verifyDescriptor(d);

const originalEntryFiles = entryFiles();
const originalEntries = loadAll(originalEntryFiles);
if (originalEntries.length !== 23917) throw new Error(`expected 23917 entries, got ${originalEntries.length}`);
const originalNonGloss = originalEntries.map(withoutGloss);
const originalIds = originalEntries.map((e) => e.id);
if (new Set(originalIds).size !== originalIds.length) throw new Error('duplicate entry IDs in Seed 8');

const stage = readJson(STAGE);
if (stage.protocol !== 'vix-seed9-hans-stage/1' || Number(stage.seedRevision) !== 9 || !Array.isArray(stage.entries)) {
  throw new Error('invalid Seed 9 Simplified stage');
}
if (stage.entries.length !== originalEntries.length) throw new Error('Seed 9 stage coverage mismatch');
const byId = new Map(stage.entries.map((row) => [row[0], { hans: row[1], source: row[2] }]));
if (byId.size !== originalEntries.length) throw new Error('Seed 9 stage contains duplicate/missing IDs');

const baselineRows = [];
const rebuilt = originalEntries.map((entry) => {
  const item = byId.get(entry.id);
  if (!item) throw new Error(`missing Seed 9 gloss: ${entry.id}`);
  if (!item.hans || typeof item.hans !== 'string') throw new Error(`empty Simplified gloss: ${entry.id}`);
  if (item.hans.length > MAX_GLOSS_TEXT) throw new Error(`Simplified gloss too long: ${entry.id}`);
  const hant = normalizeGlossHant(toTraditional(item.hans));
  if (!hant || hant.length > MAX_GLOSS_TEXT) throw new Error(`canonical gloss invalid: ${entry.id}`);
  baselineRows.push([entry.id, item.hans, hant, item.source]);
  return { ...entry, gloss: hant };
});

// Non-gloss data is immutable in this rebuild.
for (let i = 0; i < rebuilt.length; i += 1) {
  const before = compact(originalNonGloss[i]);
  const after = compact(withoutGloss(rebuilt[i]));
  if (before !== after) throw new Error(`non-gloss drift at index ${i}: ${rebuilt[i].id}`);
}
if (rebuilt.map((e) => e.id).join('\n') !== originalIds.join('\n')) throw new Error('entry ordering changed');

// Write the auditable authoritative baseline using the existing Seed field-baseline protocol.
fs.mkdirSync(BASELINES, { recursive: true });
const baseline = {
  protocol: 'vix-seed-field-baseline/1',
  seedRevision: 9,
  fields: ['glossHans', 'glossHant', 'glossSource'],
  entries: baselineRows,
};
fs.writeFileSync(path.join(BASELINES, 'seed-9-glosses.json'), compact(baseline), 'utf8');

// Rechunk entries deterministically while respecting the runtime's exact byte cap.
for (const p of originalEntryFiles) fs.unlinkSync(p);
const chunks = [];
let current = [];
let currentBytes = 2; // []
for (const entry of rebuilt) {
  const item = compact(entry);
  const itemBytes = byteLength(item);
  const additional = itemBytes + (current.length ? 1 : 0);
  if (current.length && currentBytes + additional > MAX_CHUNK_BYTES) {
    chunks.push(current);
    current = [];
    currentBytes = 2;
  }
  current.push(entry);
  currentBytes += itemBytes + (current.length > 1 ? 1 : 0);
  if (currentBytes > MAX_CHUNK_BYTES) throw new Error(`single chunk overflow at ${entry.id}`);
}
if (current.length) chunks.push(current);

const entryDescriptors = [];
chunks.forEach((chunk, index) => {
  const name = `entries-${String(index).padStart(3, '0')}.json`;
  const p = path.join(RUNTIME, name);
  const body = compact(chunk);
  if (byteLength(body) > MAX_CHUNK_BYTES) throw new Error(`chunk overflow: ${name}`);
  fs.writeFileSync(p, body, 'utf8');
  entryDescriptors.push(descriptor(p, chunk.length));
});
if (entryDescriptors.reduce((n, x) => n + x.count, 0) !== 23917) throw new Error('rechunk coverage mismatch');

// Update meta with a content-generation marker; preserve every other field.
const metaPath = path.join(RUNTIME, 'meta.json');
const meta = readJson(metaPath);
meta.exportedAt = GENERATED_AT;
meta.settings = { ...meta.settings, builtInSeedRevision: 9, migrationSource: 'seed9-vix-5.1.1-mainland-gloss-rebuild' };
fs.writeFileSync(metaPath, compact(meta), 'utf8');
const metaBuffer = fs.readFileSync(metaPath);

const manifest = {
  ...oldManifest,
  seedRevision: 9,
  appVersion: '5.1.1',
  generatedAt: GENERATED_AT,
  maxChunkBytes: MAX_CHUNK_BYTES,
  meta: {
    path: 'data/seed5-runtime/meta.json',
    bytes: metaBuffer.length,
    sha256: sha256Buffer(metaBuffer),
  },
  entries: entryDescriptors,
  counts: {
    entries: 23917,
    memberships: oldManifest.counts.memberships,
    relationComponents: oldManifest.counts.relationComponents,
  },
};
fs.writeFileSync(path.join(RUNTIME, 'manifest.json'), compact(manifest), 'utf8');

// Bump the only runtime Seed generation constant.
const dbPath = path.join(ROOT, 'js', 'v3-db.js');
const dbBefore = fs.readFileSync(dbPath, 'utf8');
const dbAfter = dbBefore.replace('export const BUILTIN_SEED_REVISION = 8;', 'export const BUILTIN_SEED_REVISION = 9;');
if (dbAfter === dbBefore || !dbAfter.includes('export const BUILTIN_SEED_REVISION = 9;')) throw new Error('failed to bump BUILTIN_SEED_REVISION');
fs.writeFileSync(dbPath, dbAfter, 'utf8');

// Final integrity validation from disk.
const diskEntries = loadAll(entryFiles());
if (diskEntries.length !== 23917) throw new Error('runtime entry count after write is not 23917');
for (let i = 0; i < diskEntries.length; i += 1) {
  if (compact(withoutGloss(diskEntries[i])) !== compact(originalNonGloss[i])) throw new Error(`disk non-gloss drift: ${diskEntries[i].id}`);
  const row = baselineRows[i];
  if (row[0] !== diskEntries[i].id) throw new Error(`baseline order mismatch at ${i}`);
  if (normalizeGlossHant(toTraditional(row[1])) !== diskEntries[i].gloss) throw new Error(`canonical conversion mismatch: ${row[0]}`);
}
for (const d of manifest.entries) verifyDescriptor(d);
for (const d of [...manifest.memberships, ...manifest.relationComponents]) verifyDescriptor(d);
if (membershipFiles().length !== oldManifest.memberships.length) throw new Error('membership chunk count changed');
if (relationFiles().length !== oldManifest.relationComponents.length) throw new Error('relation chunk count changed');

const forbiddenMainland = ['软体', '网路', '资讯', '资料库', '程式', '记忆体', '硬碟', '伺服器', '滑鼠', '印表机', '作业系统'];
for (const [id, hans] of baselineRows) {
  for (const bad of forbiddenMainland) {
    if (hans.includes(bad)) throw new Error(`non-Mainland terminology ${bad} in ${id}`);
  }
  if (/\\n|\n/.test(hans)) throw new Error(`newline artifact in ${id}`);
  if (/\[(?:法|医|化|计|机|電|电|通信|语|经|贸)\]/.test(hans)) throw new Error(`legacy domain marker in ${id}`);
  if (/人名/.test(hans)) throw new Error(`legacy name noise in ${id}`);
}

const qa = {
  protocol: 'vix-seed-qa/1',
  seedRevision: 9,
  appVersion: '5.1.1',
  generatedAt: GENERATED_AT,
  counts: {
    entries: diskEntries.length,
    memberships: manifest.counts.memberships,
    relationComponents: manifest.counts.relationComponents,
  },
  coverage: `${diskEntries.length}/${originalEntries.length}`,
  nonGlossDrift: 0,
  entryOrderDrift: 0,
  canonicalConversionMismatches: 0,
  emptyGlosses: baselineRows.filter((r) => !r[1] || !r[2]).length,
  sourceCounts: stage.stats?.sourceCounts || {},
  fallbackCount: stage.stats?.fallbackCount ?? null,
  smoke: stage.stats?.smoke || [],
  entryChunks: manifest.entries,
  membershipChunksUnchanged: manifest.memberships,
  relationChunksUnchanged: manifest.relationComponents,
  baseline: {
    path: 'data/seed-baselines/seed-9-glosses.json',
    bytes: fs.statSync(path.join(BASELINES, 'seed-9-glosses.json')).size,
    sha256: sha256File(path.join(BASELINES, 'seed-9-glosses.json')),
  },
};
if (qa.emptyGlosses !== 0 || qa.smoke.some((x) => !x.ok)) throw new Error('QA failed');
fs.writeFileSync(path.join(BASELINES, 'seed-9-qa.json'), JSON.stringify(qa, null, 2) + '\n', 'utf8');

console.log('SEED9_OK', JSON.stringify({
  entries: diskEntries.length,
  chunks: manifest.entries.length,
  nonGlossDrift: qa.nonGlossDrift,
  sourceCounts: qa.sourceCounts,
  fallbackCount: qa.fallbackCount,
  baselineSha256: qa.baseline.sha256,
}));
