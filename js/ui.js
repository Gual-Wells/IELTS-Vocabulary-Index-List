import { AI_CHECK_MAX_RETRIES, APP_VERSION, DEFAULT_GROQ_MODEL, LETTERS, MAX_IMPORT_BYTES } from './constants.js';
import { loadSeedBackup } from './db.js';
import {
  checkVocabularyBatch, clearGroqKey, createAiCheckBatches, estimateAiCheckTokens, fetchAvailableModels,
  getCachedModels, getChineseSearchCandidates, getGroqConfig, getModelCatalogState, GroqRequestError,
  recommendedDelayMs, saveGroqConfig, suggestVocabulary,
} from './ai.js';
import {
  exportAllMarkdown, exportCategoryCsv, exportCategoryMarkdown, parseImportContent, validateBackup,
} from './import-export.js';
import { fuzzySearch, searchByCandidates } from './search.js';
import { buildCategoryViewModel, resolveExpandedLetters } from './category-view-model.js';
import {
  addCategory, addWord, clearAnnotations, createFreshBackup, deleteCategory, deleteEntryGlobally,
  dismissAnnotation, editEntry, getAllEntries, getAnnotation, getAnnotations, getCategories, getCategory,
  getCategoryEntries, getEntriesForScope, getEntry, getLastPosition, getPins, getState, importIntoCategory,
  moveCategory, previewImport, redo, reloadStoreFromDatabase, removeEntryFromCategory, renameCategory, restoreBackup,
  saveLastPosition, setNumberMode, subscribe, togglePin, undo, replaceAnnotationsForEntries,
} from './store.js';
import {
  containsHan, copyText, debounce, downloadText, formatDateForFilename, formatPos, groupForWord,
  highlightText, parsePos,
} from './utils.js';

const elements = {};
const uiState = {
  currentCategoryId: null,
  currentEntryId: null,
  pinIndex: 0,
  importParsed: null,
  aiAddCandidates: [],
  aiCheckController: null,
  aiCheckTask: null,
  lastAiCheckIssueIds: [],
  annotationReview: { active: false, entryIds: [], index: 0 },
  aiAddController: null,
  searchController: null,
  currentRender: null,
  renderId: 0,
  navigationId: 0,
  scrollTimer: 0,
  scrollReleaseTimer: 0,
  suppressScrollPersistence: false,
  wordEditUpdatedAt: null,
  importSessionId: 0,
  importTargetCategoryId: null,
};
let toastTimer;
let activeConfirmation = null;
let confirmationSequence = 0;

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

function friendlyErrorMessage(error) {
  if (error instanceof GroqRequestError) {
    if (error.status === 429) {
      const seconds = Math.ceil((error.retryAfterMs || error.rateLimit?.resetTokensMs || 0) / 1000);
      return seconds > 0 ? `Groq 速率额度暂时不足，请等待约 ${seconds} 秒后重试。` : 'Groq 速率额度暂时不足，请稍后重试。';
    }
    if (error.status === 401) return 'Groq API Key 无效或已失效，请在设置中更新。';
    if (error.status === 403) return '当前 Groq Key 无权使用所选模型，请刷新模型列表或更换模型。';
    if (Number(error.status) >= 500) return 'Groq 服务暂时不可用，请稍后重试。';
  }
  return error?.message || String(error);
}

function displayError(error) {
  console.error(error);
  const message = friendlyErrorMessage(error);
  showToast(message, 3200);
  if (/另一个标签页|另一个实例|重新载入最新本地数据/.test(message)) {
    reloadStoreFromDatabase('stale-write').catch((reloadError) => console.error('冲突后重新载入失败', reloadError));
  }
}

function abortableDelay(ms, signal, onTick = null) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let interval = 0;
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(interval);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException('请求已取消', 'AbortError'));
    };
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    if (onTick) {
      onTick(ms);
      interval = setInterval(() => onTick(Math.max(0, ms - (Date.now() - startedAt))), 500);
    }
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function annotationEntryIds(categoryId = null, preferredIds = null) {
  const allowed = preferredIds ? new Set(preferredIds.map(String)) : null;
  const categoryOrder = new Map(getCategories().map((category, index) => [category.id, index]));
  return getAnnotations(categoryId)
    .filter((annotation) => !allowed || allowed.has(annotation.entryId))
    .map((annotation) => getEntry(annotation.entryId))
    .filter(Boolean)
    .sort((a, b) => (categoryOrder.get(a.categoryId) ?? 9999) - (categoryOrder.get(b.categoryId) ?? 9999)
      || a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }))
    .map((entry) => entry.id);
}

function annotationDetail(annotation) {
  if (!annotation) return '';
  const details = [];
  if (annotation.spelling?.incorrect) details.push(`拼写建议：${annotation.spelling.suggestion || '请人工核对'}`);
  if (annotation.pos?.incorrect) details.push(`词性建议：${annotation.pos.suggestion?.length ? formatPos(annotation.pos.suggestion) : '请人工核对'}`);
  if (annotation.reason) details.push(annotation.reason);
  return details.join(' · ');
}

function refreshAnnotationLaunchers() {
  if (!elements['home-review-annotations-button']) return;
  const allCount = getAnnotations().length;
  elements['home-annotation-count'].textContent = String(allCount);
  elements['home-review-annotations-button'].classList.toggle('hidden', allCount === 0);
  const categoryCount = uiState.currentCategoryId ? getAnnotations(uiState.currentCategoryId).length : 0;
  elements['category-annotation-count'].textContent = String(categoryCount);
  elements['annotation-review-button'].classList.toggle('hidden', categoryCount === 0);
}

function refreshRenderedAnnotationBadges() {
  document.querySelectorAll('[data-annotation-entry]').forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    const entryId = button.dataset.annotationEntry;
    button.classList.toggle('hidden', !entryId || !getAnnotation(entryId));
  });
}

function clearAnnotationTargetHighlight() {
  document.querySelectorAll('.annotation-review-target').forEach((row) => row.classList.remove('annotation-review-target'));
}

function closeAnnotationReview() {
  uiState.annotationReview = { active: false, entryIds: [], index: 0 };
  clearAnnotationTargetHighlight();
  elements['annotation-review-bar']?.classList.add('hidden');
  elements['pin-bar']?.classList.remove('review-suppressed');
  if (uiState.currentCategoryId) renderPins();
}

function syncAnnotationReviewList() {
  if (!uiState.annotationReview.active) return false;
  const currentId = uiState.annotationReview.entryIds[uiState.annotationReview.index] ?? null;
  const remaining = uiState.annotationReview.entryIds.filter((id) => getAnnotation(id) && getEntry(id));
  if (!remaining.length) {
    closeAnnotationReview();
    return false;
  }
  uiState.annotationReview.entryIds = remaining;
  const currentIndex = currentId ? remaining.indexOf(currentId) : -1;
  uiState.annotationReview.index = currentIndex >= 0 ? currentIndex : Math.min(uiState.annotationReview.index, remaining.length - 1);
  return true;
}

