#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeGlossHant, toTraditional, MAX_GLOSS_TEXT } from '../js/v3-model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME = path.join(ROOT, 'data', 'seed5-runtime');
const BASELINES = path.join(ROOT, 'data', 'seed-baselines');
const STAGE = process.env.ALPHA14_REPAIR_STAGE || '/tmp/alpha14-seed-repair-stage.json';
const GENERATED_AT = process.env.SEED_REPAIR_GENERATED_AT || '2026-09-12T08:00:00.000Z';
const MAX_CHUNK_BYTES = 4194304;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const compact = (value) => JSON.stringify(value);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const listFiles = (regex) => fs.readdirSync(RUNTIME).filter((name) => regex.test(name)).sort().map((name) => path.join(RUNTIME, name));
const loadAll = (paths) => paths.flatMap((p) => readJson(p));
const withoutGloss = (entry) => {
  const { glossHans, glossHant, glossSource, ...rest } = entry;
  return rest;
};
const descriptor = (p, count = undefined) => {
  const bytes = fs.readFileSync(p);
  const result = {
    path: path.relative(ROOT, p).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: sha256(bytes),
  };
  if (count !== undefined) result.count = count;
  return result;
};
const verifyDescriptor = (d) => {
  const p = path.join(ROOT, d.path);
  const bytes = fs.readFileSync(p);
  if (bytes.length !== Number(d.bytes) || sha256(bytes) !== d.sha256) throw new Error(`descriptor drift: ${d.path}`);
};

