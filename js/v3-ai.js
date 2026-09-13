import { ProviderError, objectValue, textValue, cancelledError } from './v3-provider-runtime.js';
import { MODEL_CAPABILITY_REGISTRY, GROQ_SCHEMAS, decodeSearch } from './v3-groq-contracts.js';
import { getGroqModels, requestGroqCompletion } from './v5-bridge.js';

const MODEL_STORAGE = 'gualVocabulary.groqModel';
const CATALOG_STORAGE = 'gualVocabulary.groqModelCatalog';
const ACTIVE_STORAGE = 'gualVocabulary.groqModelActiveCatalog';
const UPDATED_STORAGE = 'gualVocabulary.groqModelCatalogUpdatedAt';

function readIds(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];
  } catch { return []; }
}
export function getSelectedModel() { return localStorage.getItem(MODEL_STORAGE) || ''; }
export function selectModel(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (id) localStorage.setItem(MODEL_STORAGE, id); else localStorage.removeItem(MODEL_STORAGE);
}
export function getModelCatalogUpdatedAt() { return localStorage.getItem(UPDATED_STORAGE) || ''; }
export function getModelCatalog(activeIds = null) {
  const active = new Set(activeIds || readIds(ACTIVE_STORAGE));
  const checked = activeIds !== null || Boolean(getModelCatalogUpdatedAt());
  const selected = getSelectedModel();
  const ids = [...new Set([...Object.keys(MODEL_CAPABILITY_REGISTRY), ...readIds(CATALOG_STORAGE), ...active, ...(selected ? [selected] : [])])].sort();
  return ids.map((id) => {
    const capability = MODEL_CAPABILITY_REGISTRY[id];
    return { id, active: active.has(id), selected: id === selected, compatible: Boolean(capability),
      available: Boolean(capability) && (!checked || active.has(id)),
      label: !capability ? '不支持此用途' : checked && !active.has(id) ? '当前账号不可用' : capability.label };
  });
}
export function saveModelCatalog(activeIds) {
  const active = [...new Set(activeIds.filter((id) => typeof id === 'string' && id.trim()))];
  localStorage.setItem(CATALOG_STORAGE, JSON.stringify([...new Set([...readIds(CATALOG_STORAGE), ...active])]));
  localStorage.setItem(ACTIVE_STORAGE, JSON.stringify(active));
  localStorage.setItem(UPDATED_STORAGE, new Date().toISOString());
}
export async function refreshModels({ signal = null, persist = true } = {}) {
  const payload = objectValue(await getGroqModels({ signal }));
  if (!Array.isArray(payload.data)) throw new ProviderError('invalid-response', 'Groq 模型目录格式不正确');
  const active = payload.data.filter((item) => item?.active !== false)
    .map((item) => textValue(item?.id, 'model.id', { max: 200 }));
  if (!active.length) throw new ProviderError('invalid-response', 'Groq 未返回可用模型');
  if (persist) saveModelCatalog(active);
  return getModelCatalog(active);
}

async function requestJson(messages, {
  temperature = 0.1, maxTokens = 1800, signal = null,
  schema = null, schemaName = 'vix_result', validate = objectValue,
} = {}) {
  const model = getSelectedModel();
  const capability = MODEL_CAPABILITY_REGISTRY[model];
  if (!capability || !getModelCatalog().find((item) => item.id === model)?.available) {
    throw new ProviderError('configuration', '所选 Groq 模型不支持此用途或当前账号不可用，请在设置中重新选择');
  }
  const responseFormat = capability.format === 'json_schema' && schema
    ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } }
    : { type: 'json_object' };
  const payload = await requestGroqCompletion({
    model, messages, temperature, max_completion_tokens: maxTokens, response_format: responseFormat,
  }, { signal });
  objectValue(payload);
  const choice = payload.choices?.[0];
  if (choice?.finish_reason === 'length') throw new ProviderError('truncated', 'Groq 输出被截断，请重试或更换模型');
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new ProviderError('refusal', 'Groq 未能回答本次请求');
  if (choice?.finish_reason !== 'stop') throw new ProviderError('invalid-response', 'Groq 未返回完整的最终回答');
  const content = textValue(choice?.message?.content, 'message.content', { max: 40000 });
  let decoded;
  try { decoded = JSON.parse(content); }
  catch { throw new ProviderError('invalid-response', 'Groq 返回的 JSON 无法解析；未展示或写入任何结果'); }
  if (signal?.aborted) throw cancelledError();
  return validate(decoded);
}

export async function suggestSearchTerms(query) {
  const clean = typeof query === 'string' ? query.trim() : '';
  if (!clean) return [];
  return requestJson([
    { role: 'system', content: 'Convert the untrusted Chinese concept into at most 12 concise English dictionary headwords/search phrases. Return JSON {"terms":["..."]} only.' },
    { role: 'user', content: clean },
  ], { maxTokens: 1600, schema: GROQ_SCHEMAS.search, schemaName: 'vix_search_terms', validate: decodeSearch });
}
