import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildRelationComponentsForEntries } from '../js/v3-model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RUNTIME = path.join(ROOT, 'data', 'seed5-runtime');
const RETIRED_DOMAINS = new Set(['domain_computer_terms', 'domain_general_collocations']);
const RETIRED_SOURCE_KEYS = new Set([
  'MDN', 'PY', 'GH', 'K8S', 'CNCF', 'NIST', 'NIST-AI', 'IETF',
  'CORE', 'DSA', 'DATA', 'OS', 'HW', 'DEVOPS',
  'VIX-4-CURATED', 'VIX-6-CURATED', 'VIX-7-CURATED', 'VIX-A14-USAGE-REBUILT',
]);
const TARGET_REVISION = 10;

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const bytes = (text) => Buffer.byteLength(text, 'utf8');

async function listChunkFiles(prefix) {
  return (await fs.readdir(RUNTIME))
    .filter((name) => new RegExp(`^${prefix}-\\d+\\.json$`).test(name))
    .sort();
}

async function readChunks(prefix) {
  const names = await listChunkFiles(prefix);
  const rows = [];
  for (const name of names) rows.push(...await readJson(path.join(RUNTIME, name)));
  return rows;
}

function chunkRows(rows, maxBytes) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  for (const row of rows) {
    const text = JSON.stringify(row);
    const addBytes = bytes(text) + (current.length ? 1 : 0);
    if (current.length && currentBytes + addBytes > maxBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += bytes(text) + (current.length > 1 ? 1 : 0);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function writeChunks(prefix, rows, maxBytes) {
  for (const old of await listChunkFiles(prefix)) await fs.rm(path.join(RUNTIME, old));
  const chunks = chunkRows(rows, maxBytes);
  const descriptors = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const name = `${prefix}-${String(i).padStart(3, '0')}.json`;
    const rel = `data/seed5-runtime/${name}`;
    const text = JSON.stringify(chunks[i]);
    await fs.writeFile(path.join(RUNTIME, name), text);
    descriptors.push({ path: rel, bytes: bytes(text), sha256: sha256(text), count: chunks[i].length });
  }
  return descriptors;
}

function editOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Cannot patch ${label}`);
  return text.replace(from, to);
}

async function patchMigrationCode() {
  const dbPath = path.join(ROOT, 'js', 'v3-db.js');
  let db = await fs.readFile(dbPath, 'utf8');
  db = editOnce(db, 'export const BUILTIN_SEED_REVISION = 9;', 'export const BUILTIN_SEED_REVISION = 10;', 'BUILTIN_SEED_REVISION');
  await fs.writeFile(dbPath, db);

  const migrationPath = path.join(ROOT, 'js', 'v5-seed-migration.js');
  let migration = await fs.readFile(migrationPath, 'utf8');
  migration = editOnce(
    migration,
    "import { APP_VERSION } from './v5-version.js';\n",
    "import { APP_VERSION } from './v5-version.js';\n\nconst HARD_RETIRED_DOMAIN_IDS = new Set(['domain_computer_terms', 'domain_general_collocations']);\nconst HARD_RETIRED_SOURCE_KEYS = new Set(['MDN','PY','GH','K8S','CNCF','NIST','NIST-AI','IETF','CORE','DSA','DATA','OS','HW','DEVOPS','VIX-4-CURATED','VIX-6-CURATED','VIX-7-CURATED','VIX-A14-USAGE-REBUILT']);\n",
    'hard-retire constants',
  );
  migration = editOnce(
    migration,
    "function mergeContentSources(currentSources, targetSources) {\n  const merged = new Map((targetSources || []).map((item) => [item.key, clone(item)]));\n  for (const item of currentSources || []) merged.set(item.key, clone(item));\n  return [...merged.values()];\n}",
    "function mergeContentSources(currentSources, targetSources) {\n  const merged = new Map((targetSources || []).filter((item) => !HARD_RETIRED_SOURCE_KEYS.has(item.key)).map((item) => [item.key, clone(item)]));\n  for (const item of currentSources || []) {\n    if (!HARD_RETIRED_SOURCE_KEYS.has(item.key)) merged.set(item.key, clone(item));\n  }\n  return [...merged.values()];\n}",
    'content source purge',
  );
  migration = editOnce(
    migration,
    "  const domains = mergeById('domains', base.domains, current.domains, target.domains, forceDomainIds, report);\n",
    "  const domains = mergeById('domains', base.domains, current.domains, target.domains, forceDomainIds, report)\n    .filter((item) => !HARD_RETIRED_DOMAIN_IDS.has(item.id));\n",
    'domain hard-retire filter',
  );
  await fs.writeFile(migrationPath, migration);

  const swPath = path.join(ROOT, 'sw.js');
  let sw = await fs.readFile(swPath, 'utf8');
  sw = sw.replace(/v5\.0\.0-alpha\.14-seed\d+-[^'`]+/, 'v5.0.0-alpha.14-seed10-20260912-1');
  await fs.writeFile(swPath, sw);
}

