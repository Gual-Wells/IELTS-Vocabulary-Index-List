import { AI_CHECK_BATCH_SIZE, APP_VERSION, DEFAULT_GROQ_MODEL, LETTERS } from './constants.js';
import {
  checkVocabularyBatch, clearGroqKey, fetchAvailableModels, getChineseSearchCandidates,
  getGroqConfig, saveGroqConfig, suggestVocabulary,
} from './ai.js';
import {
  exportAllMarkdown, exportCategoryCsv, exportCategoryMarkdown, parseImportContent, validateBackup,
} from './import-export.js';
import { fuzzySearch, searchByCandidates } from './search.js';
import {
  addCategory, addWord, applyAnnotations, clearAnnotations, createBackup, deleteCategory, deleteEntryGlobally,
  dismissAnnotation, editEntry, getAllEntries, getAnnotation, getAnnotations, getCategories, getCategory,
  getCategoryEntries, getEntriesForScope, getEntry, getExpandedGroups, getLastPosition, getPins, getState, importIntoCategory,
  moveCategory, previewImport, redo, removeEntryFromCategory, renameCategory, restoreBackup, saveExpandedGroups,
  saveLastPosition, setNumberMode, subscribe, togglePin, undo, replaceAnnotationsForEntries,
} from './store.js';
import {
  containsHan, copyText, debounce, downloadText, formatDateForFilename, formatPos, groupForWord,
  highlightText, parsePos, throttle,
} from './utils.js';

const elements = {};
const uiState = {
  currentCategoryId: null,
  currentEntryId: null,
  pinIndex: 0,
  importParsed: null,
  importFilename: '',
  aiAddCandidates: [],
  aiCheckController: null,
  currentRenderedGroups: new Set(),
  searchController: null,
};
let toastTimer;

function cacheElements() {
  document.querySelectorAll('[id]').forEach((element) => { elements[element.id] = element; });
}

function showToast(message, duration = 2200) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), duration);
}

function announce(message) {
  elements['live-region'].textContent = '';
  requestAnimationFrame(() => { elements['live-region'].textContent = message; });
}

function displayError(error) {
  console.error(error);
  showToast(error?.message || String(error), 3200);
}

function currentCategory() {
  return uiState.currentCategoryId ? getCategory(uiState.currentCategoryId) : null;
}

function setView(view) {
  const home = view === 'home';
  elements['home-view'].classList.toggle('hidden', !home);
  elements['category-view'].classList.toggle('hidden', home);
  elements['back-button'].classList.toggle('hidden', home);
  elements['mobile-action-bar'].classList.toggle('hidden', home);
  if (home) {
    elements['app-title'].textContent = 'Vocabulary Index';
    elements['app-subtitle'].textContent = '本地词汇索引';
    document.title = 'Vocabulary Index';
  }
}

function updateHistoryButtons() {
  const { history } = getState();
  elements['undo-button'].disabled = !history.canUndo;
  elements['redo-button'].disabled = !history.canRedo;
}

function categoryCountMap() {
  const map = new Map(getCategories().map((category) => [category.id, 0]));
  for (const entry of getAllEntries()) map.set(entry.categoryId, (map.get(entry.categoryId) ?? 0) + 1);
  return map;
}

function renderHome() {
  const categories = getCategories();
  const counts = categoryCountMap();
  const total = getAllEntries().length;
  elements['home-summary'].textContent = `${categories.length} 个词表 · ${total.toLocaleString()} 个全局唯一词汇`;
  elements['category-grid'].replaceChildren();
  for (const category of categories) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-card';
    button.dataset.categoryId = category.id;

    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'category-card-name';
    name.textContent = category.name;
    const label = document.createElement('span');
    label.className = 'category-card-label';
    label.textContent = category.label && category.label !== category.name ? category.label : '词汇索引';
    text.append(name, label);

    const count = document.createElement('span');
    count.className = 'category-card-count';
    count.textContent = `${(counts.get(category.id) ?? 0).toLocaleString()} 词`;
    button.append(text, count);
    elements['category-grid'].append(button);
  }
}

function groupEntries(entries) {
  const groups = new Map(LETTERS.map((letter) => [letter, []]));
  for (const entry of entries) groups.get(groupForWord(entry.word)).push(entry);
  for (const list of groups.values()) list.sort((a, b) => a.normalizedWord.localeCompare(b.normalizedWord));
  return groups;
}

function createWordRow(entry, groupIndex, globalIndex) {
  const row = document.createElement('div');
  row.className = 'word-row';
  row.id = `entry-${entry.id}`;
  row.dataset.entryId = entry.id;

  const index = document.createElement('span');
  index.className = 'word-index';
  const mode = getState().settings.numberMode;
  index.textContent = mode === 'group' ? `${groupIndex}.` : mode === 'global' ? `${globalIndex}.` : '';
  if (mode === 'none') index.classList.add('hidden');

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.className = 'word-copy-button';
  copyButton.dataset.copyEntry = entry.id;
  copyButton.setAttribute('aria-label', `复制 ${entry.word}`);
  const word = document.createElement('span');
  word.className = 'word-text';
  word.textContent = entry.word;
  const pos = document.createElement('span');
  pos.className = 'word-pos';
  pos.textContent = formatPos(entry.pos);
  copyButton.append(word, pos);

  const annotation = getAnnotation(entry.id);
  const annotationButton = document.createElement('button');
  annotationButton.type = 'button';
  annotationButton.className = 'annotation-badge';
  annotationButton.dataset.annotationEntry = entry.id;
  annotationButton.textContent = '待核查';
  annotationButton.classList.toggle('hidden', !annotation);

  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'row-menu-button';
  menu.dataset.menuEntry = entry.id;
  menu.setAttribute('aria-label', `${entry.word} 的更多操作`);
  menu.textContent = getPins(entry.categoryId).some((pin) => pin.entryId === entry.id) ? '📌' : '•••';

  row.append(index, copyButton, annotationButton, menu);
  return row;
}

