import {
  acknowledgeMigrationNotice, addCollection, addDomain, addEntry, addPhraseForWord,
  clearAnnotationsForCollection, deleteCollection, deleteDomain, deleteEntry, dismissAnnotation,
  editEntry, editEntryInCollection, exportFullBackup, getLastPosition, getPhraseComponents, getRelatedPhrases, getState,
  getPinsForCollection, getVisibleEntries, importEntries, initializeStore, moveCollection, redo,
  removeEntryFromCollection, renameCollection, renameDomain, replaceAnnotations, restoreBackup,
  search, setDomainGlossEnabled, setLastPosition, setNumberMode, subscribe, togglePin, undo,
} from './v3-store.js';
import {
  AiCheckController, checkEntries, createAiCheckBatches, getApiKey, getModelCatalog, getModelCatalogUpdatedAt,
  getSelectedModel, refreshModels, selectModel, setApiKey, suggestEntries, suggestSearchTerms,
} from './v3-ai.js';
import {
  downloadText, entriesToCsv, readImportFile,
} from './v3-import.js';
import { normalizeEnglish, systemPhraseCollectionId } from './v3-model.js';

const APP_VERSION = '3.0.0';
/** @type {Record<string, any>} */
const elements = Object.fromEntries([
  'boot-screen', 'app', 'back-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'home-view', 'collection-view', 'collection-toolbar', 'pin-bar', 'annotation-review-bar', 'letter-nav', 'entry-list',
  'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',
  'app-dialog', 'dialog-form', 'dialog-title', 'dialog-description', 'dialog-close', 'dialog-body', 'dialog-actions',
  'action-dialog', 'action-title', 'action-description', 'action-close', 'action-body',
  'detail-dialog', 'detail-title', 'detail-description', 'detail-close', 'detail-body',
  'search-dialog', 'search-close', 'search-body',
  'confirm-dialog', 'confirm-form', 'confirm-title', 'confirm-description', 'confirm-body', 'confirm-cancel', 'confirm-submit',
  'hidden-file-input',
].map((id) => [id, document.getElementById(id)]));

let currentCollectionId = '';
const expandedLettersByCollection = new Map();
let pendingJumpEntryId = '';
let pinIndex = 0;
let pinCollectionId = '';
let activeTask = null;
let review = { ids: [], index: 0, collectionId: '' };
let dialogSubmitHandler = null;
let confirmSubmitHandler = null;
let collectionRenderContext = null;
let scrollPersistenceTimer = 0;
let suppressScrollPersistenceUntil = 0;
let taskPanelExpanded = true;
let waitingServiceWorker = null;
let serviceWorkerReloadPending = false;
let lastPersistedEntryId = '';

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'on') for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
    else if (key in node && key !== 'form') node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function button(text, className, handler, options = {}) {
  return el('button', { type: 'button', className, text, disabled: options.disabled || false, on: { click: handler }, title: options.title || '' });
}

function showToast(message, type = 'info') {
  const toast = el('div', { className: `toast${type === 'error' ? ' error' : ''}`, text: String(message) });
  elements['toast-region'].replaceChildren(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 2800);
}

function displayError(error) {
  console.error(error);
  showToast(error?.message || String(error), 'error');
}

function field(label, control, help = '') {
  const wrapper = el('label', { className: 'field' }, [el('span', { text: label }), control]);
  if (help) wrapper.append(el('p', { className: 'help-text', text: help }));
  return wrapper;
}

function closeDialog() {
  if (elements['app-dialog'].open) elements['app-dialog'].close();
  dialogSubmitHandler = null;
}

function openDialog({
  title, description = '', body = [], submitText = '保存', cancelText = '取消', destructive = false,
  onSubmit = null, showCancel = null,
}) {
  elements['dialog-title'].textContent = title;
  elements['dialog-description'].textContent = description;
  elements['dialog-description'].classList.toggle('hidden', !description);
  elements['dialog-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['dialog-actions'].replaceChildren();
  const includeCancel = showCancel == null ? Boolean(onSubmit) : Boolean(showCancel);
  if (includeCancel) elements['dialog-actions'].append(button(cancelText, 'secondary-button', closeDialog));
  if (onSubmit) {
    const submit = el('button', { type: 'submit', className: destructive ? 'danger-button' : 'primary-button', text: submitText });
    elements['dialog-actions'].append(submit);
    dialogSubmitHandler = onSubmit;
  } else dialogSubmitHandler = null;
  if (!elements['app-dialog'].open) elements['app-dialog'].showModal();
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['dialog-body'].querySelector('input,textarea,select,button'))?.focus());
}

function closeActionDialog() {
  if (elements['action-dialog'].open) elements['action-dialog'].close();
}

function openActionDialog({ title, description = '', body = [] }) {
  elements['action-title'].textContent = title;
  elements['action-description'].textContent = description;
  elements['action-description'].classList.toggle('hidden', !description);
  elements['action-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  if (!elements['action-dialog'].open) elements['action-dialog'].showModal();
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['action-body'].querySelector('button'))?.focus());
}

function closeDetailDialog() {
  if (elements['detail-dialog'].open) elements['detail-dialog'].close();
}

function openDetailDialog({ title = '词项详情', description = '', body = [] }) {
  elements['detail-title'].textContent = title;
  elements['detail-description'].textContent = description;
  elements['detail-description'].classList.toggle('hidden', !description);
  elements['detail-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  if (!elements['detail-dialog'].open) elements['detail-dialog'].showModal();
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['detail-body'].querySelector('button'))?.focus());
}

function closeSearchDialog() {
  if (elements['search-dialog'].open) elements['search-dialog'].close();
}

function closeConfirmDialog() {
  if (elements['confirm-dialog'].open) elements['confirm-dialog'].close();
  confirmSubmitHandler = null;
}

function openConfirmDialog({ title, description = '', body = [], submitText = '确认', onSubmit }) {
  elements['confirm-title'].textContent = title;
  elements['confirm-description'].textContent = description;
  elements['confirm-description'].classList.toggle('hidden', !description);
  elements['confirm-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['confirm-submit'].textContent = submitText;
  confirmSubmitHandler = onSubmit;
  if (!elements['confirm-dialog'].open) elements['confirm-dialog'].showModal();
}

function collectionRoute(collectionId, entryId = '') {
  const query = new URLSearchParams();
  query.set('collection', collectionId);
  if (entryId) query.set('entry', entryId);
  return `#${query}`;
}

function parseRoute() {
  const query = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { collectionId: query.get('collection') || '', entryId: query.get('entry') || '' };
}

function navigateCollection(collectionId, entryId = '') {
  const hash = collectionRoute(collectionId, entryId);
  if (location.hash === hash) {
    currentCollectionId = collectionId;
    pendingJumpEntryId = entryId;
    renderApp();
  } else location.hash = hash;
}

function goHome() {
  closeReview();
  if (location.hash) location.hash = '';
  else { currentCollectionId = ''; renderApp(); }
}

function projectionCollectionForEntry(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return '';
  if (entry.kind === 'phrase') return systemPhraseCollectionId(entry.domainId);
  for (const [collectionId, entries] of state.projection.entries()) {
    if (entries.some((item) => item.id === entryId)) return collectionId;
  }
  return '';
}

function annotationCountForCollection(collectionId) {
  const state = getState();
  return getVisibleEntries(collectionId).filter((entry) => state.annotationByEntry.has(entry.id)).length;
}


function expandedLettersFor(collectionId) {
  let set = expandedLettersByCollection.get(collectionId);
  if (!set) {
    set = new Set();
    expandedLettersByCollection.set(collectionId, set);
  }
  return set;
}

function splitSourceLabel(value) {
  return String(value || '').split(/\s*(?:,|\/|;|，|、)\s*/).map((item) => item.trim()).filter(Boolean);
}

function mergedSourceLabel(entryId) {
  const state = getState();
  const memberships = [...(state.membershipsByEntry.get(entryId) || [])].sort((left, right) => {
    const a = state.collectionById.get(left.collectionId);
    const b = state.collectionById.get(right.collectionId);
    return Number(a?.order || 0) - Number(b?.order || 0)
      || Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0)
      || left.collectionId.localeCompare(right.collectionId);
  });
  const seen = new Set();
  const labels = [];
  for (const membership of memberships) {
    for (const part of splitSourceLabel(membership.sourceLabel)) {
      const key = part.toLocaleLowerCase('en');
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(part);
    }
  }
  return labels.join(', ');
}

