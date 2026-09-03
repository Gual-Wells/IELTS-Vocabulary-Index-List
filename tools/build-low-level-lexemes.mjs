import fs from 'node:fs/promises';

const seedUrl = new URL('../data/seed.json', import.meta.url);
const outputUrl = new URL('../data/relation-low-level-lexemes.json', import.meta.url);
const seed = JSON.parse(await fs.readFile(seedUrl, 'utf8'));
const levels = new Map([
  ['collection_general_english_a1', 'cefr-a1'],
  ['collection_general_english_a2', 'cefr-a2'],
]);
const entryById = new Map(seed.entries.map((entry) => [entry.id, entry]));
const categoryByText = new Map();

for (const membership of seed.memberships) {
  const category = levels.get(membership.collectionId);
  if (!category) continue;
  const entry = entryById.get(membership.entryId);
  if (!entry || entry.kind !== 'word' || !entry.normalizedText) continue;
  const previous = categoryByText.get(entry.normalizedText);
  if (!previous || category === 'cefr-a1') categoryByText.set(entry.normalizedText, category);
}

// Retain the one historic function-word form that is not present in the
// bundled CEFR A1/A2 collections.
if (!categoryByText.has('onto')) categoryByText.set('onto', 'function-word');

const items = [...categoryByText]
  .sort(([left], [right]) => left.localeCompare(right, 'en'))
  .map(([normalizedText, category]) => ({
    normalizedText,
    category,
    reason: category.startsWith('cefr-') ? `${category.toUpperCase()} vocabulary` : 'basic function word',
  }));

const output = {
  version: 2,
  generatedFromSeedRevision: Number(seed.settings?.builtInSeedRevision || 0),
  description: 'Basic A1/A2 lexemes hidden from relation projections when low-level relation filtering is enabled.',
  items,
};

await fs.writeFile(outputUrl, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ version: output.version, seedRevision: output.generatedFromSeedRevision, items: items.length }, null, 2));