function populateSection(details, letter, entries, globalIndexes) {
  if (details.dataset.populated === '1') return;
  details.dataset.populated = '1';
  const container = details.querySelector('.word-list');
  let cursor = 0;
  const token = `${Date.now()}-${Math.random()}`;
  details.dataset.renderToken = token;
  const renderBatch = () => {
    if (details.dataset.renderToken !== token || !details.isConnected) return;
    const fragment = document.createDocumentFragment();
    const end = Math.min(cursor + 240, entries.length);
    for (; cursor < end; cursor += 1) {
      const entry = entries[cursor];
      fragment.append(createWordRow(entry, cursor + 1, globalIndexes.get(entry.id)));
    }
    container.append(fragment);
    if (cursor < entries.length) requestAnimationFrame(renderBatch);
  };
  renderBatch();
}

async function renderCategory({ restorePosition = false } = {}) {
  const category = currentCategory();
  if (!category) return goHome();
  const entries = getCategoryEntries(category.id);
  elements['category-title'].textContent = category.name;
  elements['category-count'].textContent = `${entries.length.toLocaleString()} 个全局唯一词汇`;
  elements['app-title'].textContent = category.name;
  elements['app-subtitle'].textContent = `${entries.length.toLocaleString()} 词`;
  document.title = `${category.name} · Vocabulary Index`;

  const groups = groupEntries(entries);
  const globalIndexes = new Map(entries.map((entry, index) => [entry.id, index + 1]));
  const savedExpanded = new Set(await getExpandedGroups(category.id));
  if (!savedExpanded.size && entries.length) savedExpanded.add(groupForWord(entries[0].word));
  uiState.currentRenderedGroups = savedExpanded;

  elements['alphabet-nav'].replaceChildren();
  for (const letter of LETTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = letter;
    button.dataset.letter = letter;
    button.disabled = !groups.get(letter).length;
    elements['alphabet-nav'].append(button);
  }

  elements['category-list'].replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '当前词表没有独占词汇。你仍可导入、手动新增，或调整词表优先级。';
    elements['category-list'].append(empty);
  } else {
    for (const letter of LETTERS) {
      const list = groups.get(letter);
      if (!list.length) continue;
      const details = document.createElement('details');
      details.className = 'letter-section';
      details.id = `letter-${letter === '#' ? 'other' : letter}`;
      details.dataset.letter = letter;
      details.open = savedExpanded.has(letter);
      const summary = document.createElement('summary');
      const title = document.createElement('span');
      title.textContent = letter;
      const count = document.createElement('span');
      count.className = 'letter-count';
      count.textContent = list.length.toLocaleString();
      summary.append(title, count);
      const wordList = document.createElement('div');
      wordList.className = 'word-list';
      details.append(summary, wordList);
      details.addEventListener('toggle', () => {
        if (details.open) {
          uiState.currentRenderedGroups.add(letter);
          populateSection(details, letter, list, globalIndexes);
        } else uiState.currentRenderedGroups.delete(letter);
        saveExpandedGroups(category.id, uiState.currentRenderedGroups).catch(console.error);
      });
      // The section must be connected before lazy population begins. Otherwise
      // populateSection exits on !details.isConnected and the open group stays empty.
      elements['category-list'].append(details);
      if (details.open) populateSection(details, letter, list, globalIndexes);
    }
  }
  renderPins();
  if (restorePosition) {
    const entryId = await getLastPosition(category.id);
    if (entryId && getEntry(entryId)?.categoryId === category.id) setTimeout(() => jumpToEntry(entryId, false), 80);
  }
}

function renderPins() {
  const category = currentCategory();
  if (!category) return;
  const pins = getPins(category.id);
  elements['pin-bar'].classList.toggle('hidden', pins.length === 0);
  if (!pins.length) { uiState.pinIndex = 0; return; }
  uiState.pinIndex = Math.max(0, Math.min(uiState.pinIndex, pins.length - 1));
  const pin = pins[uiState.pinIndex];
  const entry = getEntry(pin.entryId);
  elements['pin-current-button'].textContent = entry ? `📌 ${entry.word}` : '书签已失效';
  elements['pin-counter'].textContent = `${uiState.pinIndex + 1}/${pins.length}`;
}

async function openCategory(categoryId, targetEntryId = null) {
  if (!getCategory(categoryId)) return;
  uiState.currentCategoryId = categoryId;
  uiState.pinIndex = 0;
  setView('category');
  window.scrollTo({ top: 0, behavior: 'auto' });
  await renderCategory({ restorePosition: !targetEntryId });
  if (targetEntryId) setTimeout(() => jumpToEntry(targetEntryId, true), 80);
}