function renderAnnotationReviewBar() {
  if (!syncAnnotationReviewList()) return;
  const review = uiState.annotationReview;
  const entryId = review.entryIds[review.index];
  const entry = getEntry(entryId);
  const annotation = getAnnotation(entryId);
  if (!entry || !annotation || entry.categoryId !== uiState.currentCategoryId) {
    elements['annotation-review-bar'].classList.add('hidden');
    return;
  }
  elements['annotation-review-counter'].textContent = `${review.index + 1} / ${review.entryIds.length}`;
  elements['annotation-review-word'].textContent = `${entry.word} · ${formatPos(entry.pos)}`;
  elements['annotation-review-detail'].textContent = annotationDetail(annotation);
  elements['annotation-review-prev'].disabled = review.index === 0;
  elements['annotation-review-next'].disabled = review.index >= review.entryIds.length - 1;
  elements['pin-bar'].classList.add('review-suppressed');
  elements['annotation-review-bar'].classList.remove('hidden');
}

async function navigateAnnotationReview(index) {
  if (!syncAnnotationReviewList()) return false;
  const review = uiState.annotationReview;
  review.index = Math.max(0, Math.min(index, review.entryIds.length - 1));
  const entryId = review.entryIds[review.index];
  const entry = getEntry(entryId);
  if (!entry) return false;
  if (entry.categoryId !== uiState.currentCategoryId) await openCategory(entry.categoryId, entry.id);
  else await jumpToEntry(entry.id, false, { persist: false });
  clearAnnotationTargetHighlight();
  document.getElementById(`entry-${entry.id}`)?.classList.add('annotation-review-target');
  renderAnnotationReviewBar();
  return true;
}

async function startAnnotationReview(preferredIds = null) {
  const entryIds = annotationEntryIds(null, preferredIds);
  if (!entryIds.length) {
    showToast('没有可审阅的 AI 标注');
    return false;
  }
  uiState.annotationReview = { active: true, entryIds, index: 0 };
  return navigateAnnotationReview(0);
}


function showModalOnce(dialog) {
  if (!dialog || dialog.open) return false;
  dialog.showModal();
  return true;
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

    const header = document.createElement('span');
    header.className = 'category-card-header';
    const name = document.createElement('span');
    name.className = 'category-card-name';
    name.textContent = category.name;
    const arrow = document.createElement('span');
    arrow.className = 'category-card-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    header.append(name, arrow);

    const meta = document.createElement('span');
    meta.className = 'category-card-meta';
    const count = document.createElement('strong');
    count.className = 'category-card-count';
    count.textContent = (counts.get(category.id) ?? 0).toLocaleString();
    const label = document.createElement('span');
    label.className = 'category-card-label';
    label.textContent = category.label && category.label !== category.name ? category.label : '词汇';
    meta.append(count, label);

    button.append(header, meta);
    elements['category-grid'].append(button);
  }
  refreshAnnotationLaunchers();
}

function refreshHome() {
  renderHome();
  performHomeSearch();
}

function createWordRow(entry, groupIndex, globalIndex, { numberMode, pinnedIds }) {
  const row = document.createElement('div');
  row.className = 'word-row';
  row.id = `entry-${entry.id}`;
  row.dataset.entryId = entry.id;

  const index = document.createElement('span');
  index.className = 'word-index';
  index.textContent = numberMode === 'group' ? `${groupIndex}.` : numberMode === 'global' ? `${globalIndex}.` : '';
  if (numberMode === 'none') index.classList.add('hidden');

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
  menu.textContent = pinnedIds.has(entry.id) ? '📌' : '•••';

  row.append(index, copyButton, annotationButton, menu);
  return row;
}

function isCurrentRender(context) {
  return Boolean(
    context
    && uiState.currentRender === context
    && uiState.currentCategoryId === context.categoryId
    && uiState.renderId === context.id,
  );
}

function populateSection(sectionElement, rows, context) {
  if (!isCurrentRender(context)) return false;
  if (sectionElement.dataset.populated === '1') return true;
  const container = sectionElement.querySelector('.word-list');
  if (!container) return false;

  try {
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      fragment.append(createWordRow(row.entry, row.groupIndex, row.globalIndex, context));
    }
    container.replaceChildren(fragment);
    sectionElement.dataset.populated = '1';
    sectionElement.removeAttribute('data-render-error');
    return true;
  } catch (error) {
    sectionElement.dataset.renderError = '1';
    sectionElement.dataset.populated = '0';
    const message = document.createElement('div');
    message.className = 'section-render-error';
    message.textContent = `此分组渲染失败：${error?.message || error}`;
    container.replaceChildren(message);
    console.error('词汇分组渲染失败', error);
    return false;
  }
}

function setLetterSectionOpen(sectionElement, open, context) {
  if (!isCurrentRender(context)) return false;
  const letter = sectionElement.dataset.letter;
  const panel = sectionElement.querySelector('.word-list');
  const button = sectionElement.querySelector('.letter-summary');
  if (!letter || !panel || !button) return false;

  if (open && !populateSection(sectionElement, context.sectionRows.get(letter) ?? [], context)) return false;
  sectionElement.classList.toggle('is-open', open);
  button.setAttribute('aria-expanded', String(open));
  const indicator = button.querySelector('.letter-indicator');
  if (indicator) indicator.textContent = open ? '−' : '＋';
  panel.hidden = !open;
  if (open) context.expandedGroups.add(letter);
  else context.expandedGroups.delete(letter);

  return true;
}

function sectionForLetter(letter, context = uiState.currentRender) {
  return isCurrentRender(context) ? context.sections.get(letter) ?? null : null;
}

function openLetterSection(letter) {
  const context = uiState.currentRender;
  const section = sectionForLetter(letter, context);
  if (!section) return null;
  return setLetterSectionOpen(section, true, context) ? section : null;
}

function suppressScrollPersistence(duration = 420) {
  uiState.suppressScrollPersistence = true;
  clearTimeout(uiState.scrollReleaseTimer);
  uiState.scrollReleaseTimer = setTimeout(() => {
    uiState.suppressScrollPersistence = false;
    uiState.scrollReleaseTimer = 0;
  }, duration);
}

