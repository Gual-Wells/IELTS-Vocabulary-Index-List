import { ProviderError, objectValue, textValue, arrayValue } from './v3-provider-runtime.js';

// Historical VIX Groq capability registry used by the built-in AI search.
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
  search: obj({ terms: list(str) }),
};

export function decodeSearch(payload) {
  return [...new Set(arrayValue(objectValue(payload).terms, 'terms', 12)
    .map((v) => textValue(v, 'term', { max: 240 })))] ;
}