function goHome() {
  uiState.currentCategoryId = null;
  uiState.currentEntryId = null;
  setView('home');
  renderHome();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function sectionForEntry(entry) {
  const letter = groupForWord(entry.word);
  return document.getElementById(`letter-${letter === '#' ? 'other' : letter}`);
}

function jumpToEntry(entryId, smooth = true) {
  const entry = getEntry(entryId);
  if (!entry) return showToast('词汇已不存在');
  if (entry.categoryId !== uiState.currentCategoryId) {
    openCategory(entry.categoryId, entry.id).catch(displayError);
    return;
  }
  const section = sectionForEntry(entry);
  if (!section) return;
  section.open = true;
  requestAnimationFrame(() => {
    const attempt = (count = 0) => {
      const row = document.getElementById(`entry-${entry.id}`);
      if (row) {
        row.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
        row.classList.add('copy-flash');
        setTimeout(() => row.classList.remove('copy-flash'), 650);
        saveLastPosition(entry.categoryId, entry.id).catch(console.error);
      } else if (count < 20) requestAnimationFrame(() => attempt(count + 1));
    };
    attempt();
  });
}

function renderSearchResults(container, results, query, { showCategory = true } = {}) {
  container.replaceChildren();
  if (!results.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '没有找到匹配词汇。';
    container.append(empty);
    return;
  }
  for (const entry of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    button.dataset.searchEntry = entry.id;
    const main = document.createElement('span');
    main.className = 'search-result-main';
    const word = document.createElement('span');
    word.className = 'search-result-word';
    word.append(highlightText(entry.word, containsHan(query) ? entry.matchedCandidate ?? '' : query));
    const pos = document.createElement('span');
    pos.className = 'search-result-pos';
    pos.textContent = formatPos(entry.pos);
    main.append(word, pos);
    button.append(main);
    if (showCategory) {
      const tag = document.createElement('span');
      tag.className = 'category-tag';
      tag.textContent = getCategory(entry.categoryId)?.name ?? '未知';
      button.append(tag);
    }
    container.append(button);
  }
}

function performHomeSearch() {
  const query = elements['global-search-input'].value.trim();
  const chinese = containsHan(query);
  elements['global-ai-search-button'].classList.toggle('hidden', !chinese || !query);
  if (!query || chinese) {
    elements['global-search-results'].classList.add('hidden');
    elements['global-search-results'].replaceChildren();
    elements['global-search-status'].textContent = chinese ? '中文需要点击“AI 中文联想”，再匹配本地英语词汇。' : '';
    return;
  }
  const results = fuzzySearch(getAllEntries(), query, { limit: 80 });
  elements['global-search-results'].classList.remove('hidden');
  elements['global-search-status'].textContent = `找到 ${results.length} 条最相关结果`;
  renderSearchResults(elements['global-search-results'], results, query, { showCategory: true });
}

async function runChineseSearch(query, scope, status, resultsContainer, aiButton) {
  if (!query) return;
  uiState.searchController?.abort();
  uiState.searchController = new AbortController();
  aiButton.disabled = true;
  status.textContent = '正在生成英语候选并匹配本地词表…';
  try {
    const candidates = await getChineseSearchCandidates(query, uiState.searchController.signal);
    const entries = getEntriesForScope(scope, uiState.currentCategoryId);
    const results = searchByCandidates(entries, candidates, { limit: 100 });
    status.textContent = `AI 生成 ${candidates.length} 个候选；本地匹配 ${results.length} 条`;
    resultsContainer.classList.remove('hidden');
    renderSearchResults(resultsContainer, results, query, { showCategory: scope === 'all' });
  } catch (error) {
    if (error.name !== 'AbortError') displayError(error);
    status.textContent = error.name === 'AbortError' ? '已取消' : 'AI 搜索失败';
  } finally {
    aiButton.disabled = false;
  }
}

function dialogSearchScope() {
  return document.querySelector('input[name="search-scope"]:checked')?.value ?? 'current';
}

function performDialogSearch() {
  const query = elements['dialog-search-input'].value.trim();
  const scope = dialogSearchScope();
  const chinese = containsHan(query);
  elements['dialog-ai-search-button'].classList.toggle('hidden', !chinese || !query);
  if (!query || chinese) {
    elements['dialog-search-results'].replaceChildren();
    elements['dialog-search-status'].textContent = chinese ? '点击“AI 联想”生成可能的英语词汇，再匹配本地数据。' : '';
    return;
  }
  const results = fuzzySearch(getEntriesForScope(scope, uiState.currentCategoryId), query, { limit: 100 });
  elements['dialog-search-status'].textContent = `找到 ${results.length} 条最相关结果`;
  renderSearchResults(elements['dialog-search-results'], results, query, { showCategory: scope === 'all' });
}

function openSearchDialog() {
  elements['dialog-search-input'].value = '';
  elements['dialog-search-results'].replaceChildren();
  elements['dialog-search-status'].textContent = '';
  const currentRadio = document.querySelector('input[name="search-scope"][value="current"]');
  if (currentRadio) currentRadio.checked = Boolean(uiState.currentCategoryId);
  elements['search-dialog'].showModal();
  setTimeout(() => elements['dialog-search-input'].focus(), 80);
}

function openWordDialog(entryId = null) {
  const entry = entryId ? getEntry(entryId) : null;
  elements['word-dialog-title'].textContent = entry ? '编辑词汇' : '新增词汇';
  elements['word-entry-id'].value = entry?.id ?? '';
  elements['word-input'].value = entry?.word ?? '';
  elements['pos-input'].value = entry ? formatPos(entry.pos) : '';
  elements['word-form-error'].textContent = '';
  elements['word-dialog'].showModal();
  setTimeout(() => elements['word-input'].focus(), 60);
}

function openEntryMenu(entryId) {
  const entry = getEntry(entryId);
  if (!entry) return;
  uiState.currentEntryId = entryId;
  elements['entry-menu-word'].textContent = entry.word;
  elements['entry-menu-pos'].textContent = formatPos(entry.pos);
  const pinned = getPins(entry.categoryId).some((pin) => pin.entryId === entry.id);
  elements['entry-pin-button'].textContent = pinned ? '取消固定书签' : '固定为书签';
  const sourceCount = Object.keys(entry.sources ?? {}).length;
  elements['entry-remove-source-button'].textContent = sourceCount > 1 ? '从当前词表移除并回落' : '从当前词表移除';
  const annotation = getAnnotation(entry.id);
  elements['annotation-panel'].classList.toggle('hidden', !annotation);
  elements['annotation-content'].replaceChildren();
  if (annotation) {
    const parts = [];
    if (annotation.spelling?.incorrect) parts.push(`拼写建议：${annotation.spelling.suggestion || '需人工核对'}`);
    if (annotation.pos?.incorrect) parts.push(`词性建议：${formatPos(annotation.pos.suggestion) || '需人工核对'}`);
    if (annotation.reason) parts.push(annotation.reason);
    for (const text of parts) {
      const p = document.createElement('p');
      p.textContent = text;
      elements['annotation-content'].append(p);
    }
  }
  elements['entry-menu-dialog'].showModal();
}

function confirmAction(title, message, { danger = true, confirmText = '确认' } = {}) {
  return new Promise((resolve) => {
    elements['confirm-title'].textContent = title;
    elements['confirm-message'].textContent = message;
    elements['confirm-ok-button'].textContent = confirmText;
    elements['confirm-ok-button'].className = danger ? 'danger-button' : 'primary-button';
    const dialog = elements['confirm-dialog'];
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'default');
    };
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}

function renderCategoryManager() {
  const categories = getCategories();
  elements['category-manager-list'].replaceChildren();
  categories.forEach((category, index) => {
    const row = document.createElement('div');
    row.className = 'category-manager-row';
    row.dataset.categoryId = category.id;
    const input = document.createElement('input');
    input.value = category.name;
    input.maxLength = 40;
    input.setAttribute('aria-label', `重命名 ${category.name}`);
    input.dataset.renameCategory = category.id;
    const up = document.createElement('button');
    up.type = 'button'; up.textContent = '↑'; up.title = '提高优先级'; up.dataset.moveCategory = '-1'; up.disabled = index === 0;
    const down = document.createElement('button');
    down.type = 'button'; down.textContent = '↓'; down.title = '降低优先级'; down.dataset.moveCategory = '1'; down.disabled = index === categories.length - 1;
    const del = document.createElement('button');
    del.type = 'button'; del.textContent = '×'; del.title = '删除词表'; del.dataset.deleteCategory = category.id;
    row.append(input, up, down, del);
    elements['category-manager-list'].append(row);
  });
}

function openCategoriesDialog() {
  renderCategoryManager();
  elements['categories-dialog'].showModal();
}

function formatImportPreview(parsed, mode) {
  if (parsed.errors.length && !parsed.entries.length && !parsed.backup) return `解析失败：\n${parsed.errors.slice(0, 8).join('\n')}`;
  if (mode === 'restore') {
    if (!parsed.backup) return '所选文件不是本工具导出的完整 JSON 备份。';
    return `完整备份\n词表：${parsed.backup.categories?.length ?? 0}\n词汇：${parsed.backup.entries?.length ?? 0}`;
  }
  const stats = previewImport(uiState.currentCategoryId, parsed.entries, mode);
  const lines = [
    `格式：${parsed.format}`,
    `解析后的文件内唯一词汇：${stats.input}`,
    `全新词汇：${stats.created}`,
    `与全局现有词汇合并：${stats.merged}`,
    `因当前词表优先级更高而移动到当前词表：${stats.movedToCurrent}`,
  ];
  if (mode === 'replace') lines.push(`将移除当前词表的旧来源：${stats.removedSources}`, `无其他来源而删除：${stats.deleted}`);
  lines.push(`提交后当前词表显示：${stats.finalCanonicalCount}`);
  if (parsed.errors.length) lines.push(`忽略的异常行：${parsed.errors.length}`, ...parsed.errors.slice(0, 5));
  return lines.join('\n');
}

function refreshImportPreview() {
  const mode = elements['import-mode'].value;
  if (!uiState.importParsed) {
    elements['import-preview'].textContent = '尚未选择文件。';
    elements['import-confirm-button'].disabled = true;
    return;
  }
  try {
    elements['import-preview'].textContent = formatImportPreview(uiState.importParsed, mode);
    const valid = mode === 'restore' ? Boolean(uiState.importParsed.backup) : uiState.importParsed.entries.length > 0;
    elements['import-confirm-button'].disabled = !valid;
    elements['import-error'].textContent = '';
  } catch (error) {
    elements['import-error'].textContent = error.message;
    elements['import-confirm-button'].disabled = true;
  }
}

function openImportDialog() {
  if (!uiState.currentCategoryId) return showToast('请先打开目标词表');
  uiState.importParsed = null;
  uiState.importFilename = '';
  elements['import-file'].value = '';
  elements['import-mode'].value = 'merge';
  elements['import-preview'].textContent = '尚未选择文件。';
  elements['import-error'].textContent = '';
  elements['import-confirm-button'].disabled = true;
  elements['import-dialog'].showModal();
}

function openAiAddDialog() {
  if (!uiState.currentCategoryId) return;
  uiState.aiAddCandidates = [];
  elements['ai-add-query'].value = '';
  elements['ai-add-results'].replaceChildren();
  elements['ai-add-status'].textContent = '';
  elements['ai-add-confirm-button'].disabled = true;
  elements['ai-add-dialog'].showModal();
}

function renderAiAddCandidates(items) {
  elements['ai-add-results'].replaceChildren();
  items.forEach((item, index) => {
    const label = document.createElement('label');
    label.className = 'candidate-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.candidateIndex = String(index);
    const text = document.createElement('span');
    const word = document.createElement('strong');
    word.textContent = item.word;
    const pos = document.createElement('span');
    pos.className = 'word-pos';
    pos.textContent = formatPos(item.pos);
    text.append(word, pos);
    label.append(checkbox, text);
    elements['ai-add-results'].append(label);
  });
  elements['ai-add-confirm-button'].disabled = !items.length;
}

function openAiCheckDialog() {
  if (!uiState.currentCategoryId) return;
  elements['ai-check-scope'].value = 'current';
  elements['ai-check-progress'].style.width = '0%';
  elements['ai-check-status'].textContent = '';
  updateAiCheckEstimate();
  elements['ai-check-dialog'].showModal();
}

function updateAiCheckEstimate() {
  const scope = elements['ai-check-scope'].value;
  const count = getEntriesForScope(scope, uiState.currentCategoryId).length;
  const batches = Math.ceil(count / AI_CHECK_BATCH_SIZE);
  elements['ai-check-estimate'].textContent = `${count.toLocaleString()} 个词汇，约 ${batches} 个请求批次。已存在标注会被更新，未报错词条不会新增标注。`;
}

async function runAiCheck() {
  const scope = elements['ai-check-scope'].value;
  const entries = getEntriesForScope(scope, uiState.currentCategoryId);
  if (!entries.length) return showToast('没有可核查词汇');
  uiState.aiCheckController?.abort();
  uiState.aiCheckController = new AbortController();
  elements['ai-check-start-button'].disabled = true;
  elements['ai-check-cancel-button'].disabled = false;
  let issueCount = 0;
  try {
    for (let offset = 0; offset < entries.length; offset += AI_CHECK_BATCH_SIZE) {
      const batch = entries.slice(offset, offset + AI_CHECK_BATCH_SIZE);
      elements['ai-check-status'].textContent = `核查 ${offset + 1}–${Math.min(offset + batch.length, entries.length)} / ${entries.length}`;
      const issues = await checkVocabularyBatch(batch, uiState.aiCheckController.signal);
      await replaceAnnotationsForEntries(batch.map((entry) => entry.id), issues);
      issueCount += issues.length;
      const progress = Math.round(Math.min(100, ((offset + batch.length) / entries.length) * 100));
      elements['ai-check-progress'].style.width = `${progress}%`;
    }
    elements['ai-check-status'].textContent = `完成：生成或更新 ${issueCount} 条可疑标注。未修改任何词汇。`;
    showToast(`AI 核查完成：${issueCount} 条标注`);
    await renderCategory();
  } catch (error) {
    if (error.name === 'AbortError') elements['ai-check-status'].textContent = '请求已取消；此前完成的标注仍保留。';
    else { elements['ai-check-status'].textContent = '核查失败'; displayError(error); }
  } finally {
    elements['ai-check-start-button'].disabled = false;
    elements['ai-check-cancel-button'].disabled = true;
    uiState.aiCheckController = null;
  }
}

function fillModelSelect(models, selected) {
  const values = [...new Set([selected || DEFAULT_GROQ_MODEL, DEFAULT_GROQ_MODEL, ...models])];
  elements['groq-model-select'].replaceChildren();
  for (const model of values) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    option.selected = model === selected;
    elements['groq-model-select'].append(option);
  }
}