function sourceLabelForCollection(entryId, collectionId) {
  const state = getState();
  const membership = (state.membershipsByEntry.get(entryId) || []).find((item) => item.collectionId === collectionId);
  return membership?.sourceLabel || '';
}

function isChineseQuery(value) {
  return /[\u3400-\u9fff]/u.test(String(value || ''));
}

function collectionCard(collection) {
  const count = getVisibleEntries(collection.id).length;
  return el('button', {
    type: 'button',
    className: 'collection-card',
    on: { click: () => navigateCollection(collection.id) },
  }, [
    el('span', { className: 'arrow', text: '↗' }),
    el('h3', { text: collection.name }),
    collection.label ? el('div', { className: 'label', text: collection.label }) : null,
    el('div', { className: 'count', text: count.toLocaleString() }),
    el('div', { className: 'count-label', text: '词项' }),
  ]);
}

function searchResultButton(entry, onSelect) {
  const state = getState();
  const collectionId = projectionCollectionForEntry(entry.id);
  const collection = state.collectionById.get(collectionId);
  const pos = mergedSourceLabel(entry.id);
  return el('button', { type: 'button', className: 'search-result', on: { click: () => onSelect(entry, collectionId) } }, [
    el('strong', { text: entry.text }),
    el('span', { text: [pos, collection?.name].filter(Boolean).join(' · ') }),
  ]);
}

function openLibraryManager() {
  const state = getState();
  const sections = state.domains.map((domain) => {
    const collections = state.collections.filter((item) => item.domainId === domain.id && item.type === 'normal');
    const actions = el('div', { className: 'action-list' }, [
      button('新建词表', '', () => { closeActionDialog(); openAddCollectionDialog(domain.id); }),
      button('管理词域', '', () => { closeActionDialog(); openDomainMenu(domain.id); }),
      ...collections.map((collection) => button(`管理词表 · ${collection.name}`, '', () => { closeActionDialog(); openCollectionMenu(collection.id); })),
    ]);
    return el('section', { className: 'detail-section' }, [
      el('div', {}, [el('h3', { text: domain.name }), el('p', { className: 'help-text', text: `${collections.length} 个普通词表 · ${state.entries.filter((entry) => entry.domainId === domain.id).length.toLocaleString()} 个词项` })]),
      actions,
    ]);
  });
  sections.push(el('section', { className: 'detail-section' }, [
    el('div', { className: 'action-list' }, [button('新建词域', '', () => { closeActionDialog(); openAddDomainDialog(); })]),
  ]));
  openActionDialog({ title: '管理词库', description: '词域与词表属于低频结构操作，不占用日常浏览界面。', body: sections });
}

async function exportBackupNow() {
  const backup = await exportFullBackup();
  downloadText(`vocabulary-index-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(backup, null, 2)}\n`);
  showToast('完整备份已导出');
}

async function performUndo() {
  try { if (!(await undo())) showToast('没有可撤销操作'); }
  catch (error) { displayError(error); }
}

async function performRedo() {
  try { if (!(await redo())) showToast('没有可重做操作'); }
  catch (error) { displayError(error); }
}

function renderHome() {
  const state = getState();
  currentCollectionId = '';
  elements.app.classList.remove('is-collection', 'has-pin', 'has-review');
  elements['home-view'].classList.remove('hidden');
  elements['collection-view'].classList.add('hidden');
  elements['back-button'].classList.add('hidden');
  elements['pin-bar'].classList.add('hidden');
  elements['page-title'].textContent = '词汇索引';
  elements['page-subtitle'].textContent = `${state.entries.length.toLocaleString()} 个词项 · 本地保存`;
  elements['settings-button'].textContent = '⚙';
  elements['settings-button'].setAttribute('aria-label', '设置');

  const annotationTotal = state.annotations.length;
  const heroActions = [button('管理', 'secondary-button compact-button', openLibraryManager)];
  if (annotationTotal) heroActions.unshift(button(`待核查 ${annotationTotal}`, 'secondary-button compact-button', () => startAnnotationReview('')));
  const hero = el('section', { className: 'home-hero' }, [
    el('div', { className: 'home-hero-copy' }, [
      el('p', { className: 'eyebrow', text: 'VOCABULARY INDEX' }),
      el('h2', { text: '我的词表' }),
      el('p', { text: '按词表浏览，点按英文即可复制。' }),
    ]),
    el('div', { className: 'home-hero-actions' }, heroActions),
  ]);

  const sections = [];
  for (const domain of state.domains) {
    const collections = state.collections.filter((item) => item.domainId === domain.id);
    const normal = collections.filter((item) => item.type === 'normal');
    const phrases = collections.find((item) => item.type === 'system-phrases');
    const heading = state.domains.length > 1
      ? el('div', { className: 'domain-heading' }, [
          el('div', {}, [el('h3', { text: domain.name }), el('p', { text: `${normal.length} 个词表` })]),
          button('管理', 'text-button', () => openDomainMenu(domain.id)),
        ])
      : null;
    const grid = normal.length
      ? el('div', { className: 'collection-grid' }, normal.map(collectionCard))
      : el('div', { className: 'empty-state', text: '尚未创建普通词表。' });
    const phraseLink = phrases
      ? el('button', { type: 'button', className: 'phrase-link', on: { click: () => navigateCollection(phrases.id) } }, [
          el('span', { text: '短语' }),
          el('span', { text: `${getVisibleEntries(phrases.id).length.toLocaleString()} 条 · 词域内关联索引` }),
          el('span', { text: '›' }),
        ])
      : null;
    sections.push(el('section', { className: 'domain-section' }, [heading, grid, phraseLink]));
  }

  const foot = el('p', { className: 'home-footnote', text: '主要数据保存在当前浏览器的 IndexedDB。清理网站数据前请先导出完整备份。' });
  elements['home-view'].replaceChildren(hero, ...sections, foot);
}

function renderCollection() {
  const state = getState();
  const collection = state.collectionById.get(currentCollectionId);
  if (!collection) { goHome(); return; }
  const domain = state.domainById.get(collection.domainId);
  const entries = getVisibleEntries(collection.id);
  elements.app.classList.add('is-collection');
  elements['home-view'].classList.add('hidden');
  elements['collection-view'].classList.remove('hidden');
  elements['back-button'].classList.remove('hidden');
  elements['page-title'].textContent = collection.type === 'system-phrases' ? '短语索引' : collection.name;
  elements['page-subtitle'].textContent = `${entries.length.toLocaleString()} 个词项${collection.label ? ` · ${collection.label}` : ''}`;
  elements['settings-button'].textContent = '•••';
  elements['settings-button'].setAttribute('aria-label', '词表更多操作');
  renderCollectionToolbar(collection, domain, entries);
  renderPinBar(collection);
  renderEntryList(collection, domain, entries);
  if (pendingJumpEntryId) queueMicrotask(() => jumpToEntry(pendingJumpEntryId));
}

function renderCollectionToolbar(collection, domain, entries) {
  const pins = getPinsForCollection(collection.id);
  const annotationCount = annotationCountForCollection(collection.id);
  const lastPosition = getLastPosition(collection.domainId, collection.id);
  const quickActions = [];
  if (lastPosition) quickActions.push(button('继续上次位置', 'secondary-button compact-button', () => jumpToEntry(lastPosition)));
  if (annotationCount) quickActions.push(button(`待核查 ${annotationCount}`, 'secondary-button compact-button', () => startAnnotationReview(collection.id)));
  elements['collection-toolbar'].replaceChildren(
    el('div', { className: 'collection-context' }, [
      el('span', { text: collection.type === 'system-phrases' ? '词域内短语索引' : `${entries.length.toLocaleString()} 个词项` }),
      pins.length ? el('span', { text: `${pins.length} 个 PIN` }) : null,
      domain && getState().domains.length > 1 ? el('span', { text: domain.name }) : null,
    ]),
    quickActions.length ? el('div', { className: 'collection-quick-actions' }, quickActions) : null,
  );
}

function syncPinIndexForEntry(collectionId, entryId) {
  const pins = getPinsForCollection(collectionId);
  if (pinCollectionId !== collectionId) {
    pinCollectionId = collectionId;
    pinIndex = 0;
  }
  const index = pins.findIndex((pin) => pin.entryId === entryId);
  if (index >= 0) pinIndex = index;
  else pinIndex = Math.max(0, Math.min(pinIndex, Math.max(0, pins.length - 1)));
}