function splitChunks(items, maxBytes) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  for (const item of items) {
    const itemBytes = Buffer.byteLength(compact(item), 'utf8');
    const addition = itemBytes + (current.length ? 1 : 0);
    if (current.length && currentBytes + addition + 1 > maxBytes) {
      chunks.push(current);
      current = [item];
      currentBytes = 2 + itemBytes;
    } else {
      current.push(item);
      currentBytes += addition;
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

fs.mkdirSync(BASELINES, { recursive: true });
const manifestPath = path.join(RUNTIME, 'manifest.json');
const metaPath = path.join(RUNTIME, 'meta.json');
const manifest = readJson(manifestPath);
const meta = readJson(metaPath);
if (manifest.protocol !== 'vix-seed-runtime/1' || Number(manifest.seedRevision) !== 8) throw new Error(`expected alpha Seed 8 runtime, got ${manifest.seedRevision}`);
if (compact(manifest.counts) !== compact({ entries: 23917, memberships: 61905, relationComponents: 20793 })) throw new Error('runtime counts mismatch');
for (const d of [manifest.meta, ...manifest.entries, ...manifest.memberships, ...manifest.relationComponents]) verifyDescriptor(d);

const entryPaths = listFiles(/^entries-\d+\.json$/);
const original = loadAll(entryPaths);
if (original.length !== 23917) throw new Error(`entry count mismatch: ${original.length}`);

const baseline8 = {
  protocol: 'vix-seed-field-baseline/1',
  seedRevision: 8,
  fields: ['glossHans', 'glossHant', 'glossSource'],
  entries: original.map((entry) => [entry.id, entry.glossHans || '', entry.glossHant || '', entry.glossSource || '']),
};
const baseline8Path = path.join(BASELINES, 'seed-8-glosses.json');
fs.writeFileSync(baseline8Path, compact(baseline8) + '\n', 'utf8');

const stage = readJson(STAGE);
if (!['vix-alpha14-source-repair-stage/1', 'vix-alpha14-source-repair-stage/2'].includes(stage.protocol)
    || Number(stage.fromSeedRevision) !== 8 || Number(stage.toSeedRevision) !== 9) {
  throw new Error('invalid alpha14 repair stage');
}
const targets = new Map();
for (const row of stage.targets || []) {
  const [id, hans, source, evidence = [], priorSource = ''] = row;
  if (!id || !String(hans || '').trim() || !source) throw new Error(`invalid target row: ${compact(row)}`);
  if (targets.has(id)) throw new Error(`duplicate target ID: ${id}`);
  targets.set(id, { hans: String(hans).trim(), source: String(source), evidence, priorSource });
}
if (targets.size !== Number(stage.counts?.targets || -1)) throw new Error('stage target count mismatch');

let changed = 0;
let canonicalMismatches = 0;
const sourceCounts = {};
const rebuilt = original.map((entry) => {
  const target = targets.get(entry.id);
  if (!target) return structuredClone(entry);
  if (target.hans.length > MAX_GLOSS_TEXT) throw new Error(`gloss too long ${entry.id}`);
  const hant = normalizeGlossHant(toTraditional(target.hans));
  if (!hant || hant.length > MAX_GLOSS_TEXT) throw new Error(`canonical gloss invalid ${entry.id}`);
  if (normalizeGlossHant(toTraditional(target.hans)) !== hant) canonicalMismatches += 1;
  const next = {
    ...entry,
    glossHans: target.hans,
    glossHant: hant,
    glossSource: target.source,
  };
  if (compact(withoutGloss(entry)) !== compact(withoutGloss(next))) throw new Error(`non-gloss drift ${entry.id}`);
  if (compact([entry.glossHans || '', entry.glossHant || '', entry.glossSource || '']) !== compact([next.glossHans, next.glossHant, next.glossSource])) changed += 1;
  sourceCounts[target.source] = (sourceCounts[target.source] || 0) + 1;
  return next;
});
if (canonicalMismatches) throw new Error(`canonical conversion mismatches: ${canonicalMismatches}`);

const rebuiltById = new Map(rebuilt.map((entry) => [entry.id, entry]));
for (const entry of original) {
  const next = rebuiltById.get(entry.id);
  if (!targets.has(entry.id) && compact(entry) !== compact(next)) throw new Error(`non-target entry changed: ${entry.id}`);
}

const generalMissingAfter = rebuilt.filter((entry) => entry.domainId === 'domain_general_english'
  && ['word', 'phrase'].includes(entry.kind)
  && !String(entry.glossHans || '').trim() && !String(entry.glossHant || '').trim());
const techMissingAfter = rebuilt.filter((entry) => entry.domainId === 'domain_computer_terms'
  && ['word', 'phrase'].includes(entry.kind)
  && !String(entry.glossHans || '').trim() && !String(entry.glossHant || '').trim());
const usageAfter = rebuilt.filter((entry) => entry.domainId === 'domain_general_collocations');
if (generalMissingAfter.length || techMissingAfter.length) throw new Error(`structured blanks remain: general=${generalMissingAfter.length} tech=${techMissingAfter.length}`);
if (usageAfter.length !== 595) throw new Error(`usage count mismatch after rebuild: ${usageAfter.length}`);
const genericUsageHans = new Set([
  '常用英语句型；方括号或省略号部分需结合语境替换。',
  '常用语法框架；使用时需根据句法和语境补全。',
  '常用表达模板；适合在写作或口语中按语境改写。',
  '语篇连接表达；用于组织信息和标明逻辑关系。',
  '常用英语表达。',
]);
const genericUsageRemaining = usageAfter.filter((entry) => genericUsageHans.has(String(entry.glossHans || '').trim()));
if (genericUsageRemaining.length) throw new Error(`generic usage glosses remain: ${genericUsageRemaining.length}`);

for (const p of entryPaths) fs.unlinkSync(p);
const chunks = splitChunks(rebuilt, MAX_CHUNK_BYTES);
const entryDescriptors = [];
chunks.forEach((chunk, index) => {
  const p = path.join(RUNTIME, `entries-${String(index).padStart(3, '0')}.json`);
  fs.writeFileSync(p, compact(chunk) + '\n', 'utf8');
  const d = descriptor(p, chunk.length);
  if (d.bytes > MAX_CHUNK_BYTES) throw new Error(`entry chunk exceeds byte limit: ${d.path}`);
  entryDescriptors.push(d);
});

meta.appVersion = '5.0.0-alpha.14';
meta.exportedAt = GENERATED_AT;
meta.settings = {
  ...meta.settings,
  builtInSeedRevision: 9,
  migrationComplete: true,
  migrationSource: 'seed9-source-backed-alpha14-repair',
  migrationNoticePending: false,
};
fs.writeFileSync(metaPath, compact(meta) + '\n', 'utf8');
const metaDescriptor = descriptor(metaPath);

manifest.seedRevision = 9;
manifest.appVersion = '5.0.0-alpha.14';
manifest.generatedAt = GENERATED_AT;
manifest.meta = metaDescriptor;
manifest.entries = entryDescriptors;
manifest.counts = { entries: 23917, memberships: 61905, relationComponents: 20793 };
fs.writeFileSync(manifestPath, compact(manifest) + '\n', 'utf8');

for (const d of [manifest.meta, ...manifest.entries, ...manifest.memberships, ...manifest.relationComponents]) verifyDescriptor(d);

const baseline8Bytes = fs.readFileSync(baseline8Path);
const qa = {
  protocol: 'vix-alpha14-seed-repair-qa/1',
  appVersion: '5.0.0-alpha.14',
  fromSeedRevision: 8,
  seedRevision: 9,
  generatedAt: GENERATED_AT,
  counts: { entries: 23917, memberships: 61905, relationComponents: 20793 },
  repairScope: stage.counts,
  repairedTargets: targets.size,
  actualChanged: changed,
  nonTargetEntryDrift: 0,
  nonGlossDrift: 0,
  canonicalConversionMismatches: canonicalMismatches,
  structuredBlankAfter: { general: 0, computer: 0 },
  usage: { reviewed: usageAfter.length, genericTemplateRemaining: 0 },
  sourceCounts,
  referenceCoverage: stage.referenceCoverage || {},
  referenceSignatureCoverage: stage.referenceSignatureCoverage || {},
  evidenceCounts: stage.evidenceCounts || {},
  matchCounts: stage.matchCounts || {},
  aiFallbackCount: Number(stage.counts?.aiFallback || 0),
  aiFallbackRows: stage.fallbackRows || [],
  baseline8: {
    path: 'data/seed-baselines/seed-8-glosses.json',
    bytes: baseline8Bytes.length,
    sha256: sha256(baseline8Bytes),
    count: baseline8.entries.length,
  },
  entryChunks: entryDescriptors,
  membershipsUnchanged: manifest.memberships,
  relationsUnchanged: manifest.relationComponents,
};
const qaPath = path.join(BASELINES, 'seed-9-alpha14-repair-qa.json');
fs.writeFileSync(qaPath, JSON.stringify(qa, null, 2) + '\n', 'utf8');

console.log('ALPHA14_SEED_REPAIR_APPLY_OK', JSON.stringify({
  targets: targets.size,
  changed,
  chunks: entryDescriptors.length,
  sourceCounts,
  aiFallbackCount: qa.aiFallbackCount,
  baseline8Sha256: qa.baseline8.sha256,
}));
