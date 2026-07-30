import { normalizeWord } from './utils.js';

function isSubsequence(needle, haystack) {
  let cursor = 0;
  for (const char of haystack) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}

function levenshteinWithin(a, b, maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

export function scoreWord(word, query) {
  const target = normalizeWord(word);
  const needle = normalizeWord(query);
  if (!needle || !target) return Number.POSITIVE_INFINITY;
  if (target === needle) return 0;
  if (target.startsWith(needle)) return 10 + (target.length - needle.length) * 0.05;
  const index = target.indexOf(needle);
  if (index >= 0) return 25 + index * 1.5 + (target.length - needle.length) * 0.05;
  if (needle.length >= 3 && isSubsequence(needle, target)) return 55 + (target.length - needle.length);
  if (needle.length >= 4 && target[0] === needle[0] && Math.abs(target.length - needle.length) <= 2) {
    const distance = levenshteinWithin(needle, target, 2);
    if (distance <= 2) return 78 + distance * 8 + Math.abs(target.length - needle.length);
  }
  return Number.POSITIVE_INFINITY;
}

export function fuzzySearch(entries, query, { limit = 80 } = {}) {
  const needle = normalizeWord(query);
  if (!needle) return [];
  const scored = [];
  for (const entry of entries) {
    const score = scoreWord(entry.word, needle);
    if (Number.isFinite(score)) scored.push({ entry, score });
  }
  scored.sort((a, b) => a.score - b.score || a.entry.normalizedWord.localeCompare(b.entry.normalizedWord));
  return scored.slice(0, limit).map(({ entry, score }) => ({ ...entry, searchScore: score }));
}

export function searchByCandidates(entries, candidates, { limit = 100 } = {}) {
  const best = new Map();
  candidates.forEach((candidate, candidateIndex) => {
    for (const result of fuzzySearch(entries, candidate, { limit: 24 })) {
      const score = candidateIndex * 8 + result.searchScore;
      const existing = best.get(result.id);
      if (!existing || score < existing.score) best.set(result.id, { entry: result, score, candidate });
    }
  });
  return [...best.values()]
    .sort((a, b) => a.score - b.score || a.entry.normalizedWord.localeCompare(b.entry.normalizedWord))
    .slice(0, limit)
    .map(({ entry, candidate }) => ({ ...entry, matchedCandidate: candidate }));
}