function renderPinBar(collection) {
  const state = getState();
  const pins = getPinsForCollection(collection.id);
  if (pinCollectionId !== collection.id) {
    pinCollectionId = collection.id;
    pinIndex = 0;
  }
  if (review.ids.length || !pins.length) {
    elements['pin-bar'].classList.add('hidden');
    elements.app.classList.remove('has-pin');
    if (!pins.length) pinIndex = 0;
    return;
  }
  if (pendingJumpEntryId) syncPinIndexForEntry(collection.id, pendingJumpEntryId);
  pinIndex = Math.max(0, Math.min(pinIndex, pins.length - 1));
  const pin = pins[pinIndex];
  const entry = state.entryById.get(pin.entryId);
  elements['pin-bar'].classList.remove('hidden');
  elements.app.classList.add('has-pin');
  elements.app.classList.remove('has-review');
  elements['pin-bar'].replaceChildren(
    button('‹', 'pin-nav-button', () => jumpPinned(collection.id, -1), { title: '上一个 PIN' }),
    el('button', { type: 'button', className: 'pin-current', 'aria-label': '重新定位当前 PIN', on: { click: () => entry && jumpToEntry(entry.id) } }, [
      el('span', { className: 'pin-kicker', text: `PIN ${pinIndex + 1}/${pins.length}` }),
      el('strong', { text: entry?.text || 'PIN 已失效' }),
    ]),
    button('›', 'pin-nav-button', () => jumpPinned(collection.id, 1), { title: '下一个 PIN' }),
  );
}

function letterForEntry(entry) {
  const letter = entry.normalizedText.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '#';
}

function renderEntryList(collection, domain, entries) {
  collectionRenderContext = null;
  if (!entries.length) {
    elements['letter-nav'].classList.add('hidden');
    elements['entry-list'].replaceChildren(el('div', { className: 'empty-state' }, [
      el('strong', { text: collection.type === 'system-phrases' ? '尚未收录短语' : '该词表尚无词项' }),
      el('span', { text: '从右上角更多菜单新增或导入内容。' }),
    ]));
    return;
  }

  const globalIndexById = new Map(entries.map((entry, index) => [entry.id, index + 1]));
  if (collection.type === 'system-phrases') {
    elements['letter-nav'].classList.add('hidden');
    const body = el('div', { className: 'letter-body' }, entries.map((entry, index) => renderEntryRow(entry, collection, domain, { groupIndex: index + 1, globalIndex: index + 1 })));
    elements['entry-list'].replaceChildren(el('section', { className: 'letter-section phrase-section' }, [body]));
    collectionRenderContext = { collection, domain, entries, grouped: new Map([['#', entries]]), globalIndexById, sectionByLetter: new Map() };
    return;
  }

  const grouped = new Map();
  for (const entry of entries) {
    const letter = letterForEntry(entry);
    const list = grouped.get(letter) || [];
    list.push(entry);
    grouped.set(letter, list);
  }
  const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
  const expandedLetters = expandedLettersFor(collection.id);
  const sectionByLetter = new Map();
  collectionRenderContext = { collection, domain, entries, grouped, globalIndexById, sectionByLetter };

  elements['letter-nav'].classList.remove('hidden');
  elements['letter-nav'].replaceChildren(...letters.map((letter) => button(letter, grouped.has(letter) ? '' : 'empty', () => {
    if (!grouped.has(letter)) return;
    setLetterSectionOpen(letter, true);
    const section = sectionByLetter.get(letter);
    if (section) {
      suppressScrollPersistence(750);
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, { disabled: !grouped.has(letter) })));

  const sections = [];
  for (const letter of letters.filter((item) => grouped.has(item))) {
    const section = el('section', {
      className: 'letter-section',
      id: `letter-${letter === '#' ? 'other' : letter}`,
      dataset: { letter },
    });
    const heading = button('', 'letter-heading', () => setLetterSectionOpen(letter, !expandedLetters.has(letter)));
    heading.setAttribute('aria-expanded', expandedLetters.has(letter) ? 'true' : 'false');
    heading.append(
      el('span', { className: 'letter-title', text: letter }),
      el('span', { className: 'letter-count', text: grouped.get(letter).length.toLocaleString() }),
      el('span', { className: 'letter-indicator', text: expandedLetters.has(letter) ? '−' : '+' }),
    );
    section.append(heading);
    sectionByLetter.set(letter, section);
    sections.push(section);
  }
  elements['entry-list'].replaceChildren(...sections);
  for (const letter of expandedLetters) if (grouped.has(letter)) setLetterSectionOpen(letter, true);
}

function setLetterSectionOpen(letter, open) {
  const context = collectionRenderContext;
  if (!context || context.collection.id !== currentCollectionId) return false;
  const section = context.sectionByLetter.get(letter);
  const entries = context.grouped.get(letter);
  if (!section || !entries) return false;
  const expandedLetters = expandedLettersFor(currentCollectionId);
  const heading = section.querySelector('.letter-heading');
  const indicator = section.querySelector('.letter-indicator');
  let body = section.querySelector('.letter-body');
  if (open) {
    expandedLetters.add(letter);
    if (!body) {
      body = el('div', { className: 'letter-body' }, entries.map((entry, index) => renderEntryRow(entry, context.collection, context.domain, {
        groupIndex: index + 1,
        globalIndex: context.globalIndexById.get(entry.id) || index + 1,
      })));
      section.append(body);
    }
  } else {
    expandedLetters.delete(letter);
    body?.remove();
  }
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (indicator) indicator.textContent = open ? '−' : '+';
  updateActiveLetter(letter);
  return true;
}

function updateActiveLetter(letter = '') {
  elements['letter-nav'].querySelectorAll('button').forEach((item) => item.classList.toggle('active', Boolean(letter) && item.textContent === letter));
}

function renderEntryRow(entry, collection, _domain, indexes = { groupIndex: 0, globalIndex: 0 }) {
  const state = getState();
  const pinned = state.pinByEntry.has(entry.id);
  const annotation = state.annotationByEntry.get(entry.id);
  const numberMode = state.settings.numberMode || 'global';
  const indexText = numberMode === 'group' ? `${indexes.groupIndex}.` : numberMode === 'global' ? `${indexes.globalIndex}.` : '';
  const pos = entry.kind === 'word' ? sourceLabelForCollection(entry.id, collection.id) : '';
  const row = el('article', { className: 'entry-row', id: `entry-${entry.id}`, dataset: { entryId: entry.id } });
  const copy = el('button', { type: 'button', className: 'copy-entry', on: { click: () => copyEntry(entry, collection) } }, [
    indexText ? el('span', { className: 'entry-index', text: indexText }) : null,
    el('span', { className: 'entry-text', text: entry.text }),
    pos ? el('span', { className: 'entry-pos', text: pos }) : null,
  ]);
  const states = el('div', { className: 'entry-state' }, [
    pinned ? el('span', { className: 'entry-pin-mark', text: '◆', title: '已设置 PIN' }) : null,
    annotation ? button('待核查', 'entry-badge annotation', () => startAnnotationReview(collection.id, entry.id), { title: '审阅 AI 标注' }) : null,
  ]);
  const more = button('⋯', 'entry-more', () => openEntryActions(entry.id, collection.id), { title: '词项操作' });
  row.append(copy, states, more);
  return row;
}

function openEntryActions(entryId, collectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const collection = state.collectionById.get(collectionId);
  if (!entry || !collection) return;
  const memberships = state.membershipsByEntry.get(entry.id) || [];
  const pinned = state.pinByEntry.has(entry.id);
  const annotation = state.annotationByEntry.get(entry.id);
  const normalActions = [
    button(pinned ? '取消 PIN' : '设置 PIN', '', async () => {
      try {
        await togglePin(entry.id, collection.id);
        syncPinIndexForEntry(collection.id, entry.id);
        closeActionDialog();
        showToast(pinned ? '已取消 PIN' : '已设置 PIN');
      } catch (error) { displayError(error); }
    }),
    button('编辑词项', '', () => { closeActionDialog(); openEditEntryDialog(entry.id, collection.id); }),
    button('查看详情', '', () => { closeActionDialog(); openEntryDetails(entry.id, collection.id); }),
    entry.kind === 'word' ? button('添加相关短语', '', () => { closeActionDialog(); openAddRelatedPhraseDialog(entry.id); }) : null,
    annotation ? button('审阅 AI 标注', '', () => { closeActionDialog(); startAnnotationReview(collection.id, entry.id); }) : null,
  ].filter(Boolean);
  const dangerActions = [];
  if (memberships.some((item) => item.collectionId === collection.id)) dangerActions.push(button('从当前词表移除', 'danger', () => { closeActionDialog(); confirmRemoveSource(entry.id, collection.id); }));
  dangerActions.push(button('彻底删除词项', 'danger', () => { closeActionDialog(); confirmDeleteEntry(entry.id); }));
  openActionDialog({
    title: entry.text,
    description: sourceLabelForCollection(entry.id, collection.id) || (entry.kind === 'phrase' ? '短语' : ''),
    body: [el('div', { className: 'action-list' }, normalActions), el('div', { className: 'action-list danger-zone' }, dangerActions)],
  });
}

function openEntryDetails(entryId, collectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const collection = state.collectionById.get(collectionId);
  if (!entry || !collection) return;
  const memberships = state.membershipsByEntry.get(entry.id) || [];
  const body = [
    el('section', {}, [
      el('h3', { className: 'detail-title-word', text: entry.text }),
      entry.glossHant ? el('p', { className: 'detail-gloss', text: entry.glossHant }) : null,
    ]),
  ];
  if (memberships.length) {
    const list = el('ul', { className: 'source-list' });
    for (const membership of memberships) {
      const source = state.collectionById.get(membership.collectionId);
      list.append(el('li', { text: `${source?.name || membership.collectionId}${membership.sourceLabel ? ` · ${membership.sourceLabel}` : ''}` }));
    }
    body.push(el('section', {}, [el('h4', { className: 'detail-heading', text: '词表来源' }), list]));
  }
  if (entry.kind === 'word') {
    const phrases = getRelatedPhrases(entry.id);
    const chips = phrases.length
      ? phrases.map((phrase) => button(phrase.text, 'chip', () => { closeDetailDialog(); navigateCollection(systemPhraseCollectionId(entry.domainId), phrase.id); }))
      : [el('span', { className: 'chip missing', text: '暂无相关短语' })];
    body.push(el('section', {}, [el('h4', { className: 'detail-heading', text: '相关短语' }), el('div', { className: 'chip-list' }, chips)]));
  } else {
    const components = getPhraseComponents(entry.id);
    body.push(el('section', {}, [
      el('h4', { className: 'detail-heading', text: '组成词' }),
      el('div', { className: 'chip-list' }, components.map((component) => component.entry
        ? button(component.token, 'chip', () => { closeDetailDialog(); navigateCollection(projectionCollectionForEntry(component.entry.id), component.entry.id); })
        : el('span', { className: 'chip missing', text: `${component.token} · 未收录` }))),
    ]));
  }
  openDetailDialog({ title: entry.kind === 'phrase' ? '短语详情' : '词项详情', description: collection.name, body });
}

async function copyEntry(entry, collection) {
  let fallbackInput = null;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(entry.text);
    else {
      fallbackInput = el('textarea', { value: entry.text, readOnly: true });
      fallbackInput.style.position = 'fixed';
      fallbackInput.style.opacity = '0';
      fallbackInput.style.pointerEvents = 'none';
      document.body.append(fallbackInput);
      fallbackInput.select();
      if (!document.execCommand('copy')) throw new Error('浏览器拒绝复制');
    }
    const firstSavedPosition = !getLastPosition(entry.domainId, collection.id);
    await setLastPosition(entry.domainId, collection.id, entry.id);
    lastPersistedEntryId = entry.id;
    if (firstSavedPosition && currentCollectionId === collection.id) {
      renderCollectionToolbar(collection, getState().domainById.get(collection.domainId), getVisibleEntries(collection.id));
    }
    showToast(`已复制：${entry.text}`);
  } catch (error) {
    displayError(error);
  } finally {
    fallbackInput?.remove();
  }
}

function ensureEntryRendered(entryId) {
  let row = document.getElementById(`entry-${entryId}`);
  if (row) return row;
  const context = collectionRenderContext;
  const entry = getState().entryById.get(entryId);
  if (!context || !entry || context.collection.id !== currentCollectionId) return null;
  if (context.collection.type === 'normal') {
    const letter = letterForEntry(entry);
    setLetterSectionOpen(letter, true);
    updateActiveLetter(letter);
    row = document.getElementById(`entry-${entryId}`);
  }
  return row;
}

function suppressScrollPersistence(milliseconds = 700) {
  suppressScrollPersistenceUntil = Math.max(suppressScrollPersistenceUntil, Date.now() + milliseconds);
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = 0;
}

/** @param {string} entryId @param {{ behavior?: ScrollBehavior }} [options] */
function jumpToEntry(entryId, { behavior = 'smooth' } = {}) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) { showToast('词项已不存在'); return false; }
  const targetCollectionId = projectionCollectionForEntry(entryId);
  if (!targetCollectionId) { showToast('词项没有可见词表'); return false; }
  if (targetCollectionId !== currentCollectionId) {
    navigateCollection(targetCollectionId, entryId);
    return true;
  }
  syncPinIndexForEntry(currentCollectionId, entryId);
  pendingJumpEntryId = '';
  if (location.hash.includes('entry=')) history.replaceState(null, '', collectionRoute(currentCollectionId));
  const collection = state.collectionById.get(currentCollectionId);
  if (collection) renderPinBar(collection);
  const row = ensureEntryRendered(entryId);
  if (!row) return false;
  suppressScrollPersistence(behavior === 'smooth' ? 900 : 450);
  requestAnimationFrame(() => {
    row.scrollIntoView({ behavior, block: 'center' });
    row.classList.remove('jump-highlight');
    void row.offsetWidth;
    row.classList.add('jump-highlight');
    setTimeout(() => row.classList.remove('jump-highlight'), 1200);
  });
  return true;
}

