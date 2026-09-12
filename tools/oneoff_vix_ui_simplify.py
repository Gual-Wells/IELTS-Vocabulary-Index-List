from pathlib import Path
import re


def require_replace(text, old, new, label, count=1):
    found = text.count(old)
    if found != count:
        raise SystemExit(f"{label}: expected {count}, found {found}")
    return text.replace(old, new)


def top_function_span(text, name):
    pattern = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+" + re.escape(name) + r"\s*\(", re.M)
    match = pattern.search(text)
    if not match:
        raise SystemExit(f"function not found: {name}")
    next_match = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(", re.M).search(text, match.end())
    return match.start(), next_match.start() if next_match else len(text)


def remove_top_function(text, name, required=True):
    try:
        start, end = top_function_span(text, name)
    except SystemExit:
        if required:
            raise
        return text
    return text[:start] + text[end:]


def replace_top_function(text, name, replacement):
    start, end = top_function_span(text, name)
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


def remove_import(text, module, required=True):
    pattern = re.compile(r"^import\s+\{[\s\S]*?\}\s+from\s+['\"]" + re.escape(module) + r"['\"];\n", re.M)
    text, count = pattern.subn("", text, count=1)
    if required and count != 1:
        raise SystemExit(f"import {module}: expected 1, found {count}")
    return text


def remove_listener(text, prefix, label):
    start = text.find(prefix)
    if start < 0:
        raise SystemExit(f"{label}: prefix not found")
    pos = start
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    seen_brace = False
    while pos < len(text):
        char = text[pos]
        nxt = text[pos + 1] if pos + 1 < len(text) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
            pos += 1
            continue
        if block_comment:
            if char == "*" and nxt == "/":
                block_comment = False
                pos += 2
                continue
            pos += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            pos += 1
            continue
        if char == "/" and nxt == "/":
            line_comment = True
            pos += 2
            continue
        if char == "/" and nxt == "*":
            block_comment = True
            pos += 2
            continue
        if char in ("'", '"', "`"):
            quote = char
            pos += 1
            continue
        if char == "{":
            depth += 1
            seen_brace = True
        elif char == "}":
            depth -= 1
            if seen_brace and depth == 0:
                end = text.find(");", pos)
                if end < 0:
                    raise SystemExit(f"{label}: listener terminator not found")
                end += 2
                if end < len(text) and text[end] == "\n":
                    end += 1
                return text[:start] + text[end:]
        pos += 1
    raise SystemExit(f"{label}: unterminated listener")


# ---------------- UI ----------------
ui_path = Path("js/v3-ui.js")
ui = ui_path.read_text(encoding="utf-8")
ui = remove_import(ui, "./v3-ai.js")
ui = remove_import(ui, "./v3-provider-runtime.js")
ui = remove_import(ui, "./v3-provider-views.js")
ui = require_replace(
    ui,
    "import { normalizeEnglish, positionScopeDomainId, systemDomainContentCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_CONTENT_ID } from './v3-model.js';\n",
    "import { normalizeEnglish, positionScopeDomainId, systemDomainContentCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID } from './v3-model.js';\n",
    "UI model imports",
)
ui = require_replace(
    ui,
    "import { buildOxfordLookupUrl, createEntryContext } from './v3-integrations.js';\n",
    "import { buildOxfordLookupUrl } from './v3-integrations.js';\n",
    "UI Oxford import",
)
ui = require_replace(
    ui,
    "import {\n  acknowledgeMirrorRun, bridgeConfigured, cacheMirrorFileCatalog, clearBridgeConfig, deleteGroqSecret, deleteMirrorFile, getBridgeConfig,\n  getCachedMirrorFileCatalog, getMirrorFile, getMirrorInbox, listMirrorFiles, saveGroqSecret, saveMirrorFileRecord, setBridgeConfig, testBridgeConfig, uploadMirrorContext, validateGroqSecret,\n} from './v5-bridge.js';\n",
    "import {\n  acknowledgeMirrorRun, bridgeConfigured, cacheMirrorFileCatalog, clearBridgeConfig, deleteMirrorFile, getBridgeConfig,\n  getCachedMirrorFileCatalog, getMirrorFile, getMirrorInbox, listMirrorFiles, saveMirrorFileRecord, setBridgeConfig, testBridgeConfig, uploadMirrorContext,\n} from './v5-bridge.js';\n",
    "UI Bridge imports",
)
ui = require_replace(
    ui,
    "import { deleteGroqSpeechApiKey, requestGroqSpeech, saveGroqSpeechApiKey, speakWithSystemTts, validateGroqSpeechApiKey } from './v5-speech.js';\n",
    "",
    "UI speech import",
)
for line in [
    "let homeGlobalMode = 'structured';\n",
    "let activeProviderQuery = null;\n",
    "let providerQuerySequence = 0;\n",
]:
    ui = ui.replace(line, "")

for function_name in [
    "createLazySpeechSession",
    "startProviderQuery",
    "openAiAddDialog",
    "openAiCheckDialog",
    "startAiCheck",
    "switchHomeGlobalMode",
]:
    ui = remove_top_function(ui, function_name, required=False)

ui = replace_top_function(
    ui,
    "openQueryMenu",
    """function openQueryMenu(entry, _collection, _source) {
  try { openOxfordLookup(entry); } catch (error) { displayError(error); }
}""",
)

ui = replace_top_function(
    ui,
    "toggleHomeMirror",
    """async function toggleHomeMirror(sourceButton) {
  const before = getMirrorState();
  if (!before.current || sourceButton?.dataset.committing === 'true') return;
  sourceButton.dataset.committing = 'true';
  sourceButton.disabled = true;
  try {
    await setMirrorEnabled(!before.enabled);
    showToast(before.enabled ? 'Mirror 已关闭' : 'Mirror 已开启');
  } finally {
    if (sourceButton?.isConnected) {
      const enabled = Boolean(getMirrorState().enabled);
      sourceButton.disabled = false;
      delete sourceButton.dataset.committing;
      sourceButton.classList.toggle('active', enabled);
      sourceButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      sourceButton.title = enabled ? '关闭当前 Mirror' : '开启当前 Mirror';
    }
  }
}""",
)

ui = replace_top_function(
    ui,
    "openBridgeDialog",
    """function openBridgeDialog({ onConfigured = null } = {}) {
  const saved = getBridgeConfig();
  const url = el('input', { type: 'url', value: saved.url, placeholder: 'https://vix-bridge.example.workers.dev', autocomplete: 'url', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' });
  const token = bindCredentialMask(el('input', { type: 'text', className: 'credential-input', value: saved.deviceToken, placeholder: 'Device Token', name: 'vix-opaque-credential', autocomplete: 'off', spellcheck: false, autocorrect: 'off', autocapitalize: 'none' }));
  const test = button('测试', 'secondary-button', async () => {
    const previous = test.textContent;
    test.disabled = true;
    test.textContent = '测试中…';
    try {
      let config = { url: url.value, deviceToken: token.value };
      const result = await testBridgeConfig(config);
      config = applyRecoveredBridgeCredential(config, result, token);
      showToast('Bridge 配置可用');
    } finally {
      test.disabled = false;
      test.textContent = previous;
    }
  });
  const clear = button('清除配置', 'secondary-button', () => {
    clearBridgeConfig();
    url.value = '';
    token.value = '';
    syncCredentialMask(token);
    showToast('Bridge 配置已清除');
  });
  const functionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX-Function.ps1', download: 'VIX-Function.ps1', text: 'VIX Function' });
  const instructionLink = el('a', { className: 'integration-resource-link', href: './integration/vix-function/VIX_PERSONALIZED_INSTRUCTIONS.md', download: 'VIX_PERSONALIZED_INSTRUCTIONS.md', text: '个性化指令' });
  openDialog({
    title: 'Bridge', variant: 'management', submitText: '保存',
    body: [
      field('Bridge URL', url), field('Device Token', token),
      el('div', { className: 'settings-row' }, [test, clear]),
      el('section', { className: 'bridge-integration-resources' }, [el('h3', { text: '集成资源' }), el('div', { className: 'bridge-download-row' }, [functionLink, instructionLink])]),
    ],
    onSubmit: async () => {
      let nextConfig = { url: url.value, deviceToken: token.value };
      const probe = await testBridgeConfig(nextConfig);
      nextConfig = applyRecoveredBridgeCredential(nextConfig, probe, token);
      setBridgeConfig(nextConfig);
      onConfigured?.();
      showToast('Bridge 已保存');
    },
  });
}""",
)

ui = replace_top_function(
    ui,
    "openSettingsDialog",
    """function openSettingsDialog() {
  const state = getState();
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '无序号', selected: state.settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '小标题内编号', selected: state.settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '连续编号', selected: !['none', 'group'].includes(state.settings.numberMode) }),
  ]);
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号', numberMode)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [button('管理词库', 'secondary-button', openLibraryManager)])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [button('数据交换', 'secondary-button', openDataExchangeDialog)])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Bridge' }), el('div', { className: 'settings-row' }, [button('打开 Bridge', 'secondary-button', () => openBridgeDialog())])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Mirror' }), el('div', { className: 'settings-row' }, [button('选择文件', 'secondary-button', openMirrorDialog)])]),
    el('section', { className: 'settings-section settings-version' }, [el('span', { text: 'Vocabulary Index ' + APP_VERSION })]),
  ];
  openDialog({
    title: '设置', body, variant: 'management', submitText: '保存',
    onSubmit: async () => {
      await setNumberMode(numberMode.value);
      showToast('设置已保存');
    },
  });
}""",
)

ui = require_replace(
    ui,
    "function isGlobalCollection(collectionOrId) {\n  const id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id;\n  return [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(id);\n}\n",
    "function isGlobalCollection(collectionOrId) {\n  const id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id;\n  return id === SYSTEM_GLOBAL_WORDS_ID;\n}\n",
    "global collection predicate",
)
ui = ui.replace("  const globalSystem = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collection.id);\n", "  const globalSystem = collection.id === SYSTEM_GLOBAL_WORDS_ID;\n")
ui = ui.replace("  const globalSystemView = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collection.id);\n", "  const globalSystemView = collection.id === SYSTEM_GLOBAL_WORDS_ID;\n")
ui = ui.replace("  scope.append(el('option', { value: 'global:content', text: '全局非结构总表' }));\n", "")
ui = ui.replace("  else if (current.id === SYSTEM_GLOBAL_CONTENT_ID) scope.value = 'global:content';\n", "")
ui = ui.replace("    else if (value === 'global:content') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_CONTENT_ID).map((entry)=>entry.id));\n", "")

ui = ui.replace("  const aiButton = button('AI 联想', 'secondary-button hidden', async () => {});\n", "")
ui = ui.replace("    aiButton.classList.toggle('hidden', !isChineseQuery(query));\n", "")
if "  aiButton.addEventListener('click', async () => {" in ui:
    ui = remove_listener(ui, "  aiButton.addEventListener('click', async () => {", "AI search listener")
ui = require_replace(
    ui,
    "  const searchContent = el('div', { className: 'search-modal-content' }, [el('div', { className: 'search-controls' }, [input, scope, aiButton]), status, results]);\n",
    "  const searchContent = el('div', { className: 'search-modal-content' }, [el('div', { className: 'search-controls' }, [input, scope]), status, results]);\n",
    "search controls",
)

ui = re.sub(r"^.*action === 'ai-(?:add|check)'.*\n", "", ui, flags=re.M)
ui = re.sub(r"^.*button\('AI 新增'.*\n", "", ui, flags=re.M)
ui = re.sub(r"^.*button\('AI 核查'.*\n", "", ui, flags=re.M)

ui = require_replace(
    ui,
    "  const query = iconButton('query', 'entry-query', '查询', () => startProviderQuery('Groq', entry, collection).catch(displayError));\n  const more = iconButton('more', 'entry-more', '更多', () => openEntryActions(entry.id, collection.id));\n  return { refresh, pin, query, more };\n",
    "  const query = iconButton('query', 'entry-query', `在牛津英汉辞书中查询 ${entry.text}`, () => openOxfordLookup(entry));\n  return { refresh, pin, query };\n",
    "entry action buttons",
)
ui = require_replace(
    ui,
    "  const actionItems = [];\n  const oxford = iconButton('dictionary', 'entry-relations', '词典查询', () => openOxfordLookup(entry));\n  actionItems.push(oxford, actions.refresh, actions.pin, actions.query, actions.more);\n",
    "  const actionItems = [actions.refresh, actions.pin, actions.query];\n",
    "entry row actions",
)

ui, removed_icon = re.subn(r"^\s*groq:\s*'.*?',\n", "", ui, count=1, flags=re.M)
if removed_icon != 1:
    raise SystemExit(f"Groq icon: expected 1, found {removed_icon}")
icon_anchor = "  multi: '<circle cx=\"5.2\" cy=\"12\" r=\"2.2\"></circle>"
insert_at = ui.find(icon_anchor)
if insert_at < 0:
    raise SystemExit("Mirror icon insertion anchor not found")
ui = ui[:insert_at] + "  mirror: '<path d=\"M5.2 5.2h5.1v13.6H5.2zM13.7 5.2h5.1v13.6h-5.1z\"></path><path d=\"M12 3.8v16.4\"></path>',\n" + ui[insert_at:]

home_start = ui.find("  const mirrorSnapshot = getMirrorState();\n  const homeActions = [")
home_end = ui.find("  const sections = [el('section', { className: 'index-scope global-scope'", home_start)
if home_start < 0 or home_end < 0:
    raise SystemExit("home global controls block not found")
ui = ui[:home_start] + """  const mirrorSnapshot = getMirrorState();
  const mirrorButton = iconButton('mirror', `icon-button compact home-mirror-button${mirrorSnapshot.enabled ? ' active' : ''}`, mirrorSnapshot.enabled ? '关闭当前 Mirror' : '开启当前 Mirror', (event) => toggleHomeMirror(event.currentTarget), {
    disabled: !mirrorSnapshot.current,
    title: mirrorSnapshot.current ? (mirrorSnapshot.enabled ? '关闭当前 Mirror' : '开启当前 Mirror') : '请先在设置中选择 Mirror 文件',
  });
  mirrorButton.setAttribute('aria-pressed', mirrorSnapshot.enabled ? 'true' : 'false');
  const globalCards = [collectionCard(state.collectionById.get(SYSTEM_GLOBAL_WORDS_ID))];
""" + ui[home_end:]
ui = require_replace(
    ui,
    "  const sections = [el('section', { className: 'index-scope global-scope', dataset: { mode: homeGlobalMode } }, [\n    el('header', { className: 'scope-heading' }, [\n      el('h3', { text: '全局' }),\n      el('div', { className: 'scope-actions' }, [toggleGlobal, ...homeActions]),\n    ]),\n",
    "  const sections = [el('section', { className: 'index-scope global-scope' }, [\n    el('header', { className: 'scope-heading' }, [\n      el('h3', { text: '全局' }),\n      el('div', { className: 'scope-actions' }, [mirrorButton]),\n    ]),\n",
    "home global scope",
)
ui = ui.replace("    homeGlobalMode = 'structured';\n", "")

manager_anchor = "function libraryManagerBody(draft) {\n"
manager_index = ui.find(manager_anchor)
if manager_index < 0:
    raise SystemExit("library manager function not found")
ui = ui[:manager_index] + """function managerEntryRatio(collectionId) {
  const state = getState();
  const occupied = state.structuralProjection?.get(collectionId)?.length || 0;
  const actual = state.projection?.get(collectionId)?.length || 0;
  return `${occupied.toLocaleString()} / ${actual.toLocaleString()}`;
}

""" + ui[manager_index:]
ui = re.sub(
    r"text: getVisibleEntries\(systemDomainWordsCollectionId\(domain\.id\)\)\.length\.toLocaleString\(\)",
    "text: managerEntryRatio(systemDomainWordsCollectionId(domain.id)), title: '占有 Entry / 实际 Entry'",
    ui,
)
ui = require_replace(
    ui,
    "        el('span', { className: 'manager-count', text: collectionCountSummary(collection.id) }),\n",
    "        el('span', { className: 'manager-count', text: managerEntryRatio(collection.id), title: '占有 Entry / 实际 Entry' }),\n",
    "manager normal collection count",
)

# Retire provider/task/query-menu DOM references after provider logic is gone.
ui = ui.replace("  'bottom-toolbar', 'bottom-last-position', 'back-to-top', 'bottom-mode', 'bottom-view-switch', 'bottom-search', 'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',\n",
                "  'bottom-toolbar', 'bottom-last-position', 'back-to-top', 'bottom-mode', 'bottom-view-switch', 'bottom-search', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',\n")
ui = ui.replace("  'home-annotation-banner', 'home-annotation-icon', 'home-annotation-text', 'clear-all-annotations', 'mirror-status-banner', 'mirror-status-text', 'mirror-status-action', 'query-menu', 'relation-target-menu',\n",
                "  'home-annotation-banner', 'home-annotation-icon', 'home-annotation-text', 'clear-all-annotations', 'mirror-status-banner', 'mirror-status-text', 'mirror-status-action', 'relation-target-menu',\n")
ui = replace_top_function(ui, "closeQueryMenu", "function closeQueryMenu() {}")
ui = replace_top_function(ui, "positionQueryMenu", "function positionQueryMenu() {}")
ui = ui.replace("let activeQueryMenu = null;\n", "")
ui = re.sub(r"^.*activeQueryMenu.*\n", "", ui, flags=re.M)
if "  elements['task-capsule'].addEventListener('click', () => {" in ui:
    ui = remove_listener(ui, "  elements['task-capsule'].addEventListener('click', () => {", "task capsule listener")
for function_name in ["renderTaskPanel", "minimizeTaskPanel"]:
    ui = remove_top_function(ui, function_name, required=False)
ui = re.sub(r"^.*elements\['task-(?:capsule|panel)'\].*\n", "", ui, flags=re.M)
ui = replace_top_function(
    ui,
    "openQueryMenu",
    """function openQueryMenu(entry, _collection, _source) {
  try { openOxfordLookup(entry); } catch (error) { displayError(error); }
}""",
)

for forbidden in [
    "Groq", "groq", "SYSTEM_GLOBAL_CONTENT_ID", "v3-ai", "v3-provider", "v3-groq",
    "requestGroq", "suggestSearchTerms", "getSelectedModel", "queryVocabularyEntry", "verifyVocabularyEntry",
]:
    if forbidden in ui:
        raise SystemExit(f"v3-ui still contains retired token: {forbidden}")
ui_path.write_text(ui, encoding="utf-8")


# ---------------- Model ----------------
model_path = Path("js/v3-model.js")
model = model_path.read_text(encoding="utf-8")
model = require_replace(model, "  projection.set(SYSTEM_GLOBAL_CONTENT_ID, []);\n", "", "global content projection init")
model = require_replace(model, "  const globalContent = [];\n", "", "global content array")
model = require_replace(model, "      globalContent.push(entry);\n", "", "global content collect")
model = require_replace(model, "  projection.set(SYSTEM_GLOBAL_CONTENT_ID, globalContent.sort(globalSorter));\n", "", "global content projection final")
model = require_replace(
    model,
    "    if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collectionId)) continue;\n",
    "    if ([SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collectionId)) continue;\n",
    "global projection sorter exclusions",
)
model = require_replace(
    model,
    "    const virtualValid = pin.contextCollectionId === SYSTEM_GLOBAL_WORDS_ID || (entry?.kind === 'phrase' && pin.contextCollectionId === SYSTEM_GLOBAL_PHRASES_ID) || pin.contextCollectionId === SYSTEM_GLOBAL_CONTENT_ID || pin.contextCollectionId === domainTotalId || pin.contextCollectionId === systemDomainContentCollectionId(entry?.domainId || '');\n",
    "    const virtualValid = pin.contextCollectionId === SYSTEM_GLOBAL_WORDS_ID || (entry?.kind === 'phrase' && pin.contextCollectionId === SYSTEM_GLOBAL_PHRASES_ID) || pin.contextCollectionId === domainTotalId || pin.contextCollectionId === systemDomainContentCollectionId(entry?.domainId || '');\n",
    "global content pin validation",
)
model = require_replace(
    model,
    "  const pins = array(input?.pins).map((item, index) => ({\n",
    "  const entryDomainByIdForPins = new Map(entries.map((item) => [item.id, item.domainId]));\n  const pins = array(input?.pins).map((item, index) => ({\n",
    "pin migration map",
)
model = require_replace(
    model,
    "    contextCollectionId: String(item?.contextCollectionId || ''),\n",
    "    contextCollectionId: String(item?.contextCollectionId || '') === SYSTEM_GLOBAL_CONTENT_ID\n      ? systemDomainContentCollectionId(String(item?.domainId || entryDomainByIdForPins.get(String(item?.entryId || '')) || ''))\n      : String(item?.contextCollectionId || ''),\n",
    "legacy global content pin migration",
)
model_path.write_text(model, encoding="utf-8")


# ---------------- Store ----------------
store_path = Path("js/v3-store.js")
store = store_path.read_text(encoding="utf-8")
store = require_replace(
    store,
    "  relationEdgeSuppressed, safeId, searchBackup, systemDomainWordsCollectionId, systemDomainContentCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_CONTENT_ID, tokenizeEnglish, uniqueProjectionCount,\n",
    "  relationEdgeSuppressed, safeId, searchBackup, systemDomainWordsCollectionId, systemDomainContentCollectionId, SYSTEM_GLOBAL_WORDS_ID, tokenizeEnglish, uniqueProjectionCount,\n",
    "store imports",
)
store = require_replace(
    store,
    "  collectionById.set(SYSTEM_GLOBAL_CONTENT_ID, { id: SYSTEM_GLOBAL_CONTENT_ID, domainId: '', name: '全局非结构总表', label: '', type: 'system-global-content', order: -1, hidden: false, virtual: true, createdAt: '', updatedAt: '' });\n",
    "",
    "store global content virtual collection",
)
if "SYSTEM_GLOBAL_CONTENT_ID" in store:
    raise SystemExit("v3-store still references global content aggregate")
store_path.write_text(store, encoding="utf-8")


# ---------------- Oxford-only integration ----------------
Path("js/v3-integrations.js").write_text("""// @ts-check
export const OXFORD_LOOKUP_SCHEME = 'hk-com-oupc-oecd-lookup://x-callback-url/s';

function clean(value) { return String(value ?? '').trim(); }

export function buildOxfordLookupUrl(text) {
  const query = clean(text);
  if (!query) throw new Error('没有可查询的英文');
  return `${OXFORD_LOOKUP_SCHEME}?q=${encodeURIComponent(query)}`;
}
""", encoding="utf-8")


# ---------------- Bridge: Mirror transport only, no Groq ----------------
bridge_path = Path("js/v5-bridge.js")
bridge = bridge_path.read_text(encoding="utf-8")
bridge = require_replace(
    bridge,
    "  const { probeGroq = true, ...requestOptions } = options;\n  const status = await bridgeRequest('/v1/status', { ...requestOptions, config });\n  if (probeGroq && status?.groqState === 'master_key_mismatch') {\n    throw new BridgeError('master_key_mismatch', 'Bridge Master Key 与已保存的 Groq Key 不匹配，请重新保存 Groq Key', 409);\n  }\n  if (probeGroq && status?.groqState === 'unreadable') {\n    throw new BridgeError('groq_secret_unreadable', 'Groq Key 无法解密，请在 Bridge 中重新保存', 409);\n  }\n",
    "  const requestOptions = options;\n  const status = await bridgeRequest('/v1/status', { ...requestOptions, config });\n",
    "Bridge Groq status checks",
)
bridge = require_replace(
    bridge,
    "  if (!probeGroq || !status?.groq) return status;\n  const models = await bridgeRequest('/v1/groq/models', { ...requestOptions, config });\n  const groqModels = Array.isArray(models?.data) ? models.data : [];\n  return { ...status, groqReachable: true, groqModelCount: groqModels.length, groqModels };\n",
    "  return status;\n",
    "Bridge Groq model probe",
)
for function_name in ["saveGroqSecret", "validateGroqSecret", "deleteGroqSecret", "getGroqModels", "requestGroqCompletion"]:
    bridge = remove_top_function(bridge, function_name, required=False)
if re.search(r"groq", bridge, re.I):
    raise SystemExit("v5-bridge still contains Groq")
bridge_path.write_text(bridge, encoding="utf-8")


# ---------------- Remove provider implementation files ----------------
for retired in [
    "js/v3-ai.js",
    "js/v3-groq-contracts.js",
    "js/v3-provider-runtime.js",
    "js/v3-provider-views.js",
    "js/v5-speech.js",
    "css/provider-runtime.css",
]:
    Path(retired).unlink(missing_ok=True)


# ---------------- HTML ----------------
index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
index = index.replace('  <link rel="stylesheet" href="./css/provider-runtime.css">\n', "")
index = re.sub(r'^\s*<button id="task-capsule".*?</button>\n', "", index, flags=re.M)
index = re.sub(r'^\s*<div id="task-panel".*?</div>\n', "", index, flags=re.M)
index = re.sub(r'^\s*<div id="query-menu".*?</div>\n', "", index, flags=re.M)
index_path.write_text(index, encoding="utf-8")


# ---------------- Visual overrides ----------------
css_path = Path("css/v5.0.0.css")
css = css_path.read_text(encoding="utf-8")
css += """

/* 2026-09-13 compact VIX home + entry controls */
.home-mirror-button {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 18%, transparent);
  background: color-mix(in srgb, var(--surface) 86%, var(--accent-soft));
}
.home-mirror-button.active {
  color: var(--accent-ink);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
}
.home-mirror-button .ui-icon { width: 20px; height: 20px; }
.entry-line { grid-template-columns: minmax(0, 1fr) 48px 120px; }
.entry-actions { grid-template-columns: repeat(3, 40px); justify-content: end; }
.entry-actions > button { width: 40px; }
.entry-control-main { justify-content: end; }
@media (max-width: 390px) {
  .entry-line { grid-template-columns: minmax(0, 1fr) 43px 114px; }
  .entry-actions { grid-template-columns: repeat(3, 38px); }
  .entry-actions > button { width: 38px; }
}
"""
css_path.write_text(css, encoding="utf-8")


# ---------------- Service Worker ----------------
sw_path = Path("sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = require_replace(sw, "seed11-word-only-20260912-3", "ui-compact-no-groq-20260913-1", "SW cache generation")
sw = require_replace(
    sw,
    "  './css/provider-runtime.css', './css/v5.0.0.css', './js/v3-provider-runtime.js', './js/v3-groq-contracts.js', './js/v3-provider-views.js',\n",
    "  './css/v5.0.0.css',\n",
    "SW provider precache",
)
sw = require_replace(
    sw,
    "  './js/v3-model.js', './js/v3-import.js', './js/v3-ai.js', './js/v3-exchange.js', './js/v3-integrations.js', './js/v3-data-worker.js',\n",
    "  './js/v3-model.js', './js/v3-import.js', './js/v3-exchange.js', './js/v3-integrations.js', './js/v3-data-worker.js',\n",
    "SW AI precache",
)
sw = sw.replace("  './js/v5-speech.js', './js/v5-version.js'", "  './js/v5-version.js'")
if re.search(r"groq|provider-runtime|v5-speech|v3-ai", sw, re.I):
    raise SystemExit("service worker still references provider assets")
sw_path.write_text(sw, encoding="utf-8")

print("PATCH_OK")
