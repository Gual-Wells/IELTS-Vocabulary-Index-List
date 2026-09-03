import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const sourceUrl = new URL('../data/seed.json', import.meta.url);
const outputUrl = new URL('../data/seed5-runtime/', import.meta.url);
const maximumChunkBytes = 4 * 1024 * 1024;
const seed = JSON.parse(await fs.readFile(sourceUrl, 'utf8'));
await fs.mkdir(outputUrl, { recursive: true });

function digest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function writeAsset(filename, value) {
  const text = `${JSON.stringify(value)}\n`;
  const bytes = Buffer.byteLength(text);
  if (bytes > 25 * 1024 * 1024) throw new Error(`${filename} exceeds the Cloudflare static asset limit`);
  await fs.writeFile(new URL(filename, outputUrl), text);
  return { path: `data/seed5-runtime/${filename}`, bytes, sha256: digest(text) };
}

async function writeChunks(name, items) {
  const chunks = [];
  let current = [];
  let currentBytes = 3;
  const flush = async () => {
    if (!current.length) return;
    const filename = `${name}-${String(chunks.length).padStart(3, '0')}.json`;
    const asset = await writeAsset(filename, current);
    chunks.push({ ...asset, count: current.length });
    current = [];
    currentBytes = 3;
  };
  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item)) + (current.length ? 1 : 0);
    if (current.length && currentBytes + itemBytes > maximumChunkBytes) await flush();
    current.push(item);
    currentBytes += itemBytes;
  }
  await flush();
  return chunks;
}

const meta = await writeAsset('meta.json', {
  schemaVersion: seed.schemaVersion,
  appVersion: seed.appVersion,
  exportedAt: seed.exportedAt,
  domains: seed.domains,
  collections: seed.collections,
  pins: seed.pins,
  annotations: seed.annotations,
  studyStamps: seed.studyStamps,
  settings: seed.settings,
});
const entries = await writeChunks('entries', seed.entries);
const memberships = await writeChunks('memberships', seed.memberships);
const relationComponents = await writeChunks('relations', seed.relationComponents);
const manifest = {
  protocol: 'vix-seed-runtime/1',
  seedRevision: Number(seed.settings?.builtInSeedRevision || 0),
  appVersion: seed.appVersion,
  generatedAt: seed.exportedAt,
  maxChunkBytes: maximumChunkBytes,
  meta,
  entries,
  memberships,
  relationComponents,
  counts: {
    entries: seed.entries.length,
    memberships: seed.memberships.length,
    relationComponents: seed.relationComponents.length,
  },
};
await writeAsset('manifest.json', manifest);
console.log(JSON.stringify({
  protocol: manifest.protocol,
  chunks: { entries: entries.length, memberships: memberships.length, relationComponents: relationComponents.length },
  largestAssetBytes: Math.max(meta.bytes, ...entries.map((item) => item.bytes), ...memberships.map((item) => item.bytes), ...relationComponents.map((item) => item.bytes)),
  counts: manifest.counts,
}, null, 2));