async function renderCategory({ targetEntryId = null } = {}) {
  const categoryId = uiState.currentCategoryId;
  const category = categoryId ? getCategory(categoryId) : null;
  if (!category) {
    if (categoryId === uiState.currentCategoryId) goHome();
    return false;
  }

  const hasLivePreviousRender = uiState.currentRender?.categoryId === categoryId;
  const previousExpanded = hasLivePreviousRender ? [...uiState.currentRender.expandedGroups] : [];
  const renderId = ++uiState.renderId;
  const entries = getCategoryEntries(categoryId);
  const model = buildCategoryViewModel(entries);
  if (renderId !== uiState.renderId || categoryId !== uiState.currentCategoryId) return false;
  const requestedEntry = targetEntryId ? getEntry(targetEntryId) : null;
  const navigationEntry = requestedEntry?.categoryId === categoryId ? requestedEntry : null;
  const focusNavigation = Boolean(navigationEntry);
  const expandedGroups = resolveExpandedLetters({
    previous: focusNavigation ? [] : previousExpanded,
    availableLetters: model.availableLetters,
    navigationEntry,
    focusNavigation,
    defaultWhenEmpty: false,
  });
  const context = {
    id: renderId,
    categoryId,
    expandedGroups,
    sections: new Map(),
    sectionRows: new Map(model.sections.map((section) => [section.letter, section.rows])),
    numberMode: getState().settings.numberMode,
    pinnedIds: new Set(getPins(categoryId).map((pin) => pin.entryId)),
  };
  uiState.currentRender = context;

  elements['category-title'].textContent = category.name;
  elements['category-count'].textContent = `${entries.length.toLocaleString()} 个全局唯一词汇`;
  elements['app-title'].textContent = category.name;
  elements['app-subtitle'].textContent = `${entries.length.toLocaleString()} 词`;
  document.title = `${category.name} · Vocabulary Index`;

  elements['alphabet-nav'].replaceChildren();
  const available = new Set(model.availableLetters);
  for (const letter of LETTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = letter;
    button.dataset.letter = letter;
    button.disabled = !available.has(letter);
    elements['alphabet-nav'].append(button);
  }

  elements['category-list'].replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '当前词表没有独占词汇。你仍可导入、手动新增，或调整词表优先级。';
    elements['category-list'].append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    for (const sectionModel of model.sections) {
      const section = document.createElement('section');
      section.className = 'letter-section';
      section.id = `letter-${sectionModel.letter === '#' ? 'other' : sectionModel.letter}`;
      section.dataset.letter = sectionModel.letter;

      const summaryButton = document.createElement('button');
      summaryButton.type = 'button';
      summaryButton.className = 'letter-summary';
      summaryButton.id = `${section.id}-button`;
      summaryButton.setAttribute('aria-expanded', 'false');
      summaryButton.setAttribute('aria-controls', `${section.id}-content`);
      const title = document.createElement('span');
      title.textContent = sectionModel.letter;
      const count = document.createElement('span');
      count.className = 'letter-count';
      count.textContent = sectionModel.count.toLocaleString();
      const indicator = document.createElement('span');
      indicator.className = 'letter-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.textContent = '＋';
      summaryButton.append(title, count, indicator);

      const wordList = document.createElement('div');
      wordList.className = 'word-list';
      wordList.id = `${section.id}-content`;
      wordList.setAttribute('role', 'region');
      wordList.setAttribute('aria-labelledby', summaryButton.id);
      wordList.hidden = true;

      summaryButton.addEventListener('click', () => {
        if (!isCurrentRender(context)) return;
        const nextOpen = summaryButton.getAttribute('aria-expanded') !== 'true';
        setLetterSectionOpen(section, nextOpen, context);
      });
      section.append(summaryButton, wordList);
      context.sections.set(sectionModel.letter, section);
      fragment.append(section);
    }
    elements['category-list'].append(fragment);
    for (const letter of expandedGroups) {
      const section = context.sections.get(letter);
      if (section) setLetterSectionOpen(section, true, context);
    }
  }

  renderPins();
  refreshAnnotationLaunchers();
  renderAnnotationReviewBar();
  return true;
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

function cancelScrollPersistence() {
  clearTimeout(uiState.scrollTimer);
  uiState.scrollTimer = 0;
}

async function openCategory(categoryId, targetEntryId = null) {
  if (!getCategory(categoryId)) return false;
  const navigationId = ++uiState.navigationId;
  ++uiState.renderId;
  cancelScrollPersistence();
  uiState.searchController?.abort();
  uiState.currentCategoryId = categoryId;
  uiState.currentEntryId = null;
  uiState.pinIndex = 0;
  uiState.currentRender = null;
  suppressScrollPersistence();
  setView('category');
  window.scrollTo({ top: 0, behavior: 'auto' });

  const rendered = await renderCategory({ targetEntryId });
  if (!rendered || navigationId !== uiState.navigationId || categoryId !== uiState.currentCategoryId) return false;
  if (targetEntryId) await jumpToEntry(targetEntryId, true);
  return true;
}