function jumpPinned(collectionId, direction = 1) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const pins = getPinsForCollection(collectionId);
  if (!collection || !pins.length) return;
  if (pinCollectionId !== collectionId) {
    pinCollectionId = collectionId;
    pinIndex = 0;
  }
  pinIndex = (pinIndex + direction + pins.length) % pins.length;
  const entryId = pins[pinIndex].entryId;
  renderPinBar(collection);
  jumpToEntry(entryId);
}

function firstVisibleEntryId() {
  if (!currentCollectionId || !collectionRenderContext) return null;
  const topbar = document.querySelector('.topbar');
  const context = review.ids.length ? elements['annotation-review-bar'] : elements['pin-bar'];
  const top = Math.max(topbar?.getBoundingClientRect().bottom || 0, context && !context.classList.contains('hidden') ? context.getBoundingClientRect().bottom : 0) + 10;
  const rows = [...elements['entry-list'].querySelectorAll('.entry-row')];
  const row = rows.find((item) => {
    const rect = item.getBoundingClientRect();
    return rect.height > 0 && rect.bottom > top;
  });
  return row?.dataset.entryId || null;
}

function persistScrollPosition() {
  if (!currentCollectionId || Date.now() < suppressScrollPersistenceUntil) return;
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = setTimeout(() => {
    scrollPersistenceTimer = 0;
    if (!currentCollectionId || Date.now() < suppressScrollPersistenceUntil) return;
    const entryId = firstVisibleEntryId();
    const state = getState();
    const entry = entryId ? state.entryById.get(entryId) : null;
    const collection = state.collectionById.get(currentCollectionId);
    if (entry && collection && entry.domainId === collection.domainId && entry.id !== lastPersistedEntryId) {
      const firstSavedPosition = !getLastPosition(collection.domainId, collection.id);
      lastPersistedEntryId = entry.id;
      setLastPosition(collection.domainId, collection.id, entry.id)
        .then(() => {
          if (firstSavedPosition && currentCollectionId === collection.id) renderCollectionToolbar(collection, getState().domainById.get(collection.domainId), getVisibleEntries(collection.id));
        })
        .catch((error) => {
          lastPersistedEntryId = '';
          console.warn('浏览位置保存失败', error);
        });
    }
  }, 520);
}

function openAddDomainDialog() {
  const name = el('input', { required: true, maxlength: 40, placeholder: '例如：计算机科学' });
  const gloss = el('input', { type: 'checkbox' });
  openDialog({
    title: '新建词域',
    description: '词域之间的同形词、短语和释义相互独立。',
    body: [field('词域名称', name), el('label', { className: 'inline-field' }, [el('span', { text: '启用繁体中文释义' }), gloss])],
    onSubmit: async () => { await addDomain(name.value, { glossEnabled: gloss.checked }); },
  });
}

