import { objectValue, textValue, arrayValue } from './v3-provider-runtime.js';

// Reviewed against Groq models / structured-outputs docs, 2026-08-31.
// Exact IDs, not name heuristics: speech, guard, agentic and unknown models fail closed.
export const MODEL_CAPABILITY_REGISTRY = Object.freeze({
  'openai/gpt-oss-20b': { format: 'json_schema', label: '结构化输出' },
  'openai/gpt-oss-120b': { format: 'json_schema', label: '结构化输出' },
  'qwen/qwen3.6-27b': { format: 'json_object', label: 'JSON 输出 · Preview' },
  'qwen/qwen3.8-27b': { format: 'json_object', label: 'JSON 输出 · Preview' },
});

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
export const GROQ_SCHEMAS = {
  lookup: obj({ headword: str, partOfSpeech: str, memoryCue: str, meaning: str,
    collocations: list(str), usageHints: list(str), examples: list(obj({ english: str, translation: str })) }),
  search: obj({ terms: list(str) }),
  suggestions: obj({ entries: list(obj({ text: str, partsOfSpeech: list(str), gloss: str })) }),
};

export function decodeLookup(payload) {
  const p = objectValue(payload);
  return {
    headword: textValue(p.headword, 'headword', { max: 240 }),
    partOfSpeech: textValue(p.partOfSpeech, 'partOfSpeech', { empty: true, max: 120 }),
    memoryCue: textValue(p.memoryCue, 'memoryCue', { empty: true, max: 160 }),
    meaning: textValue(p.meaning, 'meaning', { max: 500 }),
    collocations: arrayValue(p.collocations, 'collocations', 8).map((value) => textValue(value, 'collocation', { max: 120 })),
    usageHints: arrayValue(p.usageHints, 'usageHints', 5).map((value) => textValue(value, 'usageHint', { max: 240 })),
    examples: arrayValue(p.examples, 'examples', 5).map((value) => {
      const e = objectValue(value, 'example');
      return { english: textValue(e.english, 'example.english', { max: 800 }),
        translation: textValue(e.translation, 'example.translation', { empty: true, max: 800 }) };
    }),
  };
}

export function decodeSearch(payload) {
  return [...new Set(arrayValue(objectValue(payload).terms, 'terms', 12)
    .map((v) => textValue(v, 'term', { max: 240 })))];
}

export function decodeSuggestions(payload) {
  return arrayValue(objectValue(payload).entries, 'entries', 100).map((value) => {
    const e = objectValue(value, 'entry');
    return { text: textValue(e.text, 'text', { max: 240 }),
      partsOfSpeech: arrayValue(e.partsOfSpeech, 'partsOfSpeech', 16)
        .map((part) => textValue(part, 'partOfSpeech', { max: 40 })),
      gloss: textValue(e.gloss, 'gloss', { empty: true, max: 240 }) };
  });
}
