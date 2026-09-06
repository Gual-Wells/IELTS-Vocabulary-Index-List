import { ProviderError, objectValue, textValue, arrayValue } from './v3-provider-runtime.js';

// Reviewed against Groq models / structured-outputs docs, 2026-08-31.
// Exact IDs, not name heuristics: speech, guard, agentic and unknown models fail closed.
export const MODEL_CAPABILITY_REGISTRY = Object.freeze({
  'openai/gpt-oss-20b': { format: 'json_schema', label: '结构化输出' },
  'openai/gpt-oss-120b': { format: 'json_schema', label: '结构化输出' },
  'llama-3.1-8b-instant': { format: 'json_object', label: 'JSON 输出' },
  'llama-3.3-70b-versatile': { format: 'json_object', label: 'JSON 输出' },
  'qwen/qwen3.6-27b': { format: 'json_object', label: 'JSON 输出 · Preview' },
  'qwen/qwen3.8-27b': { format: 'json_object', label: 'JSON 输出 · Preview' },
});

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
export const GROQ_SCHEMAS = {
  lookup: obj({ headword: str, partOfSpeech: str, memoryCue: str, meaning: str,
    collocations: list(str), usageHints: list(str), examples: list(obj({ english: str, translation: str })) }),
  verification: obj({ verdict: { type: 'string', enum: ['ok', 'issue', 'uncertain'] },
    explanation: str, suggestedText: str, suggestedGloss: str }),
  search: obj({ terms: list(str) }),
  suggestions: obj({ entries: list(obj({ text: str, sourceLabel: str, gloss: str })) }),
  batch: obj({ issues: list(obj({ entryId: str, suggestion: str, posSuggestion: str, reason: str })) }),
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

export function decodeVerification(payload) {
  const p = objectValue(payload);
  if (!['ok', 'issue', 'uncertain'].includes(p.verdict)) throw new ProviderError('invalid-response', '核查结论格式不正确');
  const result = {
    verdict: p.verdict,
    explanation: textValue(p.explanation, 'explanation'),
    suggestedText: textValue(p.suggestedText, 'suggestedText', { empty: true, max: 240 }),
    suggestedGloss: textValue(p.suggestedGloss, 'suggestedGloss', { empty: true, max: 240 }),
  };
  if (p.verdict !== 'issue' && (result.suggestedText || result.suggestedGloss)) {
    throw new ProviderError('invalid-response', '核查结论与修订建议不一致');
  }
  return result;
}

export function decodeSearch(payload) {
  return [...new Set(arrayValue(objectValue(payload).terms, 'terms', 12)
    .map((v) => textValue(v, 'term', { max: 240 })))];
}

export function decodeSuggestions(payload) {
  return arrayValue(objectValue(payload).entries, 'entries', 100).map((value) => {
    const e = objectValue(value, 'entry');
    return { text: textValue(e.text, 'text', { max: 240 }),
      sourceLabel: textValue(e.sourceLabel, 'sourceLabel', { empty: true, max: 120 }),
      gloss: textValue(e.gloss, 'gloss', { empty: true, max: 240 }) };
  });
}

export function decodeBatch(payload, batch) {
  const allowed = new Map(batch.map((entry) => [entry.id, entry]));
  const seen = new Set();
  return arrayValue(objectValue(payload).issues, 'issues', batch.length).map((value) => {
    const e = objectValue(value, 'issue');
    const entryId = textValue(e.entryId, 'entryId', { max: 500 });
    if (!allowed.has(entryId) || seen.has(entryId)) throw new ProviderError('invalid-response', '核查返回了未知或重复条目');
    seen.add(entryId);
    const suggestion = textValue(e.suggestion, 'suggestion', { empty: true, max: 240 });
    const pos = textValue(e.posSuggestion, 'posSuggestion', { empty: true, max: 120 });
    if (allowed.get(entryId).kind === 'content' && pos) throw new ProviderError('invalid-response', '非结构内容不应被赋予词性');
    const reason = textValue(e.reason, 'reason', { empty: true, max: 1000 });
    return { entryId, spelling: { incorrect: Boolean(suggestion), suggestion },
      reason: [pos ? `词性建议：${pos}` : '', reason].filter(Boolean).join('；').slice(0, 240) };
  }).filter((e) => e.spelling.suggestion || e.reason);
}
