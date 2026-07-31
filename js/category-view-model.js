import { LETTERS } from './constants.js';
import { groupForWord } from './utils.js';

export function buildCategoryViewModel(entries) {
  const sortedEntries = [...entries].sort((a, b) =>
    a.normalizedWord.localeCompare(b.normalizedWord) || a.id.localeCompare(b.id));
  const globalIndexes = new Map(sortedEntries.map((entry, index) => [entry.id, index + 1]));
  const groups = new Map(LETTERS.map((letter) => [letter, []]));

  for (const entry of sortedEntries) {
    const letter = groupForWord(entry.word);
    groups.get(letter).push(entry);
  }

  const sections = [];
  for (const letter of LETTERS) {
    const groupEntries = groups.get(letter);
    if (!groupEntries.length) continue;
    sections.push({
      letter,
      count: groupEntries.length,
      rows: groupEntries.map((entry, index) => ({
        entry,
        groupIndex: index + 1,
        globalIndex: globalIndexes.get(entry.id),
      })),
    });
  }

  return {
    sections,
    availableLetters: sections.map((section) => section.letter),
    globalIndexes,
  };
}

export function resolveExpandedLetters({
  previous = [], availableLetters = [], navigationEntry = null, focusNavigation = false, defaultWhenEmpty = false,
} = {}) {
  const available = new Set(availableLetters);

  // Entering a category from home/search is deterministic: restore exactly the
  // explicit target group, not an arbitrary mixture of old open groups.
  if (focusNavigation && navigationEntry) {
    const letter = groupForWord(navigationEntry.word);
    if (available.has(letter)) return new Set([letter]);
  }

  // Re-renders caused by editing, pinning or settings preserve only the groups
  // that are open in the current live view. They are deliberately not persisted
  // across category navigation, which removes stale cross-render state entirely.
  const result = new Set(
    Array.isArray(previous) ? previous.filter((letter) => available.has(letter)) : [],
  );
  if (!result.size && defaultWhenEmpty && availableLetters.length) result.add(availableLetters[0]);
  return result;
}