function openDomainMenu(domainId) {
  const state = getState();
  const domain = state.domainById.get(domainId);
  const name = el('input', { value: domain.name, maxlength: 40, required: true });
  const gloss = el('input', { type: 'checkbox', checked: domain.glossEnabled });
  const body = [field('词域名称', name), el('label', { className: 'inline-field' }, [el('span', { text: '显示并编辑繁体释义' }), gloss]), el('p', { className: 'help-text', text: '关闭只隐藏释义功能，不会删除已经保存的释义。' })];
  if (domain.id !== 'domain_general_english') body.push(button('删除整个词域', 'danger-button', () => confirmDeleteDomain(domain.id)));
  openDialog({
    title: '管理词域',
    body,
    onSubmit: async () => {
      if (name.value.trim() !== domain.name) await renameDomain(domain.id, name.value);
      if (gloss.checked !== domain.glossEnabled) await setDomainGlossEnabled(domain.id, gloss.checked);
    },
  });
}

function openAddCollectionDialog(domainId) {
  const name = el('input', { required: true, maxlength: 40, placeholder: '例如：操作系统' });
  const label = el('input', { maxlength: 80, placeholder: '可选说明' });
  openDialog({ title: '新建词表', body: [field('词表名称', name), field('说明', label)], onSubmit: async () => { await addCollection(domainId, name.value, label.value); } });
}

function openAddEntryDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(collection.domainId);
  const text = el('input', { required: true, maxlength: 160, placeholder: collection.type === 'system-phrases' ? '例如：thread pool' : '例如：thread' });
  const label = el('input', { maxlength: 80, placeholder: '可选，如 n., v.' });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field(collection.type === 'system-phrases' ? '英文短语' : '英文词项', text)];
  if (collection.type === 'normal') body.push(field('词性', label, '同形词会在词域内去重；同一词表重复导入的词性会去重合并。'));
  if (domain.glossEnabled) body.push(field('繁体释义', gloss, '简体输入会在本地转换为通用繁体。'));
  openDialog({
    title: collection.type === 'system-phrases' ? '新增短语' : '新增词项',
    body,
    onSubmit: async () => { const entry = await addEntry(collectionId, text.value, { sourceLabel: label.value, gloss: gloss.value }); pendingJumpEntryId = entry.id; },
  });
}

function openAddRelatedPhraseDialog(entryId) {
  const entry = getState().entryById.get(entryId);
  const domain = getState().domainById.get(entry.domainId);
  const text = el('input', { required: true, maxlength: 160, placeholder: `必须包含词元 “${entry.text}”` });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field('英文短语', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({ title: '添加相关短语', body, onSubmit: async () => { await addPhraseForWord(entryId, text.value, { gloss: gloss.value }); } });
}

function openEditEntryDialog(entryId, collectionId = currentCollectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(entry?.domainId);
  if (!entry || !collection) return;
  const membership = (state.membershipsByEntry.get(entry.id) || []).find((item) => item.collectionId === collectionId);
  const text = el('input', { required: true, maxlength: 160, value: entry.text, autocomplete: 'off', spellcheck: false });
  const sourceLabel = el('input', { maxlength: 80, value: membership?.sourceLabel || '', placeholder: '例如：n., v.' });
  const gloss = el('input', { maxlength: 120, value: entry.glossHant || '', placeholder: '可输入简体或繁体' });
  const body = [field(entry.kind === 'phrase' ? '英文短语' : '英文词汇', text)];
  if (entry.kind === 'word' && membership) body.push(field('当前词表词性', sourceLabel, '这里只更新当前词表的词性标签，不影响其他词表来源。'));
  if (domain?.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: '编辑词项',
    description: '修改英文文本会重建短语索引，并清除该词项的陈旧 AI 标注。',
    body,
    onSubmit: async () => {
      if (entry.kind === 'word' && membership) {
        await editEntryInCollection(entry.id, collection.id, { text: text.value, sourceLabel: sourceLabel.value, gloss: gloss.value }, entry.updatedAt);
      } else {
        await editEntry(entry.id, { text: text.value, gloss: gloss.value }, entry.updatedAt);
      }
    },
  });
}

function handleCollectionAction(action) {
  if (!currentCollectionId) return;
  const collection = getState().collectionById.get(currentCollectionId);
  if (!collection) return;
  if (action === 'add') openAddEntryDialog(collection.id);
  else if (action === 'ai-add') openAiAddDialog(collection.id);
  else if (action === 'ai-check') openAiCheckDialog(collection.id);
  else if (action === 'import') openImportDialog(collection.id);
  else if (action === 'more') openCollectionActions(collection.id);
}

function openCollectionActions(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  if (!collection) return;
  const entries = getVisibleEntries(collectionId);
  const annotationCount = annotationCountForCollection(collectionId);
  const lastPosition = getLastPosition(collection.domainId, collection.id);
  const actions = [
    button(collection.type === 'system-phrases' ? '新增短语' : '新增词项', '', () => { closeActionDialog(); openAddEntryDialog(collection.id); }),
    button('AI 新增', '', () => { closeActionDialog(); openAiAddDialog(collection.id); }),
    button('AI 核查', '', () => { closeActionDialog(); openAiCheckDialog(collection.id); }, { disabled: Boolean(activeTask) || !entries.length }),
    annotationCount ? button(`审阅待核查 · ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id); }) : null,
    lastPosition ? button('跳到上次浏览位置', '', () => { closeActionDialog(); jumpToEntry(lastPosition); }) : null,
    button('导入词项', '', () => { closeActionDialog(); openImportDialog(collection.id); }),
    button('导出当前词表 CSV', '', () => { exportCollectionCsv(collection.id); closeActionDialog(); }),
    button('撤销上一步修改', '', async () => { closeActionDialog(); await performUndo(); }),
    button('重做', '', async () => { closeActionDialog(); await performRedo(); }),
    button(collection.type === 'normal' ? '管理当前词表' : '短语表信息', '', () => { closeActionDialog(); openCollectionMenu(collection.id); }),
    button('应用设置与完整备份', '', () => { closeActionDialog(); openSettingsDialog(); }),
  ].filter(Boolean);
  openActionDialog({
    title: collection.type === 'system-phrases' ? '短语表操作' : `${collection.name} · 操作`,
    body: el('div', { className: 'action-list' }, actions),
  });
}

function openCollectionMenu(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId);
  const body = [];
  if (collection.type === 'normal') {
    const name = el('input', { value: collection.name, required: true, maxlength: 40 });
    const label = el('input', { value: collection.label || '', maxlength: 80 });
    body.push(field('词表名称', name), field('说明', label));
    body.push(el('div', { className: 'settings-row' }, [
      button('提高优先级', 'secondary-button', async () => { try { await moveCollection(collectionId, -1); closeDialog(); } catch (error) { displayError(error); } }),
      button('降低优先级', 'secondary-button', async () => { try { await moveCollection(collectionId, 1); closeDialog(); } catch (error) { displayError(error); } }),
    ]));
    if (entries.length) body.push(button('导出当前词表 CSV', 'secondary-button', () => exportCollectionCsv(collectionId)));
    if (annotationCountForCollection(collectionId)) body.push(button('清空当前词表标注', 'secondary-button', async () => { await clearAnnotationsForCollection(collectionId); closeDialog(); }));
    body.push(button('删除词表', 'danger-button', () => confirmDeleteCollection(collectionId)));
    openDialog({ title: '管理词表', body, onSubmit: async () => { await renameCollection(collectionId, name.value, label.value); } });
  } else {
    body.push(el('p', { className: 'help-text', text: '系统短语表由词域自动维护，不能重命名或删除。' }));
    body.push(button('导出当前短语 CSV', 'secondary-button', () => exportCollectionCsv(collectionId)));
    openDialog({ title: '短语表信息', body });
  }
}

function exportCollectionCsv(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId);
  const memberships = state.membershipsByCollection.get(collectionId) || [];
  downloadText(`${collection.name}-${new Date().toISOString().slice(0, 10)}.csv`, entriesToCsv(entries, memberships), 'text/csv;charset=utf-8');
  showToast('CSV 已导出');
}

function openImportDialog(collectionId) {
  const fileInput = el('input', { type: 'file', accept: '.json,.csv,.txt,.md,text/plain,application/json,text/csv' });
  const mode = el('select', {}, [el('option', { value: 'merge', text: '合并到当前词表' }), el('option', { value: 'replace', text: '替换当前词表内容' })]);
  const preview = el('div', { className: 'preview-list' }, [el('div', { className: 'preview-item muted', text: '选择文件后显示预览。' })]);
  let parsed = null;
  fileInput.addEventListener('change', async () => {
    try {
      parsed = await readImportFile(fileInput.files?.[0]);
      if (parsed.kind === 'backup') {
        preview.replaceChildren(el('div', { className: 'preview-item', text: '检测到完整备份。请在设置中使用“恢复完整备份”。' }));
        return;
      }
      const items = parsed.entries.slice(0, 80).map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.sourceLabel ? ` · ${item.sourceLabel}` : ''}${item.gloss ? ` · ${item.gloss}` : ''}` }));
      if (parsed.entries.length > 80) items.push(el('div', { className: 'preview-item muted', text: `另有 ${parsed.entries.length - 80} 项未显示` }));
      if (parsed.errors.length) items.unshift(el('div', { className: 'preview-item danger', text: `${parsed.errors.length} 行存在问题，将跳过无效行。` }));
      preview.replaceChildren(...items);
    } catch (error) { parsed = null; preview.replaceChildren(el('div', { className: 'preview-item danger', text: error.message })); }
  });
  openDialog({
    title: '导入词项',
    description: '支持 TXT、Markdown、CSV 和 JSON 词项数组。解析与预览完成前不会修改数据库。',
    body: [field('文件', fileInput), field('导入方式', mode), preview],
    submitText: '执行导入',
    onSubmit: async () => {
      if (!parsed || parsed.kind !== 'entries') throw new Error('请选择有效的词项文件');
      await importEntries(collectionId, parsed.entries, { mode: mode.value });
      showToast(`已导入 ${parsed.entries.length} 项`);
    },
  });
}

