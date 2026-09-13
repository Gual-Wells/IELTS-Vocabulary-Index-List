from pathlib import Path
import re


def top_span(text, name):
    p = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', re.M)
    m = p.search(text)
    if not m:
        raise SystemExit(f'function not found: {name}')
    n = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(', re.M).search(text, m.end())
    return m.start(), n.start() if n else len(text)


def replace_function(text, name, replacement):
    a, b = top_span(text, name)
    return text[:a] + replacement.rstrip() + '\n\n' + text[b:]


# Historical search-only provider runtime.
Path('js/v3-provider-runtime.js').write_text(r'''export class ProviderError extends Error {
  constructor(code, message, { status = 0, retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function cancelledError() { return new ProviderError('cancelled', '查询已取消'); }

export function objectValue(value, field = 'result') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value;
}

export function textValue(value, field, { empty = false, max = 2000 } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value.trim();
}

export function arrayValue(value, field, max = 32) {
  if (!Array.isArray(value) || value.length > max) throw new ProviderError('invalid-response', `返回数据格式不正确：${field}`);
  return value;
}
''', encoding='utf-8')

# Historical model whitelist + search response contract only.
Path('js/v3-groq-contracts.js').write_text(r'''import { ProviderError, objectValue, textValue, arrayValue } from './v3-provider-runtime.js';

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
''', encoding='utf-8')

# Historical AI-search/model logic, with unrelated lookup/check/add APIs intentionally omitted.
Path('js/v3-ai.js').write_text(r'''import { ProviderError, objectValue, textValue, cancelledError } from './v3-provider-runtime.js';
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
''', encoding='utf-8')

# Bridge: restore historical Groq query-secret and model/chat endpoints.
p = Path('js/v5-bridge.js')
s = p.read_text(encoding='utf-8')
s = replace_function(s, 'testBridgeConfigOnce', r'''async function testBridgeConfigOnce(config, options = {}) {
  const { probeGroq = true, ...requestOptions } = options;
  const status = await bridgeRequest('/v1/status', { ...requestOptions, config });
  if (probeGroq && status?.groqState === 'master_key_mismatch') {
    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 与已保存的 Groq Key 不匹配，请重新保存 Groq Key', 409);
  }
  if (probeGroq && status?.groqState === 'unreadable') {
    throw new BridgeError('groq_secret_unreadable', 'Groq Key 无法解密，请在 Bridge 中重新保存', 409);
  }
  if (status?.ttsState === 'master_key_mismatch') {
    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 已变更并与保存的 Google TTS Key 不匹配，请重新保存语音 Key', 409);
  }
  if (status?.ttsState === 'unreadable') {
    throw new BridgeError('tts_secret_unreadable', 'Google TTS Key 无法解密，请在 Bridge 中重新保存', 409);
  }
  if (!probeGroq || !status?.groq) return status;
  const models = await bridgeRequest('/v1/groq/models', { ...requestOptions, config });
  const groqModels = Array.isArray(models?.data) ? models.data : [];
  return { ...status, groqReachable: true, groqModelCount: groqModels.length, groqModels };
}''')
insert_before = 'export function saveTtsSecret(apiKey, options = {}) {'
if 'export function saveGroqSecret(' not in s:
    idx = s.find(insert_before)
    if idx < 0:
        raise SystemExit('saveTtsSecret insertion point missing')
    groq_secret = r'''export function saveGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Groq API Key');
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'PUT', body: { apiKey: key } });
}

export function validateGroqSecret(apiKey, options = {}) {
  const key = String(apiKey || '').trim();
  if (!key) throw new BridgeError('configuration', '请填写 Groq API Key');
  return bridgeRequest('/v1/settings/groq/validate', { ...options, method: 'POST', body: { apiKey: key } });
}

export function deleteGroqSecret(options = {}) {
  return bridgeRequest('/v1/settings/groq', { ...options, method: 'DELETE' });
}

'''
    s = s[:idx] + groq_secret + s[idx:]
if 'export function getGroqModels(' not in s:
    s = s.rstrip() + r'''

export function getGroqModels(options = {}) {
  return bridgeRequest('/v1/groq/models', options);
}

export function requestGroqCompletion(body, options = {}) {
  return bridgeRequest('/v1/groq/chat', { ...options, method: 'POST', body });
}
'''
p.write_text(s.rstrip() + '\n', encoding='utf-8')

# UI imports: remove the newly invented AI-search layer and restore historical search/model imports.
p = Path('js/v3-ui.js')
s = p.read_text(encoding='utf-8')
s = s.replace("import { cachedGroqSearchModels, clearGroqSearchSecret, configureGroqSearchSecret, getGroqSearchModel, listGroqSearchModels, runGroqSearch, setGroqSearchModel, validateGroqSearchSecret } from './v5-groq-search.js';\n", '')
anchor = "import {\n  downloadText, entriesToCsv, readImportFile,\n} from './v3-import.js';\n"
if "from './v3-ai.js'" not in s:
    ai_import = "import { getModelCatalog, getSelectedModel, refreshModels, saveModelCatalog, selectModel, suggestSearchTerms } from './v3-ai.js';\n"
    s = s.replace(anchor, ai_import + anchor)
s = s.replace(
"  acknowledgeMirrorRun, bridgeConfigured, cacheMirrorFileCatalog, clearBridgeConfig, deleteMirrorFile, getBridgeConfig,\n  getCachedMirrorFileCatalog, getMirrorFile, getMirrorInbox, listMirrorFiles, saveMirrorFileRecord, setBridgeConfig, testBridgeConfig, uploadMirrorContext,\n",
"  acknowledgeMirrorRun, bridgeConfigured, cacheMirrorFileCatalog, clearBridgeConfig, deleteGroqSecret, deleteMirrorFile, getBridgeConfig,\n  getCachedMirrorFileCatalog, getMirrorFile, getMirrorInbox, listMirrorFiles, saveGroqSecret, saveMirrorFileRecord, setBridgeConfig, testBridgeConfig, uploadMirrorContext, validateGroqSecret,\n")

historical_search = r'''function isChineseQuery(value) {
  return /[\u3400-\u9fff]/u.test(String(value || ''));
}

function openSearchDialog() {
  const state = getState();
  const input = el('input', { type: 'search', placeholder: '搜索', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select');
  scope.append(el('option', { value: 'all', text: '全部内容' }));
  scope.append(el('option', { value: 'global:words', text: '全局词汇' }));
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    scope.append(el('option', { value: `domain:${domain.id}`, text: `${domain.name} · 全部` }));
    const group = el('optgroup', { label: domain.name });
    if (domain.contentMode === 'nonStructured') {
      group.append(el('option', { value: `domain-content:${domain.id}`, text: '内容总表' }));
    } else {
      group.append(el('option', { value: `domain-words:${domain.id}`, text: '词汇总表' }));
    }
    for (const collection of state.collections.filter((item) => item.domainId === domain.id && item.type === 'normal' && !item.hidden).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))) {
      group.append(el('option', { value: `collection:${collection.id}`, text: collection.name }));
    }
    scope.append(group);
  }
  const current = currentCollectionId ? state.collectionById.get(currentCollectionId) : null;
  if (!current) scope.value = 'all';
  else if (current.type === 'normal') scope.value = `collection:${current.id}`;
  else if (current.id === SYSTEM_GLOBAL_WORDS_ID) scope.value = 'global:words';
  else if (current.type === 'system-domain-content') scope.value = `domain-content:${current.domainId}`;
  else scope.value = `domain-words:${current.domainId}`;

  const aiButton = button('AI 联想', 'secondary-button hidden', async () => {});
  const status = el('p', { className: 'search-status help-text' });
  const results = el('div', { className: 'search-results' });
  let requestSequence = 0, searchTimer = 0, allowedScopeValue = '';
  let allowedIds = new Set();

  const visibleIds = () => {
    const value = scope.value;
    if (value === allowedScopeValue) return allowedIds;
    allowedScopeValue = value;
    if (value === 'all') allowedIds = new Set(state.entries.map((entry) => entry.id));
    else if (value === 'global:words') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_WORDS_ID).map((entry)=>entry.id));
    else if (value.startsWith('domain-words:')) allowedIds = new Set(getVisibleEntries(systemDomainWordsCollectionId(value.slice(13))).map((entry)=>entry.id));
    else if (value.startsWith('domain-content:')) allowedIds = new Set(getVisibleEntries(systemDomainContentCollectionId(value.slice(15))).map((entry)=>entry.id));
    else if (value.startsWith('domain:')) {
      const domainId = value.slice(7); allowedIds = new Set(state.entries.filter((entry)=>entry.domainId===domainId).map((entry)=>entry.id));
    } else if (value.startsWith('collection:')) {
      const collectionId = value.slice(11); allowedIds = new Set(getVisibleEntries(collectionId).map((entry)=>entry.id));
    } else allowedIds = new Set();
    return allowedIds;
  };
  const targetCollectionForResult = (entry) => {
    const value = scope.value;
    if (value.startsWith('collection:')) {
      const id = value.slice(11);
      if (getVisibleEntries(id).some((candidate)=>candidate.id===entry.id)) return id;
    }
    return normalDestinationsForEntries([entry])[0]?.collectionId || projectionCollectionForEntry(entry.id);
  };
  const selectResult = async (entry, collectionId) => {
    await closeSearchDialogForNavigation();
    await navigateCollection(collectionId, entry.id, 'search', entry.kind);
  };
  const showEntries = (entries, label = '') => {
    status.textContent = label || (entries.length ? entries.length.toLocaleString() : '无结果');
    results.replaceChildren(...entries.map((entry) => searchResultButton(entry, selectResult, targetCollectionForResult(entry))));
  };
  const renderLocal = () => {
    requestSequence += 1;
    const query = input.value.trim();
    aiButton.classList.toggle('hidden', !isChineseQuery(query));
    if (!query) { status.textContent=''; results.replaceChildren(); return; }
    showEntries(search(query, { limit: 80, entryIds: visibleIds() }));
  };
  input.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = window.setTimeout(renderLocal, 140); });
  scope.addEventListener('change', () => { allowedScopeValue=''; clearTimeout(searchTimer); renderLocal(); });
  aiButton.addEventListener('click', async () => {
    const query = input.value.trim(); if (!query) return;
    const sequence = ++requestSequence; aiButton.disabled=true; aiButton.textContent='联想中…'; status.textContent='';
    try {
      const terms = await suggestSearchTerms(query); if (sequence !== requestSequence || !activeSearchFrame?.layer?.isConnected || activeSearchFrame.closing) return;
      const allowed = visibleIds(), seen = new Set(), found=[];
      for (const term of terms) { for (const entry of search(term,{limit:80,entryIds:allowed})) { if(seen.has(entry.id)) continue; seen.add(entry.id); found.push(entry); if(found.length>=80) break; } if(found.length>=80) break; }
      showEntries(found);
    } catch (error) { if (sequence === requestSequence) displayError(error); }
    finally { if(sequence===requestSequence){ aiButton.disabled=false; aiButton.textContent='AI 联想'; } }
  });
  const searchContent = el('div', { className: 'search-modal-content' }, [el('div', { className: 'search-controls' }, [input, scope, aiButton]), status, results]);
  activeSearchFrame = openDialog({
    title: '搜索内容', body: [searchContent], showCancel: false, variant: 'search', kind: 'search',
  });
}'''
s = replace_function(s, 'openSearchDialog', historical_search)

historical_bridge = r'''function openBridgeDialog({ onConfigured = null } = {}) {
  const saved = getBridgeConfig();
  const url = el('input', { type: 'url', value: saved.url, placeholder: 'https://vix-bridge.example.workers.dev', autocomplete: 'url', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' });
  const token = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: saved.deviceToken, placeholder: 'Device Token', name: 'vix-opaque-credential', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const queryKey = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: '', placeholder: 'Groq Query API Key', name: 'vix-provider-secret', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const test = button('测试', 'secondary-button', async () => {
    const oldText = test.textContent; test.disabled = true; test.textContent = '测试中…';
    try {
      let config = { url: url.value, deviceToken: token.value };
      let result = await testBridgeConfig(config, { probeGroq: false });
      config = applyRecoveredBridgeCredential(config, result, token);
      if (queryKey.value.trim()) await validateGroqSecret(queryKey.value.trim(), { config });
      showToast('配置可用');
    } finally { test.disabled = false; test.textContent = oldText; }
  });
  const removeQueryKey = button('删除查询 Key', 'secondary-button', async () => {
    await deleteGroqSecret({ config: { url: url.value, deviceToken: token.value } }); queryKey.value=''; syncCredentialMask(queryKey); showToast('查询 Key 已删除');
  });
  const clear = button('清除配置', 'secondary-button', () => { clearBridgeConfig(); url.value=''; token.value=''; queryKey.value=''; syncCredentialMask(token); syncCredentialMask(queryKey); showToast('配置已清除'); });
  const functionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX-Function.ps1', download: 'VIX-Function.ps1', text: 'VIX Function' });
  const instructionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX_PERSONALIZED_INSTRUCTIONS.md', download: 'VIX_PERSONALIZED_INSTRUCTIONS.md', text: '个性化指令' });
  openDialog({ title: 'Bridge', variant: 'management', submitText: '保存', body: [
    field('Bridge URL', url), field('Device Token', token),
    field('Groq 查询 API Key', queryKey, '用于搜索中的 AI 联想；由 Bridge 保存。'),
    el('div', { className: 'settings-row' }, [test, removeQueryKey, clear]),
    el('section', { className: 'bridge-integration-resources' }, [el('h3', { text: '集成资源' }), el('div', { className: 'bridge-download-row' }, [functionLink, instructionLink])]),
  ], onSubmit: async () => {
    let nextConfig = { url: url.value, deviceToken: token.value };
    const probe = await testBridgeConfig(nextConfig, { probeGroq: false }); nextConfig = applyRecoveredBridgeCredential(nextConfig, probe, token); setBridgeConfig(nextConfig);
    if (queryKey.value.trim()) { await saveGroqSecret(queryKey.value.trim(), { config: nextConfig }); queryKey.value=''; syncCredentialMask(queryKey); }
    onConfigured?.(); showToast('Bridge 已保存');
  }});
}'''
s = replace_function(s, 'openBridgeDialog', historical_bridge)

historical_settings = r'''function openSettingsDialog() {
  const state = getState();
  const settingsController = new AbortController();
  let modelRequest = null;
  const model = el('select');
  let draftModel = getSelectedModel();
  let refreshedIds = null;
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '无序号', selected: state.settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '小标题内编号', selected: state.settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '连续编号', selected: !['none', 'group'].includes(state.settings.numberMode) }),
  ]);
  const renderModels = (catalog = getModelCatalog()) => {
    model.replaceChildren(el('option', { value: '', text: '请选择可用模型' }),
      ...catalog.map((item) => el('option', { value: item.id, text: item.id + ' · ' + item.label,
        disabled: !item.available, selected: item.id === draftModel })));
    model.value = draftModel;
  };
  model.addEventListener('change', () => { draftModel = model.value; });
  renderModels();
  const refresh = button('刷新模型目录', 'secondary-button', async () => {
    modelRequest?.abort();
    const request = modelRequest = new AbortController();
    try {
      refresh.disabled = true;
      refresh.dataset.oldText = refresh.textContent || '';
      refresh.textContent = '刷新中…';
      const result = await refreshModels({ signal: request.signal, persist: false });
      if (settingsController.signal.aborted || request.signal.aborted || modelRequest !== request) return;
      refreshedIds = result.filter((item) => item.active).map((item) => item.id);
      renderModels(result);
      showToast('模型目录已更新');
    } catch (error) {
      if (!settingsController.signal.aborted && !request.signal.aborted && modelRequest === request) displayError(error);
    } finally {
      if (modelRequest === request) {
        refresh.disabled = false;
        refresh.textContent = refresh.dataset.oldText || '刷新模型目录';
        modelRequest = null;
      }
    }
  });
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('查询模型', model), refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号', numberMode)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [button('管理词库', 'secondary-button', openLibraryManager)])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [button('数据交换', 'secondary-button', openDataExchangeDialog)])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Bridge' }), el('div', { className: 'settings-row' }, [button('打开 Bridge', 'secondary-button', () => openBridgeDialog({ onConfigured: () => renderModels() }))])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Mirror' }), el('div', { className: 'settings-row' }, [button('选择文件', 'secondary-button', openMirrorDialog)])]),
    el('section', { className: 'settings-section settings-version' }, [el('span', { text: 'Vocabulary Index ' + APP_VERSION })]),
  ];
  const frame = openDialog({ title: '设置', body, variant: 'management', submitText: '保存', onSubmit: async () => {
    selectModel(model.value);
    if (refreshedIds) saveModelCatalog(refreshedIds);
    await setNumberMode(numberMode.value);
    showToast('已保存');
  } });
  frame.onDispose = () => { settingsController.abort(); modelRequest?.abort(); };
}'''
s = replace_function(s, 'openSettingsDialog', historical_settings)
p.write_text(s.rstrip() + '\n', encoding='utf-8')

# Remove only the custom AI-mode styling from the immediately previous implementation.
p = Path('css/v5.0.0.css')
css = p.read_text(encoding='utf-8')
css = re.sub(r'\n\.search-mode-switch \{[\s\S]*?\.bridge-ai-settings \{ margin-top: 8px; \}\n?', '\n', css, count=1)
p.write_text(css.rstrip() + '\n', encoding='utf-8')

# Replace custom runtime in precache with the historical search dependencies and bump cache generation.
p = Path('sw.js')
sw = p.read_text(encoding='utf-8')
sw = sw.replace("const CACHE_NAME = `${CACHE_PREFIX}v5.0.0-alpha.14-ui-compact-20260913-4`;", "const CACHE_NAME = `${CACHE_PREFIX}v5.0.0-alpha.14-ui-compact-20260913-5`;" )
sw = sw.replace("  './js/v5-groq-search.js', './js/v5-version.js'", "  './js/v3-provider-runtime.js', './js/v3-groq-contracts.js', './js/v3-ai.js', './js/v5-version.js'")
p.write_text(sw.rstrip() + '\n', encoding='utf-8')

# The custom implementation is explicitly retired.
Path('js/v5-groq-search.js').unlink(missing_ok=True)

print('HISTORICAL_AI_SEARCH_RESTORE_OK')