function openSettingsDialog() {
  const config = getGroqConfig();
  elements['groq-key-input'].value = config.key;
  fillModelSelect([], config.model);
  elements['number-mode-select'].value = getState().settings.numberMode;
  elements['groq-settings-status'].textContent = '';
  elements['app-version-text'].textContent = `Vocabulary Index ${APP_VERSION} · IndexedDB · PWA`;
  elements['settings-dialog'].showModal();
}

async function copyEntry(entryId, button) {
  const entry = getEntry(entryId);
  if (!entry) return;
  try {
    await copyText(entry.word);
    button.closest('.word-row')?.classList.add('copy-flash');
    setTimeout(() => button.closest('.word-row')?.classList.remove('copy-flash'), 550);
    showToast(`已复制：${entry.word}`);
    announce(`${entry.word} 已复制到剪贴板`);
    await saveLastPosition(entry.categoryId, entry.id);
  } catch (error) { displayError(error); }
}

function handleAction(action) {
  if (action === 'search') openSearchDialog();
  else if (action === 'add') openWordDialog();
  else if (action === 'ai-add') openAiAddDialog();
  else if (action === 'ai-check') openAiCheckDialog();
  else if (action === 'import') openImportDialog();
  else if (action === 'category-menu') elements['category-menu-dialog'].showModal();
}