function confirmDeleteCollection(collectionId) {
  closeDialog();
  const collection = getState().collectionById.get(collectionId);
  openConfirmDialog({
    title: '删除词表',
    description: `将删除“${collection.name}”的来源关系；仍有其他来源的词项会自动回落。`,
    body: el('div', { className: 'warning-box', text: '该操作可以立即撤销，但建议在大规模修改前先导出完整 JSON。' }),
    submitText: '确认删除',
    onSubmit: async () => { await deleteCollection(collectionId); goHome(); },
  });
}

function confirmDeleteDomain(domainId) {
  closeDialog();
  const domain = getState().domainById.get(domainId);
  openConfirmDialog({
    title: '删除整个词域',
    description: `将删除“${domain.name}”及其中全部词表、词项、PIN 和标注。`,
    body: el('div', { className: 'warning-box', text: '这是大范围操作。请确认已有完整 JSON 备份。' }),
    submitText: '确认删除词域',
    onSubmit: async () => { await deleteDomain(domainId); goHome(); },
  });
}

function confirmRemoveSource(entryId, collectionId) {
  const entry = getState().entryById.get(entryId);
  openConfirmDialog({
    title: '移除词表来源',
    description: `从当前词表移除 “${entry.text}”。`,
    body: el('p', { className: 'help-text', text: '若它仍属于其他词表，将自动显示在优先级最高的剩余词表；普通词失去全部来源后会被删除。' }),
    submitText: '移除',
    onSubmit: async () => { await removeEntryFromCollection(entryId, collectionId); },
  });
}

function confirmDeleteEntry(entryId) {
  const entry = getState().entryById.get(entryId);
  openConfirmDialog({
    title: '彻底删除词项',
    description: `删除 “${entry.text}” 及其全部来源、PIN、标注和短语索引。`,
    body: el('div', { className: 'warning-box', text: '该操作可以通过撤销恢复。' }),
    submitText: '彻底删除',
    onSubmit: async () => { await deleteEntry(entryId); },
  });
}

