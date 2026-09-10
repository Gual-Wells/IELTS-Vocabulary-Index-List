import fs from 'node:fs/promises';

const sourceUrl = new URL('../data/relation-low-level-lexemes-source.json', import.meta.url);
const outputUrl = new URL('../data/relation-low-level-lexemes.json', import.meta.url);
const source = JSON.parse(await fs.readFile(sourceUrl, 'utf8'));
if (source?.scope !== 'relation-noise-only' || !Array.isArray(source?.groups)) {
  throw new Error('Invalid independent low-level relation lexicon source.');
}

const seen = new Map();
for (const group of source.groups) {
  if (!group?.category || !group?.reason || !Array.isArray(group?.lexemes)) throw new Error('Invalid lexicon group.');
  for (const input of group.lexemes) {
    const normalizedText = String(input || '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
    if (!normalizedText || normalizedText.includes(' ')) throw new Error(`Low-level lexeme must be one token: ${input}`);
    const previous = seen.get(normalizedText);
    if (previous && previous.category !== group.category) {
      throw new Error(`Low-level lexeme appears in multiple categories: ${normalizedText}`);
    }
    seen.set(normalizedText, {
      normalizedText,
      category: group.category,
      policy: 'suppress-component-relation',
      reason: group.reason,
    });
  }
}

const items = [...seen.values()].sort((left, right) => left.normalizedText.localeCompare(right.normalizedText, 'en'));

const output = {
  version: 3,
  sourceVersion: Number(source.version || 1),
  reviewedAt: source.reviewedAt,
  scope: source.scope,
  description: source.description,
  invariants: {
    independentOfCefrCollections: true,
    suppressesWordsOnly: true,
    suppressesPhrases: false,
    suppressesUsages: false
  },
  items,
};

await fs.writeFile(outputUrl, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ version: output.version, reviewedAt: output.reviewedAt, items: items.length }, null, 2));