function goHome() {
  closeAnnotationReview();
  ++uiState.navigationId;
  ++uiState.renderId;
  cancelScrollPersistence();
  uiState.searchController?.abort();
  uiState.currentCategoryId = null;
  uiState.currentEntryId = null;
  uiState.currentRender = null;
  setView('home');
  refreshHome();
  suppressScrollPersistence(120);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function sectionForEntry(entry) {
  return sectionForLetter(groupForWord(entry.word));
}

async function jumpToEntry(entryId, smooth = true, { persist = true } = {}) {
  const entry = getEntry(entryId);
  if (!entry) {
    showToast('词汇已不存在');
    return false;
  }
  if (entry.categoryId !== uiState.currentCategoryId) {
    return openCategory(entry.categoryId, entry.id);
  }
  const context = uiState.currentRender;
  if (!isCurrentRender(context)) return false;
  const section = sectionForEntry(entry);
  if (!section || !setLetterSectionOpen(section, true, context)) return false;
  const row = document.getElementById(`entry-${entry.id}`);
  if (!row) return false;

  suppressScrollPersistence(smooth ? 650 : 360);
  row.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  row.classList.add('copy-flash');
  setTimeout(() => row.classList.remove('copy-flash'), 650);
  if (persist) saveLastPosition(entry.categoryId, entry.id).catch((error) => console.warn('浏览位置保存失败，不影响跳转结果。', error));
  return true;
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
  const controller = new AbortController();
  uiState.searchController = controller;
  const categoryId = uiState.currentCategoryId;
  aiButton.disabled = true;
  status.textContent = '正在生成英语候选并匹配本地词表…';
  try {
    const candidates = await getChineseSearchCandidates(query, controller.signal);
    if (controller.signal.aborted || uiState.searchController !== controller) return;
    const entries = getEntriesForScope(scope, scope === 'all' ? null : categoryId);
    const results = searchByCandidates(entries, candidates, { limit: 100 });
    status.textContent = `AI 生成 ${candidates.length} 个候选；本地匹配 ${results.length} 条`;
    resultsContainer.classList.remove('hidden');
    renderSearchResults(resultsContainer, results, query, { showCategory: scope === 'all' });
  } catch (error) {
    if (error.name !== 'AbortError') displayError(error);
    if (uiState.searchController === controller) status.textContent = error.name === 'AbortError' ? '已取消' : 'AI 搜索失败';
  } finally {
    if (uiState.searchController === controller) {
      uiState.searchController = null;
      aiButton.disabled = false;
    }
  }
}

function dialogSearchScope() {
  const checked = /** @type {HTMLInputElement|null} */ (document.querySelector('input[name="search-scope"]:checked'));
  return checked?.value ?? 'current';
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
  if (elements['search-dialog'].open) return;
  elements['dialog-search-input'].value = '';
  elements['dialog-search-results'].replaceChildren();
  elements['dialog-search-status'].textContent = '';
  const currentRadio = document.querySelector('input[name="search-scope"][value="current"]');
  if (currentRadio) /** @type {HTMLInputElement} */ (currentRadio).checked = Boolean(uiState.currentCategoryId);
  showModalOnce(elements['search-dialog']);
  setTimeout(() => elements['dialog-search-input'].focus(), 80);
}

function openWordDialog(entryId = null) {
  if (elements['word-dialog'].open) return;
  const entry = entryId ? getEntry(entryId) : null;
  elements['word-dialog-title'].textContent = entry ? '编辑词汇' : '新增词汇';
  elements['word-entry-id'].value = entry?.id ?? '';
  uiState.wordEditUpdatedAt = entry?.updatedAt ?? null;
  elements['word-input'].value = entry?.word ?? '';
  elements['pos-input'].value = entry ? formatPos(entry.pos) : '';
  elements['word-form-error'].textContent = '';
  showModalOnce(elements['word-dialog']);
  setTimeout(() => elements['word-input'].focus(), 60);
}

function openEntryMenu(entryId) {
  if (elements['entry-menu-dialog'].open) return;
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
  showModalOnce(elements['entry-menu-dialog']);
}

function cancelActiveConfirmation() {
  confirmationSequence += 1;
  const dialog = elements['confirm-dialog'];
  if (activeConfirmation) {
    dialog?.removeEventListener('close', activeConfirmation.onClose);
    activeConfirmation.resolve(false);
    activeConfirmation = null;
  }
  if (dialog?.open) dialog.close('cancel');
}

function confirmAction(title, message, { danger = true, confirmText = '确认' } = {}) {
  const dialog = elements['confirm-dialog'];
  const sequence = ++confirmationSequence;
  if (activeConfirmation) {
    dialog.removeEventListener('close', activeConfirmation.onClose);
    activeConfirmation.resolve(false);
    activeConfirmation = null;
  }

  return new Promise((resolve) => {
    const open = () => {
      if (sequence !== confirmationSequence) return resolve(false);
      elements['confirm-title'].textContent = title;
      elements['confirm-message'].textContent = message;
      elements['confirm-ok-button'].textContent = confirmText;
      elements['confirm-ok-button'].className = danger ? 'danger-button' : 'primary-button';
      dialog.returnValue = '';
      const onClose = () => {
        if (activeConfirmation?.sequence !== sequence) return;
        dialog.removeEventListener('close', onClose);
        activeConfirmation = null;
        resolve(dialog.returnValue === 'default');
      };
      activeConfirmation = { sequence, resolve, onClose };
      dialog.addEventListener('close', onClose);
      try { dialog.showModal(); }
      catch (error) {
        dialog.removeEventListener('close', onClose);
        activeConfirmation = null;
        console.error('确认对话框打开失败', error);
        resolve(false);
      }
    };

    if (dialog.open) {
      dialog.addEventListener('close', open, { once: true });
      dialog.close('cancel');
    } else queueMicrotask(open);
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
  if (elements['categories-dialog'].open) return;
  renderCategoryManager();
  showModalOnce(elements['categories-dialog']);
}

function formatImportPreview(parsed, mode) {
  if (parsed.errors.length && !parsed.entries.length && !parsed.backup) return `解析失败：\n${parsed.errors.slice(0, 8).join('\n')}`;
  if (mode === 'restore') {
    if (!parsed.backup) return '所选文件不是本工具导出的完整 JSON 备份。';
    validateBackup(parsed.backup);
    return `完整备份\n词表：${parsed.backup.categories?.length ?? 0}\n词汇：${parsed.backup.entries?.length ?? 0}`;
  }
  const stats = previewImport(uiState.importTargetCategoryId, parsed.entries, mode);
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

function openImportDialog({ restoreOnly = false } = {}) {
  if (elements['import-dialog'].open) return;
  if (!restoreOnly && !uiState.currentCategoryId) return showToast('请先打开目标词表');
  uiState.importSessionId += 1;
  uiState.importTargetCategoryId = restoreOnly ? null : uiState.currentCategoryId;
  uiState.importParsed = null;
  elements['import-file'].value = '';
  elements['import-mode'].value = restoreOnly ? 'restore' : 'merge';
  elements['import-mode'].disabled = restoreOnly;
  elements['import-preview'].textContent = restoreOnly ? '请选择本工具导出的完整 JSON 备份。' : '尚未选择文件。';
  elements['import-error'].textContent = '';
  elements['import-confirm-button'].disabled = true;
  showModalOnce(elements['import-dialog']);
}

function openAiAddDialog() {
  if (elements['ai-add-dialog'].open) return;
  if (!uiState.currentCategoryId) return;
  uiState.aiAddController?.abort();
  uiState.aiAddCandidates = [];
  elements['ai-add-query'].value = '';
  elements['ai-add-results'].replaceChildren();
  elements['ai-add-status'].textContent = '';
  elements['ai-add-confirm-button'].disabled = true;
  showModalOnce(elements['ai-add-dialog']);
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
  if (elements['ai-check-dialog'].open) return;
  if (!uiState.currentCategoryId) return;
  elements['ai-check-scope'].value = 'current';
  elements['ai-check-progress'].value = 0;
  elements['ai-check-status'].textContent = '';
  elements['ai-check-batch-metric'].textContent = '尚未开始';
  elements['ai-check-issue-metric'].textContent = '0 条标注';
  elements['ai-check-review-button'].classList.add('hidden');
  elements['ai-check-pause-button'].textContent = '暂停';
  updateAiCheckEstimate();
  showModalOnce(elements['ai-check-dialog']);
}

function updateAiCheckEstimate() {
  const scope = elements['ai-check-scope'].value;
  const entries = getEntriesForScope(scope, uiState.currentCategoryId);
  const batches = createAiCheckBatches(entries);
  const estimatedTokens = batches.reduce((sum, batch) => sum + estimateAiCheckTokens(batch), 0);
  elements['ai-check-estimate'].textContent = `${entries.length.toLocaleString()} 个词汇，将拆分为 ${batches.length} 个串行批次（预计输入约 ${estimatedTokens.toLocaleString()} tokens）。系统会读取 Groq 速率响应头并主动等待。`;
}

function setAiCheckRunning(running) {
  elements['ai-check-start-button'].disabled = running;
  elements['ai-check-cancel-button'].disabled = !running;
  elements['ai-check-pause-button'].disabled = !running;
  elements['ai-check-scope'].disabled = running;
}

function resumeAiCheckTask(task) {
  task.paused = false;
  elements['ai-check-pause-button'].textContent = '暂停';
  for (const resolve of task.resumeResolvers.splice(0)) resolve();
}

function waitForAiCheckResume(task) {
  if (!task.paused) return Promise.resolve();
  elements['ai-check-status'].textContent = '已暂停；已完成批次和标注均已保留。';
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(task.controller.signal.reason ?? new DOMException('请求已取消', 'AbortError'));
    task.resumeResolvers.push(() => {
      task.controller.signal.removeEventListener('abort', onAbort);
      resolve();
    });
    task.controller.signal.addEventListener('abort', onAbort, { once: true });
  });
}

function retryDelayFor(error, attempt) {
  if (error instanceof GroqRequestError) {
    if (error.retryAfterMs > 0) return error.retryAfterMs + 250;
    if (Number(error.rateLimit?.resetTokensMs) > 0) return Number(error.rateLimit.resetTokensMs) + 300;
    const messageDelay = String(error.message ?? '').match(/(?:try again in|等待)\s*(\d+(?:\.\d+)?)\s*s/i);
    if (messageDelay) return Math.ceil(Number(messageDelay[1]) * 1000) + 250;
  }
  return Math.min(15000, 1200 * (2 ** attempt));
}

async function checkBatchWithRetries(batch, task, batchNumber, batchCount) {
  for (let attempt = 0; ; attempt += 1) {
    await waitForAiCheckResume(task);
    try {
      return await checkVocabularyBatch(batch, task.controller.signal);
    } catch (error) {
      const retryable = (error instanceof GroqRequestError
        && (error.status === 429 || (Number(error.status) >= 500 && Number(error.status) <= 599)))
        || error?.name === 'TimeoutError'
        || error instanceof TypeError;
      if (!retryable || attempt >= AI_CHECK_MAX_RETRIES) throw error;
      const delay = retryDelayFor(error, attempt);
      await abortableDelay(delay, task.controller.signal, (remaining) => {
        const seconds = Math.max(1, Math.ceil(remaining / 1000));
        const reason = error.status === 429 ? '等待速率额度恢复' : '服务暂时不可用，准备重试';
        elements['ai-check-status'].textContent = `第 ${batchNumber}/${batchCount} 批：${reason}，${seconds} 秒后重试（${attempt + 1}/${AI_CHECK_MAX_RETRIES}）`;
      });
    }
  }
}

async function runAiCheck() {
  if (uiState.aiCheckTask) return;
  const scope = elements['ai-check-scope'].value;
  const categoryId = uiState.currentCategoryId;
  const entries = getEntriesForScope(scope, categoryId);
  if (!entries.length) return showToast('没有可核查词汇');
  const batches = createAiCheckBatches(entries);
  const controller = new AbortController();
  const task = {
    controller,
    paused: false,
    resumeResolvers: [],
    scope,
    categoryId,
    entries,
    batches,
    issueIds: new Set(),
    checkedIds: new Set(),
  };
  uiState.aiCheckTask = task;
  uiState.aiCheckController = controller;
  uiState.lastAiCheckIssueIds = [];
  setAiCheckRunning(true);
  elements['ai-check-progress'].value = 0;
  elements['ai-check-review-button'].classList.add('hidden');
  elements['ai-check-batch-metric'].textContent = `0 / ${batches.length} 批`;
  elements['ai-check-issue-metric'].textContent = '0 条标注';
  try {
    let previousRateLimit = null;
    for (let index = 0; index < batches.length; index += 1) {
      await waitForAiCheckResume(task);
      const batch = batches[index];
      if (index > 0) {
        const nextCost = estimateAiCheckTokens(batch) + Math.max(700, 420 + batch.length * 28);
        const delay = recommendedDelayMs(previousRateLimit, nextCost);
        await abortableDelay(delay, controller.signal, delay > 1500 ? (remaining) => {
          elements['ai-check-status'].textContent = `第 ${index + 1}/${batches.length} 批将在 ${Math.max(1, Math.ceil(remaining / 1000))} 秒后开始，以避免触发 TPM 限制。`;
        } : null);
      }
      elements['ai-check-status'].textContent = `正在核查第 ${index + 1}/${batches.length} 批（${batch.length} 个词）…`;
      const result = await checkBatchWithRetries(batch, task, index + 1, batches.length);
      previousRateLimit = result.telemetry.rateLimit;
      if (controller.signal.aborted) throw controller.signal.reason ?? new DOMException('请求已取消', 'AbortError');

      const stableIds = new Set(batch.filter((snapshot) => {
        const current = getEntry(snapshot.id);
        return current && current.word === snapshot.word && formatPos(current.pos) === formatPos(snapshot.pos);
      }).map((entry) => entry.id));
      const stableIssues = result.issues.filter((item) => stableIds.has(item.entryId));
      await replaceAnnotationsForEntries([...stableIds], stableIssues);
      for (const id of stableIds) {
        task.checkedIds.add(id);
        task.issueIds.delete(id);
      }
      for (const issue of stableIssues) task.issueIds.add(issue.entryId);

      const completedEntries = batches.slice(0, index + 1).reduce((sum, item) => sum + item.length, 0);
      elements['ai-check-progress'].value = Math.round((completedEntries / entries.length) * 100);
      elements['ai-check-batch-metric'].textContent = `${index + 1} / ${batches.length} 批`;
      elements['ai-check-issue-metric'].textContent = `${task.issueIds.size} 条标注`;
      const remainingRaw = result.telemetry.rateLimit?.remainingTokens;
      const remainingTokens = remainingRaw == null ? Number.NaN : Number(remainingRaw);
      elements['ai-check-status'].textContent = Number.isFinite(remainingTokens)
        ? `第 ${index + 1} 批完成；Groq 本分钟剩余约 ${remainingTokens.toLocaleString()} tokens。`
        : `第 ${index + 1} 批完成；正在按保守间隔继续。`;
    }

    uiState.lastAiCheckIssueIds = annotationEntryIds(null, [...task.checkedIds]);
    elements['ai-check-status'].textContent = `完成：核查 ${entries.length.toLocaleString()} 个词，当前有 ${uiState.lastAiCheckIssueIds.length} 条待审阅标注。未修改任何词汇。`;
    elements['ai-check-review-button'].classList.toggle('hidden', uiState.lastAiCheckIssueIds.length === 0);
    showToast(`AI 核查完成：${uiState.lastAiCheckIssueIds.length} 条待审阅标注`);
    refreshAnnotationLaunchers();
    if (categoryId === uiState.currentCategoryId) await renderCategory();
  } catch (error) {
    uiState.lastAiCheckIssueIds = annotationEntryIds(null, [...task.checkedIds]);
    elements['ai-check-review-button'].classList.toggle('hidden', uiState.lastAiCheckIssueIds.length === 0);
    elements['ai-check-issue-metric'].textContent = `${uiState.lastAiCheckIssueIds.length} 条标注`;
    refreshAnnotationLaunchers();
    if (error.name === 'AbortError') elements['ai-check-status'].textContent = '核查已取消；此前完成的标注仍保留，可直接审阅。';
    else {
      elements['ai-check-status'].textContent = error instanceof GroqRequestError && error.status === 429
        ? '当前模型的 Groq 速率额度仍不足。已保留完成批次，可稍后重新开始或先审阅已有标注。'
        : '核查失败；此前完成的标注仍保留，可直接审阅。';
      displayError(error);
    }
  } finally {
    resumeAiCheckTask(task);
    if (uiState.aiCheckTask === task) uiState.aiCheckTask = null;
    if (uiState.aiCheckController === controller) uiState.aiCheckController = null;
    setAiCheckRunning(false);
  }
}

function toggleAiCheckPause() {
  const task = uiState.aiCheckTask;
  if (!task) return;
  if (task.paused) resumeAiCheckTask(task);
  else {
    task.paused = true;
    elements['ai-check-pause-button'].textContent = '继续';
  }
}

function fillModelSelect(models, selected, activeModels = null) {
  const catalog = [...new Set([...(models ?? []), selected || DEFAULT_GROQ_MODEL])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const active = Array.isArray(activeModels) ? new Set(activeModels) : null;
  elements['groq-model-select'].replaceChildren();
  for (const model of catalog) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = active && !active.has(model) ? `${model}（未在最近刷新中）` : model;
    option.selected = model === selected;
    elements['groq-model-select'].append(option);
  }
}

function formatCatalogUpdatedAt(value) {
  if (!value) return '尚未刷新模型列表；当前选择仍可直接使用。';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '模型列表已缓存。';
  return `已缓存 ${getCachedModels().length} 个模型 · 上次刷新 ${date.toLocaleString()}`;
}

function openSettingsDialog() {
  if (elements['settings-dialog'].open) return;
  const config = getGroqConfig();
  const catalog = getModelCatalogState();
  elements['groq-key-input'].value = config.key;
  fillModelSelect(catalog.models, config.model, catalog.updatedAt ? catalog.activeModels : null);
  elements['groq-model-catalog-meta'].textContent = formatCatalogUpdatedAt(catalog.updatedAt);
  elements['number-mode-select'].value = getState().settings.numberMode;
  elements['groq-settings-status'].textContent = '';
  elements['app-version-text'].textContent = `Vocabulary Index ${APP_VERSION} · IndexedDB · PWA`;
  showModalOnce(elements['settings-dialog']);
}

async function copyEntry(entryId, button) {
  const entry = getEntry(entryId);
  if (!entry) return;
  try {
    await copyText(entry.word);
  } catch (error) {
    displayError(error);
    return;
  }
  button.closest('.word-row')?.classList.add('copy-flash');
  setTimeout(() => button.closest('.word-row')?.classList.remove('copy-flash'), 550);
  showToast(`已复制：${entry.word}`);
  announce(`${entry.word} 已复制到剪贴板`);
  saveLastPosition(entry.categoryId, entry.id).catch((error) => console.warn('浏览位置保存失败，不影响复制结果。', error));
}

async function initializeToSeed() {
  const confirmed = await confirmAction(
    '初始化为内置词库',
    '这会用项目内置 seed 替换当前全部词表、词汇、书签和 AI 标注。操作会写入撤销历史，可以立即撤销；仍建议先导出完整 JSON。',
    { danger: true, confirmText: '确认初始化' },
  );
  if (!confirmed) return;
  elements['home-initialize-seed-button'].disabled = true;
  try {
    const seed = await loadSeedBackup();
    await restoreBackup(seed, { label: '初始化为内置词库' });
    uiState.currentCategoryId = null;
    uiState.currentRender = null;
    setView('home');
    refreshHome();
    showToast('已恢复内置词库，可撤销', 2800);
  } catch (error) { displayError(error); }
  finally { elements['home-initialize-seed-button'].disabled = false; }
}

async function exportFullBackup() {
  try {
    const backup = await createFreshBackup();
    const filename = `vocabulary-backup-${formatDateForFilename()}.json`;
    downloadText(filename, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
    showToast('完整 JSON 备份已生成');
  } catch (error) { displayError(error); }
}

function handleAction(action) {
  if (action === 'search') openSearchDialog();
  else if (action === 'add') openWordDialog();
  else if (action === 'ai-add') openAiAddDialog();
  else if (action === 'ai-check') openAiCheckDialog();
  else if (action === 'import') openImportDialog();
  else if (action === 'category-menu') showModalOnce(elements['category-menu-dialog']);
}

function firstVisibleEntryId(context = uiState.currentRender) {
  if (!isCurrentRender(context)) return null;
  const rows = [...elements['category-list'].querySelectorAll('.letter-section.is-open .word-row')];
  const top = elements['app-header'].getBoundingClientRect().bottom + 5;
  const row = rows.find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > top;
  });
  return row?.dataset.entryId ?? null;
}

function persistScrollPosition() {
  if (uiState.suppressScrollPersistence) return;
  const context = uiState.currentRender;
  if (!isCurrentRender(context)) return;
  cancelScrollPersistence();
  uiState.scrollTimer = setTimeout(() => {
    uiState.scrollTimer = 0;
    if (uiState.suppressScrollPersistence || !isCurrentRender(context)) return;
    const entryId = firstVisibleEntryId(context);
    const entry = entryId ? getEntry(entryId) : null;
    if (entry?.categoryId === context.categoryId) saveLastPosition(context.categoryId, entry.id).catch(console.error);
  }, 500);
}

function closeDataMutationDialogs() {
  cancelActiveConfirmation();
  for (const id of ['word-dialog', 'entry-menu-dialog', 'categories-dialog', 'import-dialog', 'ai-add-dialog', 'ai-check-dialog', 'search-dialog']) {
    const dialog = elements[id];
    if (dialog?.open) dialog.close();
  }
  uiState.aiAddController?.abort();
  uiState.aiCheckController?.abort();
  uiState.searchController?.abort();
}

function bindEvents() {
  elements['back-button'].addEventListener('click', goHome);
  elements['settings-button'].addEventListener('click', openSettingsDialog);
  elements['manage-categories-button'].addEventListener('click', openCategoriesDialog);
  elements['home-review-annotations-button'].addEventListener('click', () => startAnnotationReview().catch(displayError));
  elements['annotation-review-button'].addEventListener('click', () => startAnnotationReview(annotationEntryIds(uiState.currentCategoryId)).catch(displayError));
  elements['annotation-review-prev'].addEventListener('click', () => navigateAnnotationReview(uiState.annotationReview.index - 1).catch(displayError));
  elements['annotation-review-next'].addEventListener('click', () => navigateAnnotationReview(uiState.annotationReview.index + 1).catch(displayError));
  elements['annotation-review-close'].addEventListener('click', closeAnnotationReview);
  elements['annotation-review-edit'].addEventListener('click', () => {
    const entryId = uiState.annotationReview.entryIds[uiState.annotationReview.index];
    if (entryId) openWordDialog(entryId);
  });
  elements['annotation-review-dismiss'].addEventListener('click', async () => {
    const dismissedIndex = uiState.annotationReview.index;
    const entryId = uiState.annotationReview.entryIds[dismissedIndex];
    if (!entryId) return;
    try {
      await dismissAnnotation(entryId);
      if (!syncAnnotationReviewList()) showToast('所有标注均已处理');
      else await navigateAnnotationReview(Math.min(dismissedIndex, uiState.annotationReview.entryIds.length - 1));
      refreshAnnotationLaunchers();
    } catch (error) { displayError(error); }
  });
  elements['home-export-backup-button'].addEventListener('click', exportFullBackup);
  elements['home-restore-backup-button'].addEventListener('click', () => openImportDialog({ restoreOnly: true }));
  elements['home-initialize-seed-button'].addEventListener('click', initializeToSeed);
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
  elements['global-search-input'].addEventListener('input', () => {
    uiState.searchController?.abort();
    debouncedHomeSearch();
  });
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

  document.querySelectorAll('[data-action]').forEach((element) => {
    const button = /** @type {HTMLButtonElement} */ (element);
    button.addEventListener('click', () => handleAction(button.dataset.action));
  });
  elements['alphabet-nav'].addEventListener('click', (event) => {
    const button = event.target.closest('[data-letter]');
    if (!button || button.disabled) return;
    const section = openLetterSection(button.dataset.letter);
    if (section) { suppressScrollPersistence(650); section.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
    if (pin) jumpToEntry(pin.entryId).catch(displayError);
  });

  const debouncedDialogSearch = debounce(performDialogSearch, 150);
  elements['dialog-search-input'].addEventListener('input', () => {
    uiState.searchController?.abort();
    debouncedDialogSearch();
  });
  document.querySelectorAll('input[name="search-scope"]').forEach((radio) => radio.addEventListener('change', () => {
    uiState.searchController?.abort();
    performDialogSearch();
  }));
  elements['dialog-ai-search-button'].addEventListener('click', () => runChineseSearch(
    elements['dialog-search-input'].value.trim(), dialogSearchScope(), elements['dialog-search-status'],
    elements['dialog-search-results'], elements['dialog-ai-search-button'],
  ));
  elements['dialog-search-results'].addEventListener('click', (event) => {
    const result = event.target.closest('[data-search-entry]');
    if (!result) return;
    elements['search-dialog'].close();
    jumpToEntry(result.dataset.searchEntry).catch(displayError);
  });

  elements['word-form'].addEventListener('submit', async (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    if (elements['word-save-button'].disabled) return;
    const entryId = elements['word-entry-id'].value;
    const categoryId = uiState.currentCategoryId;
    elements['word-save-button'].disabled = true;
    try {
      parsePos(elements['pos-input'].value);
      const result = entryId
        ? await editEntry(entryId, elements['word-input'].value, elements['pos-input'].value, { expectedUpdatedAt: uiState.wordEditUpdatedAt })
        : await addWord(categoryId, elements['word-input'].value, elements['pos-input'].value);
      elements['word-dialog'].close();
      showToast(entryId ? '词汇已更新' : '词汇已新增或合并');
      if (result.entry.categoryId !== uiState.currentCategoryId) await openCategory(result.entry.categoryId, result.entry.id);
      else {
        await renderCategory({ targetEntryId: result.entry.id });
        await jumpToEntry(result.entry.id, false);
      }
      refreshAnnotationLaunchers();
      if (uiState.annotationReview.active && syncAnnotationReviewList()) {
        await navigateAnnotationReview(uiState.annotationReview.index);
      }
    } catch (error) { elements['word-form-error'].textContent = error.message; }
    finally { elements['word-save-button'].disabled = false; }
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
    const category = currentCategory();
    if (!entry || !category) return;
    const sourceCount = Object.keys(entry.sources ?? {}).length;
    const message = sourceCount > 1
      ? `移除 ${entry.word} 在 ${category.name} 中的来源后，它会自动归入下一个优先词表。`
      : `移除 ${entry.word} 后，它将因没有其他来源而被删除。`;
    elements['entry-menu-dialog'].close();
    if (!await confirmAction('从当前词表移除', message)) return;
    try { await removeEntryFromCategory(entry.id, category.id); await renderCategory(); showToast('已移除，可撤销'); }
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
    try {
      await dismissAnnotation(uiState.currentEntryId);
      elements['entry-menu-dialog'].close();
      await renderCategory();
      showToast('标注已取消');
    } catch (error) { displayError(error); }
  });

  elements['category-menu-dialog'].addEventListener('click', async (event) => {
    const button = event.target.closest('[data-menu-action]');
    if (!button) return;
    const action = button.dataset.menuAction;
    elements['category-menu-dialog'].close();
    try {
      if (action === 'import') openImportDialog();
      else if (action === 'export-current-md' || action === 'export-current-csv') {
        const category = currentCategory();
        if (!category) return;
        const entries = getCategoryEntries(category.id);
        if (action === 'export-current-md') {
          downloadText(`${category.name}.md`, exportCategoryMarkdown(category, entries), 'text/markdown;charset=utf-8');
        } else {
          downloadText(`${category.name}.csv`, exportCategoryCsv(entries), 'text/csv;charset=utf-8');
        }
      } else if (action === 'clear-annotations') {
        const categoryId = uiState.currentCategoryId;
        const count = getAnnotations(categoryId).length;
        if (!count) return showToast('当前词表没有 AI 标注');
        if (await confirmAction('清除 AI 标注', `清除当前词表的 ${count} 条标注？此操作不影响词汇。`)) {
          await clearAnnotations(categoryId);
          if (categoryId === uiState.currentCategoryId) await renderCategory();
          showToast('标注已清除');
        }
      } else if (action === 'jump-last') {
        const categoryId = uiState.currentCategoryId;
        const id = await getLastPosition(categoryId);
        const entry = id ? getEntry(id) : null;
        if (entry?.categoryId === categoryId) await jumpToEntry(id);
        else showToast('尚无有效浏览位置');
      } else if (action === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { displayError(error); }
  });

  elements['categories-dialog'].addEventListener('change', async (event) => {
    const input = event.target.closest('[data-rename-category]');
    if (!input) return;
    try { await renameCategory(input.dataset.renameCategory, input.value); renderCategoryManager(); refreshHome(); }
    catch (error) { displayError(error); renderCategoryManager(); }
  });
  elements['category-manager-list'].addEventListener('click', async (event) => {
    const move = event.target.closest('[data-move-category]');
    if (move) {
      const row = move.closest('[data-category-id]');
      try { await moveCategory(row.dataset.categoryId, Number(move.dataset.moveCategory)); renderCategoryManager(); refreshHome(); }
      catch (error) { displayError(error); }
      return;
    }
    const del = event.target.closest('[data-delete-category]');
    if (del) {
      const category = getCategory(del.dataset.deleteCategory);
      if (!category) return;
      if (!await confirmAction('删除词表', `删除 ${category.name}。其中有其他来源的词会回落到下一个词表；无其他来源的词会删除。操作可撤销。`)) return;
      try { await deleteCategory(category.id); renderCategoryManager(); refreshHome(); }
      catch (error) { displayError(error); }
    }
  });
  elements['add-category-button'].addEventListener('click', async () => {
    const name = window.prompt('新词表名称');
    if (name == null) return;
    try { await addCategory(name); renderCategoryManager(); refreshHome(); }
    catch (error) { displayError(error); }
  });

  elements['import-dialog'].addEventListener('close', () => {
    uiState.importSessionId += 1;
    uiState.importParsed = null;
    uiState.importTargetCategoryId = null;
    elements['import-mode'].disabled = false;
  });
  elements['import-file'].addEventListener('change', async () => {
    const file = elements['import-file'].files?.[0];
    const sessionId = ++uiState.importSessionId;
    uiState.importParsed = null;
    elements['import-confirm-button'].disabled = true;
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('导入文件超过 64 MB，已拒绝在移动端加载');
      const text = await file.text();
      if (sessionId !== uiState.importSessionId || !elements['import-dialog'].open) return;
      uiState.importParsed = parseImportContent(file.name, text);
      refreshImportPreview();
    } catch (error) {
      if (sessionId === uiState.importSessionId && elements['import-dialog'].open) {
        elements['import-error'].textContent = error.message;
      }
    }
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
        await restoreBackup(parsed.backup, { label: '恢复完整 JSON 备份' });
      } else {
        const targetCategoryId = uiState.importTargetCategoryId;
        if (!targetCategoryId || !getCategory(targetCategoryId)) throw new Error('导入目标词表已不存在，请重新选择文件');
        await importIntoCategory(targetCategoryId, parsed.entries, mode);
      }
      elements['import-dialog'].close();
      renderHome();
      if (uiState.currentCategoryId) await renderCategory();
      showToast('导入完成，可撤销');
    } catch (error) { elements['import-error'].textContent = error.message; }
    finally { elements['import-confirm-button'].disabled = false; }
  });

  elements['ai-add-query'].addEventListener('input', () => {
    uiState.aiAddController?.abort();
    uiState.aiAddCandidates = [];
    elements['ai-add-results'].replaceChildren();
    elements['ai-add-confirm-button'].disabled = true;
    elements['ai-add-status'].textContent = '';
  });
  elements['ai-add-query-button'].addEventListener('click', async () => {
    const query = elements['ai-add-query'].value.trim();
    if (!query) return showToast('请输入查询内容');
    uiState.aiAddController?.abort();
    const controller = new AbortController();
    uiState.aiAddController = controller;
    elements['ai-add-query-button'].disabled = true;
    elements['ai-add-status'].textContent = '正在生成候选…';
    try {
      const candidates = await suggestVocabulary(query, controller.signal);
      if (controller.signal.aborted || uiState.aiAddController !== controller
          || elements['ai-add-query'].value.trim() !== query) return;
      uiState.aiAddCandidates = candidates;
      renderAiAddCandidates(candidates);
      elements['ai-add-status'].textContent = `生成 ${candidates.length} 个候选`;
    } catch (error) {
      if (error.name !== 'AbortError') { displayError(error); elements['ai-add-status'].textContent = '生成失败'; }
    } finally {
      if (uiState.aiAddController === controller) {
        uiState.aiAddController = null;
        elements['ai-add-query-button'].disabled = false;
      }
    }
  });
  elements['ai-add-results'].addEventListener('change', () => {
    elements['ai-add-confirm-button'].disabled = !elements['ai-add-results'].querySelector('input:checked');
  });
  elements['ai-add-confirm-button'].addEventListener('click', async () => {
    const selected = [...elements['ai-add-results'].querySelectorAll('input:checked')]
      .map((input) => uiState.aiAddCandidates[Number(input.dataset.candidateIndex)]).filter(Boolean);
    if (!selected.length) return;
    elements['ai-add-confirm-button'].disabled = true;
    try {
      const categoryId = uiState.currentCategoryId;
      const stats = await importIntoCategory(categoryId, selected, 'merge');
      elements['ai-add-dialog'].close();
      if (categoryId === uiState.currentCategoryId) await renderCategory();
      showToast(`AI 候选已处理：新增 ${stats.created}，合并 ${stats.merged}`);
    } catch (error) { displayError(error); }
    finally { elements['ai-add-confirm-button'].disabled = false; }
  });

  elements['ai-check-scope'].addEventListener('change', updateAiCheckEstimate);
  elements['ai-check-start-button'].addEventListener('click', runAiCheck);
  elements['ai-check-pause-button'].addEventListener('click', toggleAiCheckPause);
  elements['ai-check-cancel-button'].addEventListener('click', () => uiState.aiCheckController?.abort());
  elements['ai-check-review-button'].addEventListener('click', () => {
    elements['ai-check-dialog'].close();
    startAnnotationReview(uiState.lastAiCheckIssueIds).catch(displayError);
  });
  elements['ai-add-dialog'].addEventListener('close', () => uiState.aiAddController?.abort());
  elements['ai-check-dialog'].addEventListener('close', () => uiState.aiCheckController?.abort());
  elements['search-dialog'].addEventListener('close', () => uiState.searchController?.abort());

  elements['load-models-button'].addEventListener('click', async () => {
    elements['load-models-button'].disabled = true;
    elements['groq-settings-status'].textContent = '正在读取模型列表…';
    try {
      saveGroqConfig({ key: elements['groq-key-input'].value, model: elements['groq-model-select'].value });
      const models = await fetchAvailableModels();
      const catalog = getModelCatalogState();
      fillModelSelect(catalog.models, getGroqConfig().model, catalog.activeModels);
      elements['groq-model-catalog-meta'].textContent = formatCatalogUpdatedAt(catalog.updatedAt);
      elements['groq-settings-status'].textContent = `已刷新并保存 ${models.length} 个文本模型；下次打开设置无需重新读取。`;
    } catch (error) { elements['groq-settings-status'].textContent = error.message; }
    finally { elements['load-models-button'].disabled = false; }
  });
  elements['save-groq-button'].addEventListener('click', () => {
    try {
      saveGroqConfig({ key: elements['groq-key-input'].value, model: elements['groq-model-select'].value });
      const catalog = getModelCatalogState();
      fillModelSelect(catalog.models, getGroqConfig().model, catalog.updatedAt ? catalog.activeModels : null);
      elements['groq-model-catalog-meta'].textContent = formatCatalogUpdatedAt(catalog.updatedAt);
      elements['groq-settings-status'].textContent = 'Groq 设置和当前模型已保存在当前浏览器';
    } catch (error) { elements['groq-settings-status'].textContent = error.message; }
  });
  elements['clear-groq-button'].addEventListener('click', () => {
    try {
      clearGroqKey(); elements['groq-key-input'].value = ''; elements['groq-settings-status'].textContent = 'API Key 已删除';
    } catch (error) { elements['groq-settings-status'].textContent = error.message; }
  });
  elements['number-mode-select'].addEventListener('change', async () => {
    const requestedMode = elements['number-mode-select'].value;
    elements['number-mode-select'].disabled = true;
    try {
      await setNumberMode(requestedMode);
      if (uiState.currentCategoryId) await renderCategory();
    } catch (error) {
      displayError(error);
      elements['number-mode-select'].value = getState().settings.numberMode;
    } finally {
      elements['number-mode-select'].disabled = false;
    }
  });
  elements['export-backup-button'].addEventListener('click', exportFullBackup);
  elements['export-all-md-button'].addEventListener('click', () => {
    downloadText(`vocabulary-all-${formatDateForFilename()}.md`, exportAllMarkdown(getCategories(), getAllEntries()), 'text/markdown;charset=utf-8');
  });
  elements['reload-app-button'].addEventListener('click', () => location.reload());
  window.addEventListener('scroll', persistScrollPosition, { passive: true });
}

export async function initializeUI() {
  cacheElements();
  bindEvents();
  subscribe(({ type, detail }) => {
    updateHistoryButtons();
    refreshAnnotationLaunchers();
    if (type === 'annotations') refreshRenderedAnnotationBadges();
    if (uiState.annotationReview.active && type !== 'external-change') renderAnnotationReviewBar();
    if (type === 'external-change') {
      closeDataMutationDialogs();
      refreshHome();
      if (uiState.currentCategoryId && getCategory(uiState.currentCategoryId)) {
        renderCategory().catch(displayError);
      } else if (uiState.currentCategoryId) goHome();
      if (detail?.reason === 'broadcast' || detail?.reason === 'stale-write') {
        showToast('已载入另一页面的最新本地修改', 1800);
      }
    }
  });
  refreshHome();
  updateHistoryButtons();
  setView('home');
  elements.app.setAttribute('aria-busy', 'false');
}