async function openAiAddDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(collection.domainId);
  const instruction = el('textarea', { required: true, placeholder: '例如：生成 30 个操作系统进程与线程相关的核心英文术语' });
  const resultBox = el('div', { className: 'preview-list hidden' });
  let candidates = [];
  const generate = button('生成候选', 'secondary-button', async () => {
    try {
      generate.disabled = true;
      generate.textContent = '生成中…';
      candidates = await suggestEntries({ domainName: domain.name, collectionName: collection.name, instruction: `${collection.type === 'system-phrases' ? 'Generate multi-word English phrases only. ' : ''}${instruction.value}`, existing: getVisibleEntries(collectionId).map((item) => item.text), glossEnabled: domain.glossEnabled });
      resultBox.classList.remove('hidden');
      resultBox.replaceChildren(...candidates.map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.sourceLabel ? ` · ${item.sourceLabel}` : ''}${item.gloss ? ` · ${item.gloss}` : ''}` })));
    } catch (error) { displayError(error); }
    finally { generate.disabled = false; generate.textContent = '重新生成'; }
  });
  openDialog({
    title: 'AI 新增词项',
    description: '模型目录动态读取，不针对具体模型写兼容分支。候选写入前仍按域内规范词形去重。',
    body: [field('生成要求', instruction), generate, resultBox],
    submitText: '导入候选',
    onSubmit: async () => { if (!candidates.length) throw new Error('请先生成候选'); await importEntries(collectionId, candidates, { mode: 'merge' }); },
  });
}

function openAiCheckDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId).map((entry) => ({ ...entry, sourceLabel: sourceLabelForCollection(entry.id, collectionId) }));
  if (!collection || !entries.length) { showToast('当前词表没有可核查词项'); return; }
  const batches = createAiCheckBatches(entries);
  const model = getSelectedModel();
  const summary = el('div', { className: 'preview-list' }, [
    el('div', { className: 'preview-item', text: `范围：${collection.name}` }),
    el('div', { className: 'preview-item', text: `词项：${entries.length.toLocaleString()} 项` }),
    el('div', { className: 'preview-item', text: `预计批次：${batches.length}` }),
    el('div', { className: `preview-item${model ? '' : ' danger'}`, text: `模型：${model || '尚未选择'}` }),
  ]);
  openDialog({
    title: '启动 AI 核查',
    description: '核查只生成待审阅标注，不会直接修改词汇。每批完成后立即保存，取消时保留已完成结果。',
    body: [summary, el('p', { className: 'help-text', text: '运行期间可暂停、继续、取消或收起为临时任务胶囊。' })],
    submitText: '开始核查',
    onSubmit: async () => {
      if (!getApiKey()) throw new Error('请先在设置中配置 Groq API Key');
      if (!getSelectedModel()) throw new Error('请先刷新并选择 Groq 模型');
      setTimeout(() => startAiCheck(collectionId), 0);
    },
  });
}

async function startAiCheck(collectionId) {
  if (activeTask) return;
  const entries = getVisibleEntries(collectionId).map((entry) => ({ ...entry, sourceLabel: sourceLabelForCollection(entry.id, collectionId) }));
  if (!entries.length) return;
  const controller = new AiCheckController();
  activeTask = { controller, paused: false, completed: 0, total: 1, collectionId, status: '准备 AI 核查…' };
  taskPanelExpanded = true;
  renderTaskPanel('准备 AI 核查…');
  try {
    const result = await checkEntries(entries, {
      controller,
      onProgress: (progress) => {
        activeTask.completed = progress.completed;
        activeTask.total = progress.total;
        renderTaskPanel(`批次 ${Math.min(progress.completed + 1, progress.total)} / ${progress.total}`);
      },
      onBatch: async (issues, batch) => { await replaceAnnotations(batch.map((entry) => entry.id), issues); },
    });
    showToast(result.cancelled ? '核查已取消；已完成批次的标注已保留' : 'AI 核查完成');
  } catch (error) { displayError(error); }
  finally { activeTask = null; renderTaskPanel(''); renderApp(); }
}

function renderTaskPanel(status) {
  if (!activeTask) {
    elements['task-panel'].classList.add('hidden');
    elements['task-capsule'].classList.add('hidden');
    return;
  }
  activeTask.status = status || activeTask.status || 'AI 核查运行中';
  const progressText = `${activeTask.status} · ${activeTask.completed}/${activeTask.total}`;
  elements['task-capsule'].textContent = progressText;
  elements['task-capsule'].classList.toggle('hidden', taskPanelExpanded);
  elements['task-panel'].classList.toggle('hidden', !taskPanelExpanded);
  if (!taskPanelExpanded) return;
  const progress = el('progress', { max: Math.max(activeTask.total, 1), value: activeTask.completed });
  const collapse = button('收起', 'secondary-button compact-button', () => { taskPanelExpanded = false; renderTaskPanel(activeTask.status); });
  const pause = button(activeTask.paused ? '继续' : '暂停', 'secondary-button compact-button', () => {
    activeTask.paused = !activeTask.paused;
    if (activeTask.paused) activeTask.controller.pause(); else activeTask.controller.resume();
    renderTaskPanel(activeTask.paused ? '已暂停，将在当前请求结束后停止推进' : activeTask.status);
  });
  const cancel = button('取消', 'danger-button compact-button', () => activeTask.controller.cancel());
  elements['task-panel'].replaceChildren(el('div', { className: 'task-top' }, [
    el('div', { className: 'task-copy' }, [el('strong', { text: 'AI 核查' }), el('span', { text: activeTask.status })]),
    el('div', { className: 'task-actions' }, [collapse, pause, cancel]),
  ]), progress);
}

function annotationReviewIds(collectionId = '') {
  const state = getState();
  const entries = collectionId ? getVisibleEntries(collectionId) : state.entries;
  return [...entries]
    .filter((entry) => state.annotationByEntry.has(entry.id))
    .sort((a, b) => a.domainId.localeCompare(b.domainId) || a.normalizedText.localeCompare(b.normalizedText, 'en'))
    .map((entry) => entry.id);
}

function startAnnotationReview(collectionId = '', startEntryId = '') {
  const ids = annotationReviewIds(collectionId);
  if (!ids.length) { showToast(collectionId ? '当前词表没有待核查标注' : '没有待核查标注'); return; }
  const requestedIndex = startEntryId ? ids.indexOf(startEntryId) : 0;
  review = { ids, index: requestedIndex >= 0 ? requestedIndex : 0, collectionId };
  renderReviewBar();
  jumpToEntry(review.ids[review.index]);
}

function syncReview() {
  const currentId = review.ids[review.index] || '';
  const ids = annotationReviewIds(review.collectionId);
  if (!ids.length) { closeReview(); return false; }
  const currentIndex = currentId ? ids.indexOf(currentId) : -1;
  review.index = currentIndex >= 0 ? currentIndex : Math.min(review.index, ids.length - 1);
  review.ids = ids;
  return true;
}

function renderReviewBar() {
  if (!review.ids.length) {
    elements['annotation-review-bar'].classList.add('hidden');
    elements.app.classList.remove('has-review');
    if (currentCollectionId) {
      const collection = getState().collectionById.get(currentCollectionId);
      if (collection) renderPinBar(collection);
    }
    return;
  }
  const state = getState();
  const entryId = review.ids[review.index];
  const entry = state.entryById.get(entryId);
  const annotation = state.annotationByEntry.get(entryId);
  if (!entry || !annotation) { if (syncReview()) renderReviewBar(); return; }
  const targetCollectionId = projectionCollectionForEntry(entryId);
  if (targetCollectionId && targetCollectionId !== currentCollectionId) {
    navigateCollection(targetCollectionId, entryId);
    return;
  }
  elements['pin-bar'].classList.add('hidden');
  elements.app.classList.remove('has-pin');
  elements['annotation-review-bar'].classList.remove('hidden');
  elements.app.classList.add('has-review');
  elements['annotation-review-bar'].replaceChildren(
    button('‹', '', () => navigateReview(-1), { title: '上一个标注' }),
    el('div', { className: 'review-text' }, [
      el('strong', { text: `${review.index + 1}/${review.ids.length} · ${entry.text}` }),
      el('span', { text: `${annotation.spelling.suggestion ? `建议 ${annotation.spelling.suggestion}` : '需检查'}${annotation.reason ? ` · ${annotation.reason}` : ''}` }),
    ]),
    button('›', '', () => navigateReview(1), { title: '下一个标注' }),
    button('编辑', 'review-edit', () => openEditEntryDialog(entryId, targetCollectionId)),
    button('取消', 'review-dismiss', () => dismissCurrentReviewAnnotation()),
    button('×', '', closeReview, { title: '退出审阅' }),
  );
}

function navigateReview(direction) {
  if (!review.ids.length) return;
  review.index = (review.index + direction + review.ids.length) % review.ids.length;
  const entryId = review.ids[review.index];
  const targetCollectionId = projectionCollectionForEntry(entryId);
  if (targetCollectionId !== currentCollectionId) navigateCollection(targetCollectionId, entryId);
  else { renderReviewBar(); jumpToEntry(entryId); }
}

async function dismissCurrentReviewAnnotation() {
  const entryId = review.ids[review.index];
  if (!entryId) return;
  try {
    const oldIndex = review.index;
    await dismissAnnotation(entryId);
    review.index = oldIndex;
    if (syncReview()) {
      renderReviewBar();
      jumpToEntry(review.ids[review.index]);
    }
  } catch (error) { displayError(error); }
}

function closeReview() {
  review = { ids: [], index: 0, collectionId: '' };
  elements['annotation-review-bar'].classList.add('hidden');
  elements.app.classList.remove('has-review');
  if (currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    if (collection) renderPinBar(collection);
  }
}

function openSearchDialog() {
  const state = getState();
  const input = el('input', { type: 'search', placeholder: '输入英文词汇或中文概念', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select', {}, [
    el('option', { value: currentCollectionId ? 'current' : 'all', text: currentCollectionId ? '当前词表' : '全部词表' }),
    currentCollectionId ? el('option', { value: 'domain', text: '当前词域' }) : null,
    currentCollectionId ? el('option', { value: 'all', text: '全部词表' }) : null,
  ]);
  const aiButton = button('AI 中文联想', 'secondary-button hidden', async () => {});
  const status = el('p', { className: 'search-status help-text' });
  const results = el('div', { className: 'search-results' });
  let requestSequence = 0;

  const visibleIds = () => {
    if (!currentCollectionId || scope.value === 'all') return new Set(state.entries.map((entry) => entry.id));
    if (scope.value === 'current') return new Set(getVisibleEntries(currentCollectionId).map((entry) => entry.id));
    const collection = state.collectionById.get(currentCollectionId);
    return new Set(state.entries.filter((entry) => entry.domainId === collection?.domainId).map((entry) => entry.id));
  };
  const selectResult = (entry, collectionId) => {
    closeSearchDialog();
    navigateCollection(collectionId, entry.id);
  };
  const showEntries = (entries, label = '') => {
    status.textContent = label || (entries.length ? `${entries.length} 个结果` : '没有匹配结果');
    results.replaceChildren(...entries.map((entry) => searchResultButton(entry, selectResult)));
  };
  const renderLocal = () => {
    requestSequence += 1;
    const query = input.value.trim();
    aiButton.classList.toggle('hidden', !isChineseQuery(query));
    if (!query) {
      status.textContent = '英文直接搜索；中文可先匹配本地释义，也可使用 AI 联想。';
      results.replaceChildren();
      return;
    }
    const allowed = visibleIds();
    const found = search(query, { limit: 160 }).filter((entry) => allowed.has(entry.id)).slice(0, 80);
    showEntries(found);
  };
  input.addEventListener('input', renderLocal);
  scope.addEventListener('change', renderLocal);
  aiButton.addEventListener('click', async () => {
    const query = input.value.trim();
    if (!query) return;
    const sequence = ++requestSequence;
    aiButton.disabled = true;
    aiButton.textContent = '联想中…';
    status.textContent = '正在生成英文检索词…';
    try {
      const terms = await suggestSearchTerms(query);
      if (sequence !== requestSequence || !elements['search-dialog'].open) return;
      const allowed = visibleIds();
      const seen = new Set();
      const found = [];
      for (const term of terms) {
        for (const entry of search(term, { limit: 30 })) {
          if (!allowed.has(entry.id) || seen.has(entry.id)) continue;
          seen.add(entry.id);
          found.push(entry);
          if (found.length >= 80) break;
        }
        if (found.length >= 80) break;
      }
      showEntries(found, terms.length ? `联想到：${terms.join('、')}` : 'AI 未返回可用检索词');
    } catch (error) {
      if (sequence === requestSequence) {
        displayError(error);
        status.textContent = 'AI 中文联想失败，本地搜索结果仍保留。';
      }
    } finally {
      if (sequence === requestSequence) {
        aiButton.disabled = false;
        aiButton.textContent = 'AI 中文联想';
      }
    }
  });
  renderLocal();
  elements['search-body'].replaceChildren(el('div', { className: 'search-controls' }, [input, scope, aiButton]), status, results);
  if (!elements['search-dialog'].open) elements['search-dialog'].showModal();
  queueMicrotask(() => input.focus());
}

function openSettingsDialog() {
  const state = getState();
  const key = el('input', { type: 'password', value: getApiKey(), autocomplete: 'off', placeholder: 'gsk_…' });
  const model = el('select');
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '不显示序号', selected: state.settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '每个字母重新编号', selected: state.settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '词表内连续编号', selected: !['none', 'group'].includes(state.settings.numberMode) }),
  ]);
  const updated = el('p', { className: 'help-text' });
  const renderModels = () => {
    const catalog = getModelCatalog();
    model.replaceChildren(el('option', { value: '', text: catalog.length ? '选择模型' : '尚未刷新模型目录' }), ...catalog.map((item) => el('option', { value: item.id, text: `${item.id}${item.active ? '' : '（历史）'}`, selected: item.id === getSelectedModel() })));
    updated.textContent = getModelCatalogUpdatedAt() ? `最近刷新：${new Date(getModelCatalogUpdatedAt()).toLocaleString()}` : '模型目录尚未刷新。刷新后会长期保留历史模型，不必每次重新搜索。';
  };
  renderModels();
  const refresh = button('刷新模型目录', 'secondary-button', async () => {
    try { setApiKey(key.value); refresh.disabled = true; refresh.textContent = '刷新中…'; await refreshModels(); renderModels(); showToast('模型目录已刷新'); }
    catch (error) { displayError(error); }
    finally { refresh.disabled = false; refresh.textContent = '刷新模型目录'; }
  });
  const exportButton = button('导出完整 JSON', 'secondary-button', () => exportBackupNow().catch(displayError));
  const restoreButton = button('恢复完整备份', 'secondary-button', openRestoreDialog);
  const manageButton = button('管理词域与词表', 'secondary-button', () => { closeDialog(); openLibraryManager(); });
  const phraseButtons = state.domains.map((domain) => {
    const phrases = state.collections.find((item) => item.domainId === domain.id && item.type === 'system-phrases');
    return phrases ? button(`${state.domains.length > 1 ? `${domain.name} · ` : ''}打开短语索引`, 'secondary-button', () => { closeDialog(); navigateCollection(phrases.id); }) : null;
  }).filter(Boolean);
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('API Key', key, '仅保存在当前浏览器 localStorage，不进入 JSON 备份。'), field('模型', model), updated, refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号模式', numberMode, '主列表只显示英文和合并后的词性。')]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [manageButton, ...phraseButtons])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [exportButton, restoreButton]), el('p', { className: 'help-text', text: '清理 Safari 网站数据或更换设备前，请先导出完整 JSON。' })]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '版本' }), el('p', { className: 'help-text', text: `Vocabulary Index ${APP_VERSION} · IndexedDB schema 3 · 本地优先` })]),
  ];
  openDialog({ title: '设置', body, submitText: '保存', onSubmit: async () => { setApiKey(key.value); if (model.value) selectModel(model.value); await setNumberMode(numberMode.value); showToast('设置已保存'); } });
}

function openRestoreDialog() {
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  let backup = null;
  const preview = el('div', { className: 'preview-list' }, [el('div', { className: 'preview-item muted', text: '选择 2.x 或 3.0 完整 JSON 备份。' })]);
  file.addEventListener('change', async () => {
    try {
      const parsed = await readImportFile(file.files?.[0]);
      if (parsed.kind !== 'backup') throw new Error('该 JSON 不是完整备份');
      backup = parsed.backup;
      preview.replaceChildren(el('div', { className: 'preview-item', text: `${backup.domains.length} 个词域 · ${backup.collections.length} 个词表 · ${backup.entries.length.toLocaleString()} 个词项` }));
    } catch (error) { backup = null; preview.replaceChildren(el('div', { className: 'preview-item danger', text: error.message })); }
  });
  openDialog({ title: '恢复完整备份', description: '恢复会整体替换当前 3.0 数据并清空撤销历史。', body: [el('div', { className: 'warning-box', text: '先导出当前完整 JSON。请勿在 Safari 与主屏幕 PWA 两个实例中同时执行恢复。' }), field('备份文件', file), preview], submitText: '确认恢复', destructive: true, onSubmit: async () => { if (!backup) throw new Error('请选择有效完整备份'); await restoreBackup(backup); goHome(); showToast('完整备份已恢复'); } });
}

function showMigrationNotice() {
  const state = getState();
  if (!state.settings.migrationNoticePending) return;
  openDialog({
    title: '已升级到 3.0',
    description: `已从 ${state.settings.migrationSource || '2.x'} 迁移到词域数据模型。`,
    body: [
      el('div', { className: 'warning-box', text: '请立即导出一份 3.0 完整 JSON，并在真机验收完成前保留升级前的 2.4.1 JSON。' }),
      el('p', { className: 'help-text', text: '旧词性已作为来源标签保留；主列表不再把词性作为词项身份。每个词域已自动建立系统短语表。' }),
    ],
    submitText: '我已了解',
    onSubmit: acknowledgeMigrationNotice,
  });
}

export function notifyServiceWorkerUpdate(worker) {
  waitingServiceWorker = worker || null;
  elements['update-banner']?.classList.toggle('hidden', !waitingServiceWorker);
}

function applyWaitingServiceWorker() {
  if (!waitingServiceWorker || serviceWorkerReloadPending) return;
  serviceWorkerReloadPending = true;
  elements['update-now-button'].disabled = true;
  elements['update-now-button'].textContent = '更新中…';
  waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
}

function dismissUpdateBanner() {
  elements['update-banner'].classList.add('hidden');
}

async function handleConfirmSubmit(event) {
  event.preventDefault();
  if (!confirmSubmitHandler) return;
  const submit = elements['confirm-submit'];
  const oldText = submit.textContent;
  try {
    submit.disabled = true;
    submit.textContent = '处理中…';
    await confirmSubmitHandler();
    closeConfirmDialog();
  } catch (error) {
    displayError(error);
  } finally {
    if (submit.isConnected) {
      submit.disabled = false;
      submit.textContent = oldText || '确认';
    }
  }
}

function closeDialogFromBackdrop(event, dialog, close) {
  if (event.target === dialog) close();
}

function renderApp() {
  const route = parseRoute();
  currentCollectionId = route.collectionId;
  pendingJumpEntryId = route.entryId || '';
  if (currentCollectionId) renderCollection(); else renderHome();
  if (review.ids.length) { syncReview(); renderReviewBar(); }
}

async function handleDialogSubmit(event) {
  event.preventDefault();
  if (!dialogSubmitHandler) return;
  const submit = /** @type {HTMLButtonElement | null} */ (elements['dialog-actions'].querySelector('button[type="submit"]'));
  try {
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = '处理中…'; }
    await dialogSubmitHandler();
    closeDialog();
    renderApp();
  } catch (error) { displayError(error); }
  finally { if (submit?.isConnected) { submit.disabled = false; submit.textContent = submit.dataset.oldText || '保存'; } }
}

export async function initializeUI() {
  elements['dialog-form'].addEventListener('submit', handleDialogSubmit);
  elements['confirm-form'].addEventListener('submit', handleConfirmSubmit);
  elements['dialog-close'].addEventListener('click', closeDialog);
  elements['action-close'].addEventListener('click', closeActionDialog);
  elements['detail-close'].addEventListener('click', closeDetailDialog);
  elements['search-close'].addEventListener('click', closeSearchDialog);
  elements['confirm-cancel'].addEventListener('click', closeConfirmDialog);
  elements['app-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['app-dialog'], closeDialog));
  elements['action-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['action-dialog'], closeActionDialog));
  elements['detail-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['detail-dialog'], closeDetailDialog));
  elements['search-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['search-dialog'], closeSearchDialog));
  elements['confirm-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['confirm-dialog'], closeConfirmDialog));
  elements['back-button'].addEventListener('click', goHome);
  elements['search-button'].addEventListener('click', openSearchDialog);
  elements['settings-button'].addEventListener('click', () => {
    if (currentCollectionId) openCollectionActions(currentCollectionId);
    else openSettingsDialog();
  });
  elements['task-capsule'].addEventListener('click', () => {
    if (!activeTask) return;
    taskPanelExpanded = true;
    renderTaskPanel(activeTask.status);
  });
  elements['update-now-button'].addEventListener('click', applyWaitingServiceWorker);
  elements['update-later-button'].addEventListener('click', dismissUpdateBanner);
  window.addEventListener('hashchange', renderApp);
  window.addEventListener('scroll', persistScrollPosition, { passive: true });
  subscribe(({ type }) => {
    if (type === 'external-change') showToast('检测到另一实例的数据更新，已重新载入');
    renderApp();
  });
  await initializeStore();
  elements['boot-screen'].classList.add('hidden');
  elements.app.classList.remove('hidden');
  renderApp();
  setTimeout(showMigrationNotice, 60);
}