async function main() {
  const manifestPath = path.join(RUNTIME, 'manifest.json');
  const metaPath = path.join(RUNTIME, 'meta.json');
  const manifestBefore = await readJson(manifestPath);
  const meta = await readJson(metaPath);
  const entriesBefore = await readChunks('entries');
  const membershipsBefore = await readChunks('memberships');

  const retiredEntryIds = new Set(entriesBefore.filter((e) => RETIRED_DOMAINS.has(e.domainId)).map((e) => e.id));
  const entries = entriesBefore.filter((e) => !RETIRED_DOMAINS.has(e.domainId));
  const entryIds = new Set(entries.map((e) => e.id));

  meta.domains = (meta.domains || []).filter((d) => !RETIRED_DOMAINS.has(d.id));
  meta.collections = (meta.collections || []).filter((c) => !RETIRED_DOMAINS.has(c.domainId));
  const collectionIds = new Set(meta.collections.map((c) => c.id));
  const memberships = membershipsBefore.filter((m) => entryIds.has(m.entryId) && collectionIds.has(m.collectionId));
  meta.pins = (meta.pins || []).filter((p) => entryIds.has(p.entryId) && (!p.contextCollectionId || collectionIds.has(p.contextCollectionId)));
  meta.annotations = (meta.annotations || []).filter((a) => entryIds.has(a.entryId));
  meta.studyStamps = (meta.studyStamps || []).filter((s) => entryIds.has(s.entryId));
  meta.settings = {
    ...(meta.settings || {}),
    builtInSeedRevision: TARGET_REVISION,
    migrationSource: 'seed10-hard-retire-computer-and-collocations',
    seedMigrationReport: null,
    contentSources: (meta.settings?.contentSources || []).filter((s) => !RETIRED_SOURCE_KEYS.has(s.key)),
  };
  meta.exportedAt = new Date().toISOString();

  if (meta.domains.some((d) => RETIRED_DOMAINS.has(d.id))) throw new Error('retired domain survived meta filter');
  if (entries.some((e) => RETIRED_DOMAINS.has(e.domainId))) throw new Error('retired entry survived');
  if (retiredEntryIds.size === 0) throw new Error('expected retired entries were not found');

  const relations = buildRelationComponentsForEntries(entries, { timestamp: meta.exportedAt });
  const maxBytes = Number(manifestBefore.maxChunkBytes || 4194304);
  const entryDescriptors = await writeChunks('entries', entries, maxBytes);
  const membershipDescriptors = await writeChunks('memberships', memberships, maxBytes);
  const relationDescriptors = await writeChunks('relations', relations, maxBytes);

  const metaText = JSON.stringify(meta);
  await fs.writeFile(metaPath, metaText);
  const generatedAt = new Date().toISOString();
  const manifest = {
    protocol: 'vix-seed-runtime/1',
    seedRevision: TARGET_REVISION,
    appVersion: manifestBefore.appVersion,
    generatedAt,
    maxChunkBytes: maxBytes,
    meta: { path: 'data/seed5-runtime/meta.json', bytes: bytes(metaText), sha256: sha256(metaText) },
    entries: entryDescriptors,
    memberships: membershipDescriptors,
    relationComponents: relationDescriptors,
    counts: { entries: entries.length, memberships: memberships.length, relationComponents: relations.length },
  };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

  await patchMigrationCode();

  const obsolete = [
    '.github/workflows/usage-domain-gloss-rebuild.yml',
    '.github/workflows/alpha14-seed-source-repair-v2.yml',
    'tools/rebuild_usage_glosses.mjs',
    'tools/repair_alpha14_seed.py',
    'data/seed-baselines/seed-9-alpha14-repair-qa.json',
  ];
  for (const rel of obsolete) await fs.rm(path.join(ROOT, rel), { force: true });

  console.log(JSON.stringify({
    seedRevision: TARGET_REVISION,
    removedDomains: [...RETIRED_DOMAINS],
    removedEntries: entriesBefore.length - entries.length,
    removedMemberships: membershipsBefore.length - memberships.length,
    remainingDomains: meta.domains.map((d) => d.id),
    counts: manifest.counts,
  }, null, 2));
}

await main();
