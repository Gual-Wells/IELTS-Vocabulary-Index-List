import { deepClone, mergePos, normalizeWord, sortPos } from './utils.js';

function categoryOrderMap(categories) {
  return new Map(
    [...categories]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((category, index) => [category.id, index]),
  );
}

export function recalculateEntry(record, categories, { now = new Date().toISOString() } = {}) {
  const entry = deepClone(record);
  const order = categoryOrderMap(categories);
  const sourceIds = Object.keys(entry.sources ?? {}).filter((id) => order.has(id));
  sourceIds.sort((a, b) => order.get(a) - order.get(b));
  if (!sourceIds.length) return null;

  const owner = sourceIds[0];
  const source = entry.sources[owner] ?? {};
  const word = String(entry.manualWord || source.word || entry.word || '').trim();
  if (!word) return null;
  const sourcePos = sourceIds.flatMap((id) => entry.sources[id]?.pos ?? []);
  const pos = entry.manualPos?.length ? sortPos(entry.manualPos) : sortPos(sourcePos);
  if (!pos.length) return null;

  return {
    ...entry,
    word,
    normalizedWord: normalizeWord(word),
    pos,
    categoryId: owner,
    updatedAt: now,
  };
}


export function applyManualEntryEdit(record, word, pos, categories) {
  const entry = deepClone(record);
  const cleanWord = String(word ?? '').trim();
  for (const source of Object.values(entry.sources ?? {})) source.word = cleanWord;
  entry.manualWord = cleanWord;
  entry.manualPos = sortPos(pos ?? []);
  return recalculateEntry(entry, categories);
}

export function mergeEntrySource(record, categoryId, sourceInput, categories) {
  const entry = deepClone(record);
  const incomingWord = String(sourceInput?.word ?? '').trim();
  const incomingPos = sortPos(sourceInput?.pos ?? []);
  const source = entry.sources?.[categoryId] ?? { word: incomingWord, pos: [] };
  source.pos = mergePos(source.pos, incomingPos);
  if (!source.word) source.word = incomingWord;
  entry.sources = { ...(entry.sources ?? {}), [categoryId]: source };

  // Manual POS is a user-confirmed canonical value, but the user's global
  // duplicate rule requires later source imports to add newly observed parts
  // of speech rather than silently hiding them.
  if (entry.manualPos?.length) entry.manualPos = mergePos(entry.manualPos, incomingPos);
  return recalculateEntry(entry, categories);
}
