import fs from 'node:fs/promises';

const revision = Number(process.argv[2]);
if (!Number.isSafeInteger(revision) || revision < 1) {
  throw new Error('Usage: node tools/build-seed-gloss-baseline.mjs <revision>');
}

const seed = JSON.parse(await fs.readFile(new URL('../data/seed.json', import.meta.url), 'utf8'));
if (Number(seed.settings?.builtInSeedRevision) !== revision) {
  throw new Error(`Current Seed revision is ${seed.settings?.builtInSeedRevision}; expected ${revision}`);
}

const payload = {
  protocol: 'vix-seed-field-baseline/1',
  seedRevision: revision,
  fields: ['glossHans', 'glossHant', 'glossSource'],
  entries: seed.entries.map((entry) => [
    entry.id,
    String(entry.glossHans || ''),
    String(entry.glossHant || ''),
    String(entry.glossSource || ''),
  ]),
};

const directory = new URL('../data/seed-baselines/', import.meta.url);
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(new URL(`seed-${revision}-glosses.json`, directory), `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ revision, entries: payload.entries.length }));
