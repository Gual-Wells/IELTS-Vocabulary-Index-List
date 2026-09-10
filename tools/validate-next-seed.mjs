import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeEnglish, toTraditional } from '../js/v3-model.js';

const args = process.argv.slice(2);
const inputFlag = args.indexOf('--input');
const inputName = inputFlag >= 0 ? args[inputFlag + 1] : args.find((item) => !item.startsWith('--'));
if (!inputName) throw new Error('Usage: node tools/validate-next-seed.mjs <seed-generation.json>');
const inputPath = path.resolve(inputName);
const seed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const failures = [];
const arrays = ['domains', 'collections', 'entries', 'memberships', 'relationComponents', 'pins', 'studyStamps'];
for (const key of arrays) if (!Array.isArray(seed[key])) failures.push(`${key} must be a complete array`);
if (!Number.isSafeInteger(Number(seed.settings?.builtInSeedRevision || 0))) failures.push('builtInSeedRevision is required');
if ((seed.annotations || []).length) failures.push('annotations must not ship in a seed generation');
if (seed.settings?.contentSources) failures.push('runtime contentSources is retired');

const domainById = new Map((seed.domains || []).map((item) => [item.id, item]));
const collectionIds = new Set((seed.collections || []).map((item) => item.id));
const entryIds = new Set();
const identities = new Set();
const glossOwners = new Map();
const genericPatterns = [
  /^常用(?:英語)?(?:表達模板|語法框架|英語句型)/,
  /^語篇連接表達/,
  /^表示某種情況[。.]?$/,
  /^(?:表示|指|用來|用於|一種|某種)(?:某種|相關|一種|情況|內容|事物)?[。.]?$/,
];

for (const collection of seed.collections || []) {
  if (collection.domainId && !domainById.has(collection.domainId)) failures.push(`${collection.id} has an unknown domain`);
}

for (const entry of seed.entries || []) {
  if (!entry?.id || entryIds.has(entry.id)) failures.push(`duplicate or empty entry id: ${entry?.id || '(empty)'}`);
  entryIds.add(entry?.id);
  const identity = `${entry?.domainId}\u0000${normalizeEnglish(entry?.text || '')}`;
  if (identities.has(identity)) failures.push(`duplicate entry identity: ${identity}`);
  identities.add(identity);
  if (!domainById.has(entry?.domainId)) failures.push(`unknown entry domain: ${entry?.id}`);
  for (const field of ['glossHans', 'glossHant', 'glossSource']) if (field in entry) failures.push(`${entry.id} contains retired ${field}`);
  const gloss = String(entry?.gloss || '').trim();
  if (domainById.get(entry?.domainId)?.glossEnabled && !gloss) failures.push(`${entry.id} has no gloss`);
  if (/\uFFFD|[?？]{2,}/.test(gloss)) failures.push(`${entry.id} has corrupted gloss characters`);
  if (gloss && toTraditional(gloss) !== gloss) failures.push(`${entry.id} gloss is not Traditional Chinese glyph form`);
  if (genericPatterns.some((pattern) => pattern.test(gloss))) failures.push(`${entry.id} has a generic or non-semantic gloss`);
  if (gloss) {
    const owners = glossOwners.get(gloss) || [];
    owners.push(entry.id);
    glossOwners.set(gloss, owners);
  }
}
for (const [gloss, owners] of glossOwners) {
  if (owners.length > 24) failures.push(`boilerplate gloss reused ${owners.length} times: ${gloss.slice(0, 60)}`);
}
for (const membership of seed.memberships || []) {
  if ('sourceLabel' in membership || 'sourceOrder' in membership) failures.push(`${membership.id} contains retired membership provenance`);
  if (!entryIds.has(membership.entryId) || !collectionIds.has(membership.collectionId)) failures.push(`${membership.id} has a broken reference`);
}
for (const relation of seed.relationComponents || []) {
  if (!entryIds.has(relation.sourceEntryId)) failures.push(`${relation.id} has an unknown source entry`);
  if (relation.domainId && !domainById.has(relation.domainId)) failures.push(`${relation.id} has an unknown domain`);
}
for (const pin of seed.pins || []) {
  if ('domainId' in pin) failures.push(`${pin.id} contains retired pin.domainId`);
  if (!entryIds.has(pin.entryId) || !collectionIds.has(pin.contextCollectionId)) failures.push(`${pin.id} has a broken context reference`);
}
for (const stamp of seed.studyStamps || []) {
  if (!entryIds.has(stamp.entryId)) failures.push(`${stamp.id || stamp.key} has an unknown entry`);
}

const result = {
  protocol: 'vix-seed-quality-gate/1',
  seedGeneration: Number(seed.settings?.builtInSeedRevision || 0),
  entries: (seed.entries || []).length,
  failures: failures.length,
  sample: failures.slice(0, 100),
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