function firstVisibleEntryId() {
  const rows = [...document.querySelectorAll('.word-row')];
  const top = elements['app-header'].getBoundingClientRect().bottom + 5;
  const row = rows.find((item) => item.getBoundingClientRect().bottom > top);
  return row?.dataset.entryId ?? null;
}

const persistScrollPosition = throttle(() => {
  if (!uiState.currentCategoryId) return;
  const entryId = firstVisibleEntryId();
  if (entryId) saveLastPosition(uiState.currentCategoryId, entryId).catch(console.error);
}, 500);

function bindEvents() {
  elements['back-button'].addEventListener('click', goHome);
  elements['settings-button'].addEventListener('click', openSettingsDialog);
  elements['manage-categories-button'].addEventListener('click', openCategoriesDialog);
  elements['undo-button'].addEventListener('click', async () => {
    try { const record = await undo(); if (record) { showToast(`已撤销：${record.label}`); if (uiState.currentCategoryId && getCategory(uiState.currentCategoryId)) await renderCategory(); else goHome(); } }
    catch (error) { displayError(error); }
  });
  elements['redo-button'].addEventListener('click', async () => {
    try { const record = await redo(); if (record) { showToast(`已重做：${record.label}`); if (uiState.currentCategoryId && getCategory(uiState.currentCategoryId)) await renderCategory(); else goHome(); } }
    catch (error) { displayError(error); }
  });

  elements['category-grid'].addEventListener('click', (event) => {
    const card = event.target.closest('[data-category-id]');
    if (card) openCategory(card.dataset.categoryId).catch(displayError);
  });

  const debouncedHomeSearch = debounce(performHomeSearch, 160);
  elements['global-search-input'].addEventListener('input', debouncedHomeSearch);
  elements['global-ai-search-button'].addEventListener('click', () => runChineseSearch(
    elements['global-search-input'].value.trim(), 'all', elements['global-search-status'],
    elements['global-search-results'], elements['global-ai-search-button'],
  ));
  elements['global-search-results'].addEventListener('click', (event) => {
    const result = event.target.closest('[data-search-entry]');
    if (!result) return;
    const entry = getEntry(result.dataset.searchEntry);
    if (entry) openCategory(entry.categoryId, entry.id).catch(displayError);
  });

  document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));
  elements['alphabet-nav'].addEventListener('click', (event) => {
    const button = event.target.closest('[data-letter]');
    if (!button || button.disabled) return;
    const section = document.getElementById(`letter-${button.dataset.letter === '#' ? 'other' : button.dataset.letter}`);
    if (section) { section.open = true; section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  elements['category-list'].addEventListener('click', (event) => {
    const copyButton = event.target.closest('[data-copy-entry]');
    if (copyButton) return void copyEntry(copyButton.dataset.copyEntry, copyButton);
    const menuButton = event.target.closest('[data-menu-entry]');
    if (menuButton) return openEntryMenu(menuButton.dataset.menuEntry);
    const annotation = event.target.closest('[data-annotation-entry]');
    if (annotation) openEntryMenu(annotation.dataset.annotationEntry);
  });

  elements['pin-prev-button'].addEventListener('click', () => {
    const pins = getPins(uiState.currentCategoryId);
    if (!pins.length) return;
    uiState.pinIndex = (uiState.pinIndex - 1 + pins.length) % pins.length;
    renderPins();
  });
  elements['pin-next-button'].addEventListener('click', () => {
    const pins = getPins(uiState.currentCategoryId);
    if (!pins.length) return;
    uiState.pinIndex = (uiState.pinIndex + 1) % pins.length;
    renderPins();
  });
  elements['pin-current-button'].addEventListener('click', () => {
    const pin = getPins(uiState.currentCategoryId)[uiState.pinIndex];
    if (pin) jumpToEntry(pin.entryId);
  });

  const debouncedDialogSearch = debounce(performDialogSearch, 150);
  elements['dialog-search-input'].addEventListener('input', debouncedDialogSearch);
  document.querySelectorAll('input[name="search-scope"]').forEach((radio) => radio.addEventListener('change', performDialogSearch));
  elements['dialog-ai-search-button'].addEventListener('click', () => runChineseSearch(
    elements['dialog-search-input'].value.trim(), dialogSearchScope(), elements['dialog-search-status'],
    elements['dialog-search-results'], elements['dialog-ai-search-button'],
  ));
  elements['dialog-search-results'].addEventListener('click', (event) => {
    const result = event.target.closest('[data-search-entry]');
    if (!result) return;
    elements['search-dialog'].close();
    jumpToEntry(result.dataset.searchEntry);
  });

  elements['word-form'].addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const entryId = elements['word-entry-id'].value;
    try {
      parsePos(elements['pos-input'].value);
      if (entryId) await editEntry(entryId, elements['word-input'].value, elements['pos-input'].value);
      else await addWord(uiState.currentCategoryId, elements['word-input'].value, elements['pos-input'].value);
      elements['word-dialog'].close();
      showToast(entryId ? '词汇已更新' : '词汇已新增或合并');
      await renderCategory();
    } catch (error) { elements['word-form-error'].textContent = error.message; }
  });

  elements['entry-edit-button'].addEventListener('click', () => {
    const id = uiState.currentEntryId;
    elements['entry-menu-dialog'].close();
    openWordDialog(id);
  });
  elements['entry-pin-button'].addEventListener('click', async () => {
    try {
      const pinned = await togglePin(uiState.currentEntryId);
      elements['entry-menu-dialog'].close();
      showToast(pinned ? '已固定书签' : '已取消书签');
      await renderCategory();
    } catch (error) { displayError(error); }
  });
  elements['entry-remove-source-button'].addEventListener('click', async () => {
    const entry = getEntry(uiState.currentEntryId);
    if (!entry) return;
    const sourceCount = Object.keys(entry.sources ?? {}).length;
    const message = sourceCount > 1
      ? `移除 ${entry.word} 在 ${currentCategory().name} 中的来源后，它会自动归入下一个优先词表。`
      : `移除 ${entry.word} 后，它将因没有其他来源而被删除。`;
    elements['entry-menu-dialog'].close();
    if (!await confirmAction('从当前词表移除', message)) return;
    try { await removeEntryFromCategory(entry.id, uiState.currentCategoryId); await renderCategory(); showToast('已移除，可撤销'); }
    catch (error) { displayError(error); }
  });
  elements['entry-delete-global-button'].addEventListener('click', async () => {
    const entry = getEntry(uiState.currentEntryId);
    if (!entry) return;
    elements['entry-menu-dialog'].close();
    if (!await confirmAction('全局删除词汇', `这会从所有词表来源中删除 ${entry.word}。操作可撤销。`)) return;
    try { await deleteEntryGlobally(entry.id); await renderCategory(); showToast('已全局删除，可撤销'); }
    catch (error) { displayError(error); }
  });
  elements['annotation-dismiss-button'].addEventListener('click', async () => {
    await dismissAnnotation(uiState.currentEntryId);
    elements['entry-menu-dialog'].close();
    await renderCategory();
    showToast('标注已取消');
  });

  elements['category-menu-dialog'].addEventListener('click', async (event) => {
    const button = event.target.closest('[data-menu-action]');
    if (!button) return;
    const action = button.dataset.menuAction;
    elements['category-menu-dialog'].close();
    if (action === 'import') openImportDialog();
    else if (action === 'export-current') {
      const category = currentCategory();
      const entries = getCategoryEntries(category.id);
      downloadText(`${category.name}.md`, exportCategoryMarkdown(category, entries), 'text/markdown;charset=utf-8');
      downloadText(`${category.name}.csv`, exportCategoryCsv(entries), 'text/csv;charset=utf-8');
    } else if (action === 'clear-annotations') {
      const count = getAnnotations(uiState.currentCategoryId).length;
      if (!count) return showToast('当前词表没有 AI 标注');
      if (await confirmAction('清除 AI 标注', `清除当前词表的 ${count} 条标注？此操作不影响词汇。`)) {
        await clearAnnotations(uiState.currentCategoryId); await renderCategory(); showToast('标注已清除');
      }
    } else if (action === 'jump-last') {
      const id = await getLastPosition(uiState.currentCategoryId); if (id) jumpToEntry(id); else showToast('尚无浏览位置');
    } else if (action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  elements['categories-dialog'].addEventListener('change', async (event) => {
    const input = event.target.closest('[data-rename-category]');
    if (!input) return;
    try { await renameCategory(input.dataset.renameCategory, input.value); renderCategoryManager(); renderHome(); }
    catch (error) { displayError(error); renderCategoryManager(); }
  });
  elements['category-manager-list'].addEventListener('click', async (event) => {
    const move = event.target.closest('[data-move-category]');
    if (move) {
      const row = move.closest('[data-category-id]');
      try { await moveCategory(row.dataset.categoryId, Number(move.dataset.moveCategory)); renderCategoryManager(); renderHome(); }
      catch (error) { displayError(error); }
      return;
    }
    const del = event.target.closest('[data-delete-category]');
    if (del) {
      const category = getCategory(del.dataset.deleteCategory);
      if (!category) return;
      if (!await confirmAction('删除词表', `删除 ${category.name}。其中有其他来源的词会回落到下一个词表；无其他来源的词会删除。操作可撤销。`)) return;
      try { await deleteCategory(category.id); renderCategoryManager(); renderHome(); }
      catch (error) { displayError(error); }
    }
  });
  elements['add-category-button'].addEventListener('click', async () => {
    const name = window.prompt('新词表名称');
    if (name == null) return;
    try { await addCategory(name); renderCategoryManager(); renderHome(); }
    catch (error) { displayError(error); }
  });

  elements['import-file'].addEventListener('change', async () => {
    const file = elements['import-file'].files?.[0];
    if (!file) return;
    try {
      uiState.importFilename = file.name;
      uiState.importParsed = parseImportContent(file.name, await file.text());
      refreshImportPreview();
    } catch (error) { elements['import-error'].textContent = error.message; }
  });
  elements['import-mode'].addEventListener('change', refreshImportPreview);
  elements['import-confirm-button'].addEventListener('click', async () => {
    const parsed = uiState.importParsed;
    const mode = elements['import-mode'].value;
    if (!parsed) return;
    elements['import-confirm-button'].disabled = true;
    try {
      if (mode === 'restore') {
        validateBackup(parsed.backup);
        if (!await confirmAction('恢复完整备份', '这会用备份内容替换当前全部词表和词汇。操作会写入撤销历史。')) return;
        await restoreBackup(parsed.backup);
      } else await importIntoCategory(uiState.currentCategoryId, parsed.entries, mode);
      elements['import-dialog'].close();
      renderHome();
      if (uiState.currentCategoryId) await renderCategory();
      showToast('导入完成，可撤销');
    } catch (error) { elements['import-error'].textContent = error.message; }
    finally { elements['import-confirm-button'].disabled = false; }
  });

  elements['ai-add-query-button'].addEventListener('click', async () => {
    const query = elements['ai-add-query'].value.trim();
    if (!query) return showToast('请输入查询内容');
    elements['ai-add-query-button'].disabled = true;
    elements['ai-add-status'].textContent = '正在生成候选…';
    try {
      uiState.aiAddCandidates = await suggestVocabulary(query);
      renderAiAddCandidates(uiState.aiAddCandidates);
      elements['ai-add-status'].textContent = `生成 ${uiState.aiAddCandidates.length} 个候选`;
    } catch (error) { displayError(error); elements['ai-add-status'].textContent = '生成失败'; }
    finally { elements['ai-add-query-button'].disabled = false; }
  });
  elements['ai-add-results'].addEventListener('change', () => {
    elements['ai-add-confirm-button'].disabled = !elements['ai-add-results'].querySelector('input:checked');
  });
  elements['ai-add-confirm-button'].addEventListener('click', async () => {
    const selected = [...elements['ai-add-results'].querySelectorAll('input:checked')]
      .map((input) => uiState.aiAddCandidates[Number(input.dataset.candidateIndex)]).filter(Boolean);
    if (!selected.length) return;
    try {
      const stats = await importIntoCategory(uiState.currentCategoryId, selected, 'merge');
      elements['ai-add-dialog'].close();
      await renderCategory();
      showToast(`AI 候选已处理：新增 ${stats.created}，合并 ${stats.merged}`);
    } catch (error) { displayError(error); }
  });

  elements['ai-check-scope'].addEventListener('change', updateAiCheckEstimate);
  elements['ai-check-start-button'].addEventListener('click', runAiCheck);
  elements['ai-check-cancel-button'].addEventListener('click', () => uiState.aiCheckController?.abort());

  elements['load-models-button'].addEventListener('click', async () => {
    elements['load-models-button'].disabled = true;
    elements['groq-settings-status'].textContent = '正在读取模型列表…';
    try {
      saveGroqConfig({ key: elements['groq-key-input'].value, model: elements['groq-model-select'].value });
      const models = await fetchAvailableModels();
      fillModelSelect(models, getGroqConfig().model);
      elements['groq-settings-status'].textContent = `读取到 ${models.length} 个文本模型`;
    } catch (error) { elements['groq-settings-status'].textContent = error.message; }
    finally { elements['load-models-button'].disabled = false; }
  });
  elements['save-groq-button'].addEventListener('click', () => {
    saveGroqConfig({ key: elements['groq-key-input'].value, model: elements['groq-model-select'].value });
    elements['groq-settings-status'].textContent = 'Groq 设置已保存在当前浏览器';
  });
  elements['clear-groq-button'].addEventListener('click', () => {
    clearGroqKey(); elements['groq-key-input'].value = ''; elements['groq-settings-status'].textContent = 'API Key 已删除';
  });
  elements['number-mode-select'].addEventListener('change', async () => {
    await setNumberMode(elements['number-mode-select'].value);
    if (uiState.currentCategoryId) await renderCategory();
  });
  elements['export-backup-button'].addEventListener('click', () => {
    const filename = `vocabulary-backup-${formatDateForFilename()}.json`;
    downloadText(filename, JSON.stringify(createBackup(), null, 2), 'application/json;charset=utf-8');
  });
  elements['export-all-md-button'].addEventListener('click', () => {
    downloadText(`vocabulary-all-${formatDateForFilename()}.md`, exportAllMarkdown(getCategories(), getAllEntries()), 'text/markdown;charset=utf-8');
  });
  elements['reload-app-button'].addEventListener('click', () => location.reload());
  window.addEventListener('scroll', persistScrollPosition, { passive: true });
}

export async function initializeUI() {
  cacheElements();
  bindEvents();
  subscribe(async ({ type }) => {
    updateHistoryButtons();
    if (type === 'settings' && uiState.currentCategoryId) await renderCategory();
  });
  renderHome();
  updateHistoryButtons();
  setView('home');
  elements.app.setAttribute('aria-busy', 'false');
}
