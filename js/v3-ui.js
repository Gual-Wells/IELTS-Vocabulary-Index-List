import {
  acknowledgeMigrationNotice, addCollection, addDomain, addEntry, addPhraseForWord,
  clearAnnotationsForCollection, deleteCollection, deleteDomain, deleteEntry, dismissAnnotation,
  editEntry, editEntryInCollection, exportFullBackup, getLastPosition, getPhraseComponents, getRelatedPhrases, getState,
  getPinsForCollection, getVisibleEntries, importEntries, initializeStore, moveCollection, redo,
  removeEntryFromCollection, renameCollection, renameDomain, reorderCollections, reorderDomains, replaceAnnotations, restoreBackup,
  search, setDomainGlossEnabled, setLastPosition, setNumberMode, subscribe, togglePin, undo,
} from './v3-store.js';
import {
  AiCheckController, checkEntries, createAiCheckBatches, getApiKey, getModelCatalog, getModelCatalogUpdatedAt,
  getSelectedModel, refreshModels, selectModel, setApiKey, suggestEntries, suggestSearchTerms,
} from './v3-ai.js';
import {
  downloadText, entriesToCsv, readImportFile,
} from './v3-import.js';
import { normalizeEnglish, systemPhraseCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID } from './v3-model.js';
import { NEW_COLLECTION_TARGET, NEW_DOMAIN_TARGET, createVixPackage } from './v3-exchange.js';

const APP_VERSION = '3.0.6';
/** @type {Record<string, any>} */
const elements = Object.fromEntries([
  'boot-screen', 'app', 'back-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'home-view', 'collection-view', 'collection-toolbar', 'pin-bar', 'annotation-review-bar', 'letter-nav', 'entry-list',
  'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',
  'app-dialog', 'dialog-form', 'dialog-title', 'dialog-description', 'dialog-close', 'dialog-body', 'dialog-actions',
  'action-dialog', 'action-title', 'action-description', 'action-close', 'action-body',
  'search-dialog', 'search-close', 'search-body',
  'confirm-dialog', 'confirm-form', 'confirm-title', 'confirm-description', 'confirm-body', 'confirm-cancel', 'confirm-submit',
  'hidden-file-input',
].map((id) => [id, document.getElementById(id)]));

let currentCollectionId = '';
const expandedLettersByCollection = new Map();
let pendingJumpEntryId = '';
let pendingJumpReason = 'jump';
let persistentJumpEntryId = '';
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
let suppressNextMutationRender = false;
const expandedRelations = new Set();
const dialogStack = [];
let currentDialogMeta = { onRestore: null };
let lockedScrollY = 0;
let openModalCount = 0;

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

const ICONS = {
  target: '<circle cx="12" cy="12" r="6.5"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"></path>',
  relation: '<circle cx="7" cy="8" r="2.25"></circle><circle cx="17" cy="8" r="2.25"></circle><circle cx="12" cy="17" r="2.25"></circle><path d="M9 8h6M8.5 10l2.3 4.7M15.5 10l-2.3 4.7"></path>',
  jump: '<path d="M13 5h6v6M19 5l-8 8"></path><path d="M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"></path>',
  pin: '<path d="M9 3h6l-1 5 3 3v2h-4v7l-1 2-1-2v-7H7v-2l3-3-1-5z"></path>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"></circle><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"></circle>',
  chevron: '<path d="m8 10 4 4 4-4"></path>',
  enter: '<path d="M19 5v7H7"></path><path d="m10 9-3 3 3 3"></path>',
};

function svgIcon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `ui-icon${className ? ` ${className}` : ''}`);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

function iconButton(name, className, label, handler, options = {}) {
  return el('button', {
    type: 'button', className, disabled: options.disabled || false,
    title: options.title || label, 'aria-label': label,
    on: { click: handler },
  }, [svgIcon(name)]);
}

function showToast(message, type = 'info') {
  const toast = el('div', { className: `toast${type === 'error' ? ' error' : ''}`, text: String(message) });
  elements['toast-region'].replaceChildren(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 2800);
}

function displayError(error) {
  console.error(error);
  const message = error?.message || String(error);
  if (String(message).includes('另一实例')) {
    showToast('已同步另一窗口的数据，请再试一次');
    return;
  }
  showToast(message, 'error');
}

function field(label, control, help = '') {
  const wrapper = el('label', { className: 'field' }, [el('span', { text: label }), control]);
  if (help) wrapper.append(el('p', { className: 'help-text', text: help }));
  return wrapper;
}

let viewportUpdateFrame = 0;
function updateVisualViewportVars() {
  cancelAnimationFrame(viewportUpdateFrame);
  viewportUpdateFrame = requestAnimationFrame(() => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--visual-height', `${Math.round(height)}px`);
  });
}

function lockPageForModal() {
  openModalCount += 1;
  if (openModalCount !== 1) return;
  lockedScrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.classList.add('modal-open');
  updateVisualViewportVars();
}

function unlockPageForModal() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount) return;
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  const targetY = lockedScrollY;
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, targetY)));
}

function snapshotAppDialog() {
  return {
    title: elements['dialog-title'].textContent,
    description: elements['dialog-description'].textContent,
    descriptionHidden: elements['dialog-description'].classList.contains('hidden'),
    body: [...elements['dialog-body'].childNodes],
    actions: [...elements['dialog-actions'].childNodes],
    submitHandler: dialogSubmitHandler,
    meta: currentDialogMeta,
  };
}

function restoreAppDialog(frame) {
  elements['dialog-title'].textContent = frame.title;
  elements['dialog-description'].textContent = frame.description;
  elements['dialog-description'].classList.toggle('hidden', frame.descriptionHidden);
  elements['dialog-body'].replaceChildren(...frame.body);
  elements['dialog-actions'].replaceChildren(...frame.actions);
  dialogSubmitHandler = frame.submitHandler;
  currentDialogMeta = frame.meta || { onRestore: null };
  currentDialogMeta.onRestore?.();
}

function closeDialog({ all = false } = {}) {
  if (!all && dialogStack.length) {
    const frame = dialogStack.pop();
    restoreAppDialog(frame);
    queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['dialog-body'].querySelector('input,textarea,select,button'))?.focus());
    return;
  }
  dialogStack.length = 0;
  if (elements['app-dialog'].open) {
    elements['app-dialog'].close();
    unlockPageForModal();
  }
  dialogSubmitHandler = null;
  currentDialogMeta = { onRestore: null };
}

function openDialog({
  title, description = '', body = [], submitText = '保存', cancelText = '取消', destructive = false,
  onSubmit = null, showCancel = null, onRestore = null,
}) {
  if (elements['app-dialog'].open) dialogStack.push(snapshotAppDialog());
  elements['dialog-title'].textContent = title;
  elements['dialog-description'].textContent = description;
  elements['dialog-description'].classList.toggle('hidden', !description);
  elements['dialog-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['dialog-actions'].replaceChildren();
  const includeCancel = showCancel == null ? Boolean(onSubmit) : Boolean(showCancel);
  if (includeCancel) elements['dialog-actions'].append(button(cancelText, 'secondary-button', () => closeDialog()));
  if (onSubmit) {
    const submit = el('button', { type: 'submit', className: destructive ? 'danger-button' : 'primary-button', text: submitText });
    elements['dialog-actions'].append(submit);
    dialogSubmitHandler = onSubmit;
  } else dialogSubmitHandler = null;
  currentDialogMeta = { onRestore };
  if (!elements['app-dialog'].open) {
    lockPageForModal();
    elements['app-dialog'].showModal();
  }
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['dialog-body'].querySelector('input,textarea,select,button'))?.focus());
}

function closeActionDialog() {
  if (elements['action-dialog'].open) {
    elements['action-dialog'].close();
    unlockPageForModal();
  }
}

function openActionDialog({ title, description = '', body = [] }) {
  elements['action-title'].textContent = title;
  elements['action-description'].textContent = description;
  elements['action-description'].classList.toggle('hidden', !description);
  elements['action-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  if (!elements['action-dialog'].open) {
    lockPageForModal();
    elements['action-dialog'].showModal();
  }
  queueMicrotask(() => /** @type {HTMLElement | null} */ (elements['action-body'].querySelector('button,input'))?.focus());
}

function closeSearchDialog() {
  if (elements['search-dialog'].open) {
    elements['search-dialog'].close();
    unlockPageForModal();
  }
}

function closeConfirmDialog() {
  if (elements['confirm-dialog'].open) {
    elements['confirm-dialog'].close();
    unlockPageForModal();
  }
  confirmSubmitHandler = null;
}

function openConfirmDialog({ title, description = '', body = [], submitText = '确认', onSubmit }) {
  elements['confirm-title'].textContent = title;
  elements['confirm-description'].textContent = description;
  elements['confirm-description'].classList.toggle('hidden', !description);
  elements['confirm-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['confirm-submit'].textContent = submitText;
  confirmSubmitHandler = onSubmit;
  if (!elements['confirm-dialog'].open) {
    lockPageForModal();
    elements['confirm-dialog'].showModal();
  }
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

function navigateCollection(collectionId, entryId = '', reason = 'jump') {
  const hash = collectionRoute(collectionId, entryId);
  if (location.hash !== hash) history.pushState(null, '', hash);
  currentCollectionId = collectionId;
  pendingJumpEntryId = entryId;
  pendingJumpReason = reason;
  renderApp();
}

function goHome() {
  closeReview();
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
  currentCollectionId = '';
  renderApp();
}

function projectionCollectionForEntry(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return '';
  if (entry.kind === 'phrase') return systemPhraseCollectionId(entry.domainId);
  return systemDomainWordsCollectionId(entry.domainId);
}


function positionDomainId(collection, entry = null) {
  return collection?.domainId || entry?.domainId || 'global';
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

function displayCollectionLabel(collection) {
  const label = String(collection?.label || '').trim();
  if (!label) return '';
  const normalized = label.toLocaleLowerCase();
  const name = String(collection?.name || '').trim().toLocaleLowerCase();
  if (normalized === name || normalized === `oxford ${name}`) return '';
  return label;
}

function collectionCard(collection) {
  const count = getVisibleEntries(collection.id).length;
  const label = displayCollectionLabel(collection);
  return el('button', {
    type: 'button',
    className: 'collection-card',
    on: { click: () => navigateCollection(collection.id) },
  }, [
    el('div', { className: 'collection-card-title' }, [
      el('h3', { text: collection.name }),
      el('span', { className: 'arrow' }, [svgIcon('jump')]),
    ]),
    label ? el('div', { className: 'label', text: label }) : null,
    el('div', { className: 'count', text: count.toLocaleString() }),
  ]);
}

function searchResultButton(entry, onSelect, collectionId = projectionCollectionForEntry(entry.id)) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  return el('button', { type: 'button', className: 'search-result', on: { click: () => onSelect(entry, collectionId) } }, [
    el('strong', { text: entry.text }),
    collection ? el('span', { text: collection.name }) : null,
  ]);
}

function makeSortableList(container, onCommit) {
  let dragged = null;
  let pointerId = null;
  const finish = async () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    pointerId = null;
    const ids = [...container.querySelectorAll(':scope > [data-sort-id]')].map((item) => item.dataset.sortId);
    try { await onCommit(ids); }
    catch (error) { displayError(error); }
  };
  container.querySelectorAll('.drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      const row = handle.closest('[data-sort-id]');
      if (!row) return;
      event.preventDefault();
      pointerId = event.pointerId;
      dragged = row;
      row.classList.add('dragging');
      handle.setPointerCapture?.(pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!dragged || event.pointerId !== pointerId) return;
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-sort-id]');
      if (!target || target === dragged || target.parentElement !== container) return;
      const rect = target.getBoundingClientRect();
      container.insertBefore(dragged, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
    });
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  });
}

function libraryManagerBody() {
  const state = getState();
  const root = el('div', { className: 'library-manager' });
  const domainList = el('div', { className: 'manager-domain-list' });
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    const phraseCollection = state.collectionById.get(systemPhraseCollectionId(domain.id));
    const normalCollections = state.collections
      .filter((item) => item.domainId === domain.id && item.type === 'normal' && !item.hidden)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const section = el('section', { className: 'manager-domain', dataset: { sortId: domain.id } });
    const domainHeader = el('div', { className: 'manager-domain-header' }, [
      button('☰', 'drag-handle', () => {}, { title: '拖动词域' }),
      el('strong', { text: domain.name }),
      iconButton('more', 'manager-more', '词域操作', () => openDomainMenu(domain.id)),
    ]);
    const fixed = el('div', { className: 'manager-fixed-list' }, [
      el('div', { className: 'manager-row fixed' }, [
        el('span', { className: 'manager-lock', text: '1' }),
        el('span', { className: 'manager-name', text: '总词表' }),
        el('span', { className: 'manager-count', text: getVisibleEntries(systemDomainWordsCollectionId(domain.id)).length.toLocaleString() }),
      ]),
      el('div', { className: 'manager-row fixed' }, [
        el('span', { className: 'manager-lock', text: '2' }),
        el('span', { className: 'manager-name', text: phraseCollection?.name || '短语' }),
        el('span', { className: 'manager-count', text: phraseCollection ? getVisibleEntries(phraseCollection.id).length.toLocaleString() : '0' }),
      ]),
    ]);
    const list = el('div', { className: 'manager-list' });
    for (const collection of normalCollections) {
      list.append(el('div', { className: 'manager-row', dataset: { sortId: collection.id } }, [
        button('☰', 'drag-handle', () => {}, { title: '拖动词表' }),
        el('span', { className: 'manager-name', text: collection.name }),
        el('span', { className: 'manager-count', text: getVisibleEntries(collection.id).length.toLocaleString() }),
        iconButton('more', 'manager-more', '词表操作', () => openCollectionMenu(collection.id)),
      ]));
    }
    list.append(button('＋', 'manager-add', () => openAddCollectionDialog(domain.id), { title: '新建词表' }));
    section.append(domainHeader, fixed, list);
    domainList.append(section);
    makeSortableList(list, (ids) => reorderCollections(domain.id, ids));
  }
  makeSortableList(domainList, reorderDomains);
  root.append(domainList, button('＋ 新建词域', 'secondary-button manager-add-domain', openAddDomainDialog));
  return root;
}

function openLibraryManager() {
  const mount = el('div');
  const refresh = () => mount.replaceChildren(libraryManagerBody());
  refresh();
  openDialog({ title: '管理词库', body: mount, showCancel: false, onRestore: refresh });
}

async function exportBackupNow() {
  const backup = await exportFullBackup();
  downloadText(`vocabulary-index-${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`, `${JSON.stringify(backup, null, 2)}\n`);
  showToast('完整备份已导出');
}

let dataExchangeWorker = null;
let dataExchangeRequestId = 0;
const dataExchangeRequests = new Map();

function getDataExchangeWorker() {
  if (dataExchangeWorker) return dataExchangeWorker;
  dataExchangeWorker = new Worker(new URL('./v3-data-worker.js', import.meta.url), { type: 'module' });
  dataExchangeWorker.addEventListener('message', (event) => {
    const pending = dataExchangeRequests.get(event.data?.id);
    if (!pending) return;
    dataExchangeRequests.delete(event.data.id);
    if (event.data.ok) pending.resolve(event.data.plan);
    else pending.reject(new Error(event.data.error || '内容预检失败'));
  });
  dataExchangeWorker.addEventListener('error', (event) => {
    for (const pending of dataExchangeRequests.values()) pending.reject(new Error(event.message || '数据工作线程异常'));
    dataExchangeRequests.clear();
    dataExchangeWorker?.terminate();
    dataExchangeWorker = null;
  });
  return dataExchangeWorker;
}

async function planDataExchangeFile(file, selection, conflictPolicy = 'current') {
  if (!file) throw new Error('请选择 JSON 文件');
  if (file.size > 64 * 1024 * 1024) throw new Error('导入文件超过 64 MB 上限');
  const [content, currentBackup] = await Promise.all([file.text(), exportFullBackup()]);
  const id = ++dataExchangeRequestId;
  return new Promise((resolve, reject) => {
    dataExchangeRequests.set(id, { resolve, reject });
    getDataExchangeWorker().postMessage({ id, content, currentBackup, selection, conflictPolicy });
  });
}

function dataExchangeFilename(scope, domainId = '', collectionId = '') {
  const state = getState();
  const clean = (value) => String(value || '').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'content';
  if (scope === 'domain') return `vix-domain-${clean(state.domainById.get(domainId)?.name || domainId)}.json`;
  if (scope === 'collection') return `vix-collection-${clean(state.collectionById.get(collectionId)?.name || collectionId)}.json`;
  return `vix-global-${APP_VERSION}.json`;
}

function dataExchangeSummary(plan) {
  const summary = plan.summary || {};
  const rows = [
    ['新增独立域', summary.addedDomains], ['移除独立域', summary.removedDomains],
    ['新增词表', summary.addedCollections], ['移除词表', summary.removedCollections],
    ['新增词汇', summary.addedWords], ['新增短语', summary.addedPhrases],
    ['更新释义', summary.updatedGlosses], ['新增归属', summary.addedMemberships],
    ['移除词汇', summary.removedWords], ['移除短语', summary.removedPhrases],
    ['移除归属', summary.removedMemberships], ['跳过重复', summary.skippedDuplicates],
    ['冲突', summary.conflicts],
  ].filter(([, value]) => Number(value || 0) > 0);
  if (!rows.length) rows.push(['变化', 0]);
  return el('div', { className: 'exchange-summary' }, rows.map(([label, value]) => el('div', { className: 'exchange-summary-row' }, [
    el('span', { text: label }), el('strong', { text: Number(value || 0).toLocaleString() }),
  ])));
}

function openDataExchangePreview(file, selection, initialPlan) {
  const conflictPolicy = el('select', {}, [
    el('option', { value: 'current', text: '保留当前释义' }),
    el('option', { value: 'import', text: '使用导入释义' }),
  ]);
  const targetMode = el('select', {}, [
    el('option', { value: 'current', text: '使用当前选择' }),
    el('option', { value: 'file', text: '使用文件声明目标' }),
  ]);
  const body = [
    el('div', { className: 'exchange-target-line', text: `${selection.scope === 'global' ? '全局' : selection.scope === 'domain' ? '独立域' : '词表'} · ${selection.mode === 'replace' ? '完整替换' : '增量合并'}` }),
    dataExchangeSummary(initialPlan),
  ];
  if (initialPlan.mismatch) body.push(el('div', { className: 'warning-box compact-warning', text: initialPlan.mismatch }), field('目标处理', targetMode));
  if (initialPlan.conflicts?.length) {
    body.push(field('释义冲突', conflictPolicy));
    body.push(el('div', { className: 'conflict-list' }, initialPlan.conflicts.slice(0, 20).map((item) => el('div', { className: 'conflict-item' }, [
      el('strong', { text: item.text }), el('span', { text: `${item.current} → ${item.incoming}` }),
    ]))));
    if (initialPlan.conflicts.length > 20) body.push(el('p', { className: 'help-text', text: `另有 ${initialPlan.conflicts.length - 20} 项冲突未展开。` }));
  }
  openDialog({
    title: '导入预检',
    description: '确认后会先自动下载恢复备份，再以单次事务写入。',
    body,
    submitText: selection.mode === 'replace' && selection.scope === 'global' ? '备份并替换全局内容' : '备份并导入',
    destructive: selection.mode === 'replace',
    onSubmit: async () => {
      const finalSelection = { ...selection, targetMode: initialPlan.mismatch ? targetMode.value : 'current' };
      const finalPlan = await planDataExchangeFile(file, finalSelection, initialPlan.conflicts?.length ? conflictPolicy.value : 'current');
      const recovery = await exportFullBackup();
      downloadText(`vocabulary-index-recovery-${APP_VERSION}-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}.json`, `${JSON.stringify(recovery, null, 2)}\n`);
      await restoreBackup(finalPlan.nextBackup);
      closeDialog({ all: true });
      goHome();
      showToast('内容 JSON 已导入');
    },
  });
}

function openDataExchangeDialog() {
  const state = getState();
  const operation = el('select', {}, [
    el('option', { value: 'import-content', text: '导入内容' }),
    el('option', { value: 'export-content', text: '导出内容' }),
    el('option', { value: 'export-backup', text: '导出完整备份' }),
    el('option', { value: 'restore-backup', text: '恢复完整备份' }),
  ]);
  const scope = el('select', {}, [
    el('option', { value: 'global', text: '全局' }),
    el('option', { value: 'domain', text: '独立域' }),
    el('option', { value: 'collection', text: '词表' }),
  ]);
  const domain = el('select');
  const collection = el('select');
  const mode = el('select', {}, [
    el('option', { value: 'merge', text: '增量合并' }),
    el('option', { value: 'replace', text: '完整替换' }),
  ]);
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  const status = el('p', { className: 'help-text exchange-status', text: '' });
  const scopeField = field('范围', scope);
  const domainField = field('独立域', domain);
  const collectionField = field('词表', collection);
  const modeField = field('写入方式', mode);
  const fileField = field('JSON 文件', file);

  const fillCollections = () => {
    const selectedDomainId = domain.value || state.domains[0]?.id || '';
    const list = state.collections.filter((item) => item.domainId === selectedDomainId && !item.hidden)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const includeNew = operation.value === 'import-content' && scope.value === 'collection';
    collection.replaceChildren(
      ...(includeNew ? [el('option', { value: NEW_COLLECTION_TARGET, text: '新建普通词表' })] : []),
      ...list.map((item) => el('option', { value: item.id, text: item.name })),
    );
  };
  const fillDomains = () => {
    const includeNew = operation.value === 'import-content' && scope.value === 'domain';
    domain.replaceChildren(
      ...(includeNew ? [el('option', { value: NEW_DOMAIN_TARGET, text: '新建独立域' })] : []),
      ...state.domains.map((item) => el('option', { value: item.id, text: item.name })),
    );
    fillCollections();
  };
  const refresh = () => {
    const contentOperation = ['import-content', 'export-content'].includes(operation.value);
    const importing = operation.value === 'import-content';
    scopeField.classList.toggle('hidden', !contentOperation);
    domainField.classList.toggle('hidden', !contentOperation || scope.value === 'global');
    collectionField.classList.toggle('hidden', !contentOperation || scope.value !== 'collection');
    modeField.classList.toggle('hidden', !importing);
    fileField.classList.toggle('hidden', !importing && operation.value !== 'restore-backup');
    if (operation.value === 'export-backup') status.textContent = '包含内容、PIN、位置、标注和设置。';
    else if (operation.value === 'restore-backup') status.textContent = '恢复会整体替换当前应用状态。';
    else if (operation.value === 'export-content') status.textContent = '内容 JSON 不包含 PIN、位置、标注和应用设置。';
    else status.textContent = mode.value === 'merge' ? '未在文件中出现的旧内容不会删除。' : '只替换当前选择的范围，并先生成恢复备份。';
    fillDomains();
  };
  operation.addEventListener('change', refresh);
  scope.addEventListener('change', refresh);
  domain.addEventListener('change', fillCollections);
  mode.addEventListener('change', refresh);
  refresh();

  openDialog({
    title: '数据交换',
    body: [el('div', { className: 'data-exchange-form' }, [field('功能', operation), scopeField, domainField, collectionField, modeField, fileField, status])],
    submitText: '执行',
    onSubmit: async () => {
      if (operation.value === 'export-backup') { await exportBackupNow(); return; }
      if (operation.value === 'restore-backup') {
        const parsed = await readImportFile(file.files?.[0]);
        if (parsed.kind !== 'backup') throw new Error('该文件不是完整备份');
        await restoreBackup(parsed.backup);
        closeDialog({ all: true });
        goHome();
        showToast('完整备份已恢复');
        return;
      }
      const selection = {
        scope: scope.value,
        mode: mode.value,
        domainId: scope.value === 'global' ? '' : domain.value,
        collectionId: scope.value === 'collection' ? collection.value : '',
        targetMode: 'current',
      };
      if (operation.value === 'export-content') {
        const backup = await exportFullBackup();
        const pkg = createVixPackage(backup, selection);
        downloadText(dataExchangeFilename(selection.scope, selection.domainId, selection.collectionId), `${JSON.stringify(pkg, null, 2)}\n`);
        showToast('内容 JSON 已导出');
        return;
      }
      const selectedFile = file.files?.[0];
      const plan = await planDataExchangeFile(selectedFile, selection, 'current');
      openDataExchangePreview(selectedFile, selection, plan);
    },
  });
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
  elements['page-subtitle'].textContent = `${getVisibleEntries(SYSTEM_GLOBAL_WORDS_ID).length.toLocaleString()} · 本地保存`;
  elements['settings-button'].replaceChildren(svgIcon('more'));
  elements['settings-button'].setAttribute('aria-label', '设置');

  const annotationTotal = state.annotations.length;
  const heroActions = [button('管理', 'secondary-button compact-button', openLibraryManager)];
  if (annotationTotal) heroActions.unshift(button(`${annotationTotal}`, 'secondary-button compact-button annotation-count-button', () => startAnnotationReview(''), { title: '待核查' }));
  const hero = el('section', { className: 'home-hero' }, [
    el('div', { className: 'home-hero-copy' }, [
      el('p', { className: 'eyebrow', text: 'VOCABULARY INDEX' }),
      el('h2', { text: '我的词表' }),
    ]),
    el('div', { className: 'home-hero-actions' }, heroActions),
  ]);

  const sections = [el('section', { className: 'index-scope global-scope' }, [
    el('header', { className: 'scope-heading' }, [el('h3', { text: '全局' })]),
    el('div', { className: 'collection-grid global-grid' }, [
      collectionCard(state.collectionById.get(SYSTEM_GLOBAL_WORDS_ID)),
      collectionCard(state.collectionById.get(SYSTEM_GLOBAL_PHRASES_ID)),
    ]),
  ])];
  for (const domain of [...state.domains].sort((a, b) => a.order - b.order)) {
    const phraseCollection = state.collectionById.get(systemPhraseCollectionId(domain.id));
    const normalCollections = state.collections
      .filter((item) => item.domainId === domain.id && item.type === 'normal' && !item.hidden)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const collections = [state.collectionById.get(systemDomainWordsCollectionId(domain.id)), phraseCollection, ...normalCollections].filter(Boolean);
    const grid = collections.length
      ? el('div', { className: 'collection-grid' }, collections.map(collectionCard))
      : el('div', { className: 'empty-state', text: '暂无内容' });
    sections.push(el('section', { className: 'index-scope domain-scope', dataset: { domainId: domain.id } }, [
      el('header', { className: 'scope-heading' }, [el('h3', { text: domain.name })]),
      grid,
    ]));
  }
  elements['home-view'].replaceChildren(hero, ...sections);
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
  elements['page-title'].textContent = collection.name;
  elements['page-subtitle'].textContent = [entries.length.toLocaleString(), displayCollectionLabel(collection)].filter(Boolean).join(' · ');
  elements['settings-button'].replaceChildren(svgIcon('more'));
  elements['settings-button'].setAttribute('aria-label', '更多');
  renderCollectionToolbar(collection);
  renderPinBar(collection);
  renderEntryList(collection, domain, entries);
  if (pendingJumpEntryId) queueMicrotask(() => jumpToEntry(pendingJumpEntryId, { collectionId: collection.id, reason: pendingJumpReason }));
}

function renderCollectionToolbar(collection) {
  const annotationCount = annotationCountForCollection(collection.id);
  if (annotationCount) {
    elements['collection-toolbar'].replaceChildren(el('div', { className: 'collection-quick-actions' }, [
      button(`${annotationCount}`, 'secondary-button compact-button annotation-count-button', () => startAnnotationReview(collection.id), { title: '待核查' }),
    ]));
  } else elements['collection-toolbar'].replaceChildren();
}

function lastPositionButton(collection) {
  const entryId = getLastPosition(positionDomainId(collection), collection.id);
  return iconButton('target', 'last-position-button', '继续上次位置', () => {
    const current = getLastPosition(positionDomainId(collection), collection.id);
    if (current) jumpToEntry(current, { collectionId: collection.id, reason: 'last' });
  }, { disabled: !entryId, title: entryId ? '继续上次位置' : '尚无上次位置' });
}

function updateLastPositionButton(collection) {
  const target = elements['letter-nav'].querySelector('.last-position-button');
  if (!target) return;
  target.disabled = !getLastPosition(positionDomainId(collection), collection.id);
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
    iconButton('chevron', 'pin-nav-button pin-prev', '上一个 PIN', () => jumpPinned(collection.id, -1)),
    el('button', { type: 'button', className: 'pin-current', 'aria-label': '重新定位当前 PIN', on: { click: () => entry && jumpToEntry(entry.id, { reason: 'pin' }) } }, [
      el('span', { className: 'pin-kicker', text: `PIN ${pinIndex + 1}/${pins.length}` }),
      el('strong', { text: entry?.text || 'PIN 已失效' }),
    ]),
    iconButton('chevron', 'pin-nav-button pin-next', '下一个 PIN', () => jumpPinned(collection.id, 1)),
  );
}

function letterForEntry(entry) {
  const letter = entry.normalizedText.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '#';
}

function isPhraseCollection(collection) {
  return collection.type === 'system-phrases' || collection.type === 'system-global-phrases';
}

function renderEntryList(collection, domain, entries) {
  collectionRenderContext = null;
  if (isPhraseCollection(collection)) {
    elements['letter-nav'].classList.remove('hidden');
    elements['letter-nav'].replaceChildren(lastPositionButton(collection));
    const globalIndexById = new Map(entries.map((entry, index) => [entry.id, index + 1]));
    collectionRenderContext = { collection, domain, entries, grouped: new Map(), globalIndexById, sectionByLetter: new Map(), flat: true };
    elements['entry-list'].replaceChildren(el('section', { className: 'letter-section flat-section' }, [
      el('div', { className: 'letter-body flat-body' }, entries.map((entry, index) => renderEntryRow(entry, collection, domain, { groupIndex: index + 1, globalIndex: index + 1 }))),
    ]));
    return;
  }
  if (!entries.length) {
    elements['letter-nav'].classList.remove('hidden');
    elements['letter-nav'].replaceChildren(lastPositionButton(collection));
    elements['entry-list'].replaceChildren(el('div', { className: 'empty-state', text: '暂无内容' }));
    return;
  }

  const globalIndexById = new Map(entries.map((entry, index) => [entry.id, index + 1]));
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
  elements['letter-nav'].replaceChildren(lastPositionButton(collection), ...letters.map((letter) => {
    const control = button(letter, grouped.has(letter) ? '' : 'empty', () => {
      if (!grouped.has(letter)) return;
      setLetterSectionOpen(letter, true);
      const section = sectionByLetter.get(letter);
      if (section) {
        suppressScrollPersistence(450);
        positionElementAtReadingAnchor(section.querySelector('.letter-heading') || section);
      }
    }, { disabled: !grouped.has(letter) });
    control.dataset.letter = letter;
    return control;
  }));

  const sections = [];
  for (const letter of letters.filter((item) => grouped.has(item))) {
    const section = el('section', {
      className: 'letter-section', id: `letter-${letter === '#' ? 'other' : letter}`, dataset: { letter },
    });
    const heading = button('', 'letter-heading', () => setLetterSectionOpen(letter, !expandedLetters.has(letter)));
    heading.setAttribute('aria-expanded', expandedLetters.has(letter) ? 'true' : 'false');
    heading.append(
      el('span', { className: 'letter-title', text: letter }),
      el('span', { className: 'letter-count', text: grouped.get(letter).length.toLocaleString() }),
      el('span', { className: 'letter-indicator' }, [svgIcon('chevron')]),
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
  if (indicator) indicator.classList.toggle('open', open);
  updateActiveLetter(letter);
  return true;
}

function updateActiveLetter(letter = '') {
  elements['letter-nav'].querySelectorAll('[data-letter]').forEach((item) => item.classList.toggle('active', Boolean(letter) && item.dataset.letter === letter));
}

function preferredNormalDestination(entry) {
  if (!entry) return null;
  const state = getState();
  const candidates = (state.membershipsByEntry.get(entry.id) || [])
    .map((membership) => ({ membership, collection: state.collectionById.get(membership.collectionId) }))
    .filter((item) => item.collection?.type === 'normal' && !item.collection.hidden)
    .sort((a, b) => Number(a.collection.order || 0) - Number(b.collection.order || 0)
      || Number(a.membership.sourceOrder || 0) - Number(b.membership.sourceOrder || 0)
      || a.collection.name.localeCompare(b.collection.name));
  return candidates[0]
    ? { entry, collectionId: candidates[0].collection.id, label: candidates[0].collection.name, domainId: entry.domainId }
    : { entry, collectionId: systemDomainWordsCollectionId(entry.domainId), label: '总词表', domainId: entry.domainId };
}

function globalPhraseRepresentative(normalizedText) {
  return getState().globalPhraseByNormalizedText.get(normalizedText) || null;
}

function relationItemsForEntry(entry) {
  const state = getState();
  if (entry.kind === 'word') {
    const sourceWords = currentCollectionId === SYSTEM_GLOBAL_WORDS_ID
      ? (state.wordsByNormalizedText.get(entry.normalizedText) || [entry])
      : [entry];
    const phrases = new Map();
    for (const word of sourceWords) {
      for (const phrase of getRelatedPhrases(word.id)) phrases.set(`${phrase.domainId}:${phrase.normalizedText}`, phrase);
    }
    const byText = new Map();
    for (const phrase of phrases.values()) {
      const item = byText.get(phrase.normalizedText) || { text: phrase.text, destinations: [] };
      const targetEntry = currentCollectionId === SYSTEM_GLOBAL_WORDS_ID ? globalPhraseRepresentative(phrase.normalizedText) : phrase;
      const targetCollectionId = currentCollectionId === SYSTEM_GLOBAL_WORDS_ID ? SYSTEM_GLOBAL_PHRASES_ID : systemPhraseCollectionId(phrase.domainId);
      if (targetEntry && !item.destinations.some((destination) => destination.collectionId === targetCollectionId && destination.entry.id === targetEntry.id)) {
        item.destinations.push({ entry: targetEntry, collectionId: targetCollectionId, label: state.collectionById.get(targetCollectionId)?.name || '短语', domainId: phrase.domainId });
      }
      byText.set(phrase.normalizedText, item);
    }
    return [...byText.values()].sort((a, b) => normalizeEnglish(a.text).localeCompare(normalizeEnglish(b.text), 'en'));
  }

  const sourcePhrases = currentCollectionId === SYSTEM_GLOBAL_PHRASES_ID
    ? (state.phrasesByNormalizedText.get(entry.normalizedText) || [entry])
    : [entry];
  const byToken = new Map();
  for (const phrase of sourcePhrases) {
    for (const component of getPhraseComponents(phrase.id)) {
      const key = normalizeEnglish(component.token);
      if (!key) continue;
      const item = byToken.get(key) || { text: component.token, destinations: [] };
      const destination = preferredNormalDestination(component.entry);
      if (destination && !item.destinations.some((candidate) => candidate.collectionId === destination.collectionId && candidate.entry.id === destination.entry.id)) {
        item.destinations.push(destination);
      }
      byToken.set(key, item);
    }
  }
  return [...byToken.values()].sort((a, b) => normalizeEnglish(a.text).localeCompare(normalizeEnglish(b.text), 'en'));
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  else {
    const input = el('textarea', { value: text, readOnly: true });
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    if (!document.execCommand('copy')) throw new Error('浏览器拒绝复制');
    input.remove();
  }
  showToast(`已复制：${text}`);
}

function navigateRelationDestination(destination) {
  closeActionDialog();
  navigateCollection(destination.collectionId, destination.entry.id, 'relation');
}

function jumpToRelation(item) {
  const destinations = item.destinations || [];
  if (!destinations.length) return;
  if (destinations.length === 1) {
    navigateRelationDestination(destinations[0]);
    return;
  }
  const state = getState();
  openActionDialog({
    title: item.text,
    description: '选择目标词表',
    body: [el('div', { className: 'action-list' }, destinations.map((destination) => {
      const domainName = state.domainById.get(destination.domainId)?.name || '';
      return button([domainName, destination.label].filter(Boolean).join(' · '), '', () => navigateRelationDestination(destination));
    }))],
  });
}

function renderRelationPanel(entry) {
  const items = relationItemsForEntry(entry);
  if (!items.length || !expandedRelations.has(entry.id)) return null;
  return el('div', { className: 'relation-panel' }, items.map((item) =>
    el('div', { className: 'relation-item' }, [
      el('button', { type: 'button', className: 'relation-copy', on: { click: () => copyText(item.text).catch(displayError) } }, [el('span', { text: item.text })]),
      item.destinations?.length ? iconButton('jump', 'relation-jump', `跳转到 ${item.text}`, () => jumpToRelation(item)) : null,
    ])));
}

function toggleEntryRelations(entryId) {
  if (expandedRelations.has(entryId)) expandedRelations.delete(entryId);
  else expandedRelations.add(entryId);
  const context = collectionRenderContext;
  const entry = getState().entryById.get(entryId);
  const current = document.getElementById(`entry-${entryId}`);
  if (!context || !entry || !current) return;
  const index = context.entries.findIndex((item) => item.id === entryId) + 1;
  const group = context.grouped.get(letterForEntry(entry)) || [];
  const groupIndex = group.findIndex((item) => item.id === entryId) + 1;
  current.replaceWith(renderEntryRow(entry, context.collection, context.domain, { groupIndex, globalIndex: index }));
}

async function toggleEntryPin(entry, collection, sourceButton = null) {
  const wasPinned = getState().pinByEntry.has(entry.id);
  sourceButton?.classList.toggle('active', !wasPinned);
  sourceButton?.setAttribute('aria-pressed', wasPinned ? 'false' : 'true');
  suppressNextMutationRender = true;
  try {
    await togglePin(entry.id, collection.id);
  } catch (error) {
    suppressNextMutationRender = false;
    sourceButton?.classList.toggle('active', wasPinned);
    sourceButton?.setAttribute('aria-pressed', wasPinned ? 'true' : 'false');
    throw error;
  }
  syncPinIndexForEntry(collection.id, entry.id);
  const context = collectionRenderContext;
  const current = document.getElementById(`entry-${entry.id}`);
  if (context && current) {
    const index = context.entries.findIndex((item) => item.id === entry.id) + 1;
    const group = context.grouped.get(letterForEntry(entry)) || [];
    const groupIndex = group.findIndex((item) => item.id === entry.id) + 1;
    current.replaceWith(renderEntryRow(entry, collection, context.domain, { groupIndex, globalIndex: index }));
  }
  renderPinBar(collection);
  showToast(wasPinned ? 'PIN 已取消' : 'PIN 已设置');
}

function displayGlossForEntry(entry, collection, domain) {
  const state = getState();
  if (collection.id === SYSTEM_GLOBAL_WORDS_ID) {
    const candidates = state.wordsByNormalizedText.get(entry.normalizedText) || [entry];
    return [...candidates]
      .sort((a, b) => Number(state.domainById.get(a.domainId)?.order || 0) - Number(state.domainById.get(b.domainId)?.order || 0))
      .find((candidate) => state.domainById.get(candidate.domainId)?.glossEnabled && candidate.glossHant)?.glossHant || '';
  }
  if (collection.id === SYSTEM_GLOBAL_PHRASES_ID) {
    const candidates = state.phrasesByNormalizedText.get(entry.normalizedText) || [entry];
    return [...candidates]
      .sort((a, b) => Number(state.domainById.get(a.domainId)?.order || 0) - Number(state.domainById.get(b.domainId)?.order || 0))
      .find((candidate) => state.domainById.get(candidate.domainId)?.glossEnabled && candidate.glossHant)?.glossHant || '';
  }
  return domain?.glossEnabled ? entry.glossHant || '' : '';
}

function renderEntryRow(entry, collection, domain, indexes = { groupIndex: 0, globalIndex: 0 }) {
  const state = getState();
  const pinned = state.pinByEntry.has(entry.id);
  const annotation = state.annotationByEntry.get(entry.id);
  const numberMode = state.settings.numberMode || 'global';
  const indexText = numberMode === 'group' ? `${indexes.groupIndex}.` : numberMode === 'global' ? `${indexes.globalIndex}.` : '';
  const relations = relationItemsForEntry(entry);
  const expanded = expandedRelations.has(entry.id);
  const gloss = displayGlossForEntry(entry, collection, domain);
  const row = el('article', { className: `entry-row${expanded ? ' relations-open' : ''}`, id: `entry-${entry.id}`, dataset: { entryId: entry.id } });
  const line = el('div', { className: 'entry-line' }, [
    el('button', { type: 'button', className: 'copy-entry', on: { click: () => copyEntry(entry, collection) } }, [
      indexText ? el('span', { className: 'entry-index', text: indexText }) : null,
      el('span', { className: 'entry-text', text: entry.text }),
    ]),
    gloss ? el('span', { className: 'entry-gloss', text: gloss, title: gloss }) : el('span', { className: 'entry-gloss empty', 'aria-hidden': 'true' }),
    annotation ? button('•', 'entry-annotation', () => startAnnotationReview(collection.id, entry.id), { title: '待核查' }) : null,
    relations.length ? iconButton('relation', `entry-relations${expanded ? ' active' : ''}`, expanded ? '收起关联' : '展开关联', () => toggleEntryRelations(entry.id)) : el('span', { className: 'entry-relations-placeholder', 'aria-hidden': 'true' }),
    el('button', { type: 'button', className: `entry-pin${pinned ? ' active' : ''}`, title: pinned ? '取消 PIN' : '设置 PIN', 'aria-label': pinned ? '取消 PIN' : '设置 PIN', 'aria-pressed': pinned ? 'true' : 'false', on: { click: (event) => toggleEntryPin(entry, collection, event.currentTarget).catch(displayError) } }, [svgIcon('pin')]),
    iconButton('more', 'entry-more', '更多', () => openEntryActions(entry.id, collection.id)),
  ]);
  row.append(line);
  const relationPanel = renderRelationPanel(entry);
  if (relationPanel) row.append(relationPanel);
  return row;
}

function openEntryActions(entryId, collectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const collection = state.collectionById.get(collectionId);
  if (!entry || !collection) return;
  const memberships = state.membershipsByEntry.get(entry.id) || [];
  const annotation = state.annotationByEntry.get(entry.id);
  const normalActions = [
    button('编辑', '', () => openEditEntryDialog(entry.id, collection.id)),
    entry.kind === 'word' ? button('添加短语', '', () => openAddRelatedPhraseDialog(entry.id)) : null,
    annotation ? button('核查标注', '', () => { closeActionDialog(); startAnnotationReview(collection.id, entry.id); }) : null,
  ].filter(Boolean);
  const dangerActions = [];
  if (entry.kind === 'word' && memberships.some((item) => item.collectionId === collection.id)) {
    dangerActions.push(button('从当前词表移除', 'danger', () => confirmRemoveSource(entry.id, collection.id)));
  }
  dangerActions.push(button('删除', 'danger', () => confirmDeleteEntry(entry.id)));
  openActionDialog({
    title: entry.text,
    body: [normalActions.length ? el('div', { className: 'action-list' }, normalActions) : null, el('div', { className: 'action-list danger-zone' }, dangerActions)].filter(Boolean),
  });
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
    await setLastPosition(positionDomainId(collection, entry), collection.id, entry.id);
    lastPersistedEntryId = entry.id;
    if (firstSavedPosition && currentCollectionId === collection.id) updateLastPositionButton(collection);
    clearPersistentJump();
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
  if (context.flat) return document.getElementById(`entry-${entryId}`);
  const letter = letterForEntry(entry);
  setLetterSectionOpen(letter, true);
  updateActiveLetter(letter);
  row = document.getElementById(`entry-${entryId}`);
  return row;
}

function suppressScrollPersistence(milliseconds = 700) {
  suppressScrollPersistenceUntil = Math.max(suppressScrollPersistenceUntil, Date.now() + milliseconds);
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = 0;
}

function clearPersistentJump() {
  if (!persistentJumpEntryId) return;
  document.getElementById(`entry-${persistentJumpEntryId}`)?.classList.remove('jump-selected');
  persistentJumpEntryId = '';
}

function readingViewportBounds() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const candidates = [document.querySelector('.topbar'), elements['pin-bar'], elements['annotation-review-bar'], elements['letter-nav']];
  let top = 0;
  for (const candidate of candidates) {
    if (!candidate || candidate.classList.contains('hidden')) continue;
    const rect = candidate.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > top && rect.top < viewportHeight) top = rect.bottom;
  }
  return { top: Math.max(0, top + 8), bottom: viewportHeight - 12 };
}

function positionElementAtReadingAnchor(target) {
  const rect = target.getBoundingClientRect();
  const bounds = readingViewportBounds();
  if (rect.top >= bounds.top && rect.bottom <= bounds.bottom) return false;
  const anchor = bounds.top + (bounds.bottom - bounds.top) * 0.38;
  const targetY = Math.max(0, window.scrollY + rect.top - anchor + rect.height / 2);
  window.scrollTo({ top: targetY, behavior: 'auto' });
  return true;
}

function markJumpTarget(row, reason = 'jump') {
  document.querySelectorAll('.entry-row.jump-highlight').forEach((item) => item.classList.remove('jump-highlight'));
  if (reason !== 'pin') clearPersistentJump();
  row.classList.remove('jump-highlight');
  void row.offsetWidth;
  row.classList.add('jump-highlight');
  if (reason === 'pin') {
    clearPersistentJump();
    persistentJumpEntryId = row.dataset.entryId || '';
    row.classList.add('jump-selected');
  }
  setTimeout(() => row.classList.remove('jump-highlight'), 1500);
}

/** @param {string} entryId @param {{ behavior?: ScrollBehavior, collectionId?: string, reason?: string }} [options] */
function jumpToEntry(entryId, { behavior = 'auto', collectionId = currentCollectionId, reason = 'jump' } = {}) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) { showToast('内容已不存在'); return false; }
  const targetCollectionId = collectionId || projectionCollectionForEntry(entryId);
  const visible = targetCollectionId ? getVisibleEntries(targetCollectionId) : [];
  if (!targetCollectionId || !visible.some((item) => item.id === entryId)) {
    showToast('该位置已失效');
    return false;
  }
  if (targetCollectionId !== currentCollectionId) {
    navigateCollection(targetCollectionId, entryId, reason);
    return true;
  }
  syncPinIndexForEntry(currentCollectionId, entryId);
  pendingJumpEntryId = '';
  pendingJumpReason = 'jump';
  if (location.hash.includes('entry=')) history.replaceState(null, '', collectionRoute(currentCollectionId));
  const collection = state.collectionById.get(currentCollectionId);
  if (collection) renderPinBar(collection);
  const row = ensureEntryRendered(entryId);
  if (!row) return false;
  suppressScrollPersistence(550);
  requestAnimationFrame(() => {
    positionElementAtReadingAnchor(row);
    requestAnimationFrame(() => markJumpTarget(row, reason));
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
  jumpToEntry(entryId, { reason: 'pin' });
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
  if (persistentJumpEntryId && Date.now() >= suppressScrollPersistenceUntil) clearPersistentJump();
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
      const firstSavedPosition = !getLastPosition(positionDomainId(collection, entry), collection.id);
      lastPersistedEntryId = entry.id;
      setLastPosition(positionDomainId(collection, entry), collection.id, entry.id)
        .then(() => {
          if (firstSavedPosition && currentCollectionId === collection.id) updateLastPositionButton(collection);
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
  const isPhrase = collection.type === 'system-phrases';
  const text = el('input', { required: true, maxlength: 160, placeholder: isPhrase ? '例如：thread pool' : '例如：thread' });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field(isPhrase ? '短语' : '词汇', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: isPhrase ? '新增短语' : '新增词汇',
    body,
    onSubmit: async () => {
      const entry = await addEntry(collectionId, text.value, { gloss: gloss.value });
      pendingJumpEntryId = entry.id;
    },
  });
}

function openAddRelatedPhraseDialog(entryId) {
  const entry = getState().entryById.get(entryId);
  const domain = getState().domainById.get(entry.domainId);
  const text = el('input', { required: true, maxlength: 160, placeholder: `必须包含词元 “${entry.text}”` });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field('英文短语', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({ title: '添加短语', body, onSubmit: async () => { await addPhraseForWord(entryId, text.value, { gloss: gloss.value }); } });
}

function openEditEntryDialog(entryId, collectionId = currentCollectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(entry?.domainId);
  if (!entry || !collection) return;
  const membership = (state.membershipsByEntry.get(entry.id) || []).find((item) => item.collectionId === collectionId);
  const text = el('input', { required: true, maxlength: 160, value: entry.text, autocomplete: 'off', spellcheck: false });
  const gloss = el('input', { maxlength: 120, value: entry.glossHant || '', placeholder: '可输入简体或繁体' });
  const body = [field(entry.kind === 'phrase' ? '短语' : '词汇', text)];
  if (domain?.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: '编辑',
    body,
    onSubmit: async () => {
      if (entry.kind === 'word' && membership) {
        await editEntryInCollection(entry.id, collection.id, { text: text.value, sourceLabel: membership.sourceLabel || '', gloss: gloss.value }, entry.updatedAt);
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
  if (collection.virtual) {
    openActionDialog({ title: collection.name, body: [
      el('div', { className: 'action-list' }, [
        button('导出 CSV', '', () => { exportCollectionCsv(collection.id); closeActionDialog(); }),
        annotationCount ? button(`待核查 ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id); }) : null,
        button('应用设置与备份', '', () => openSettingsDialog()),
      ].filter(Boolean)),
    ] });
    return;
  }
  const actions = [
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: '新增' }),
      el('div', { className: 'action-list' }, [
        button(collection.type === 'system-phrases' ? '新增短语' : '新增词汇', '', () => openAddEntryDialog(collection.id)),
        button('AI 新增', '', () => openAiAddDialog(collection.id)),
      ]),
    ]),
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: 'AI' }),
      el('div', { className: 'action-list' }, [
        button('AI 核查', '', () => openAiCheckDialog(collection.id), { disabled: Boolean(activeTask) || !entries.length }),
        annotationCount ? button(`待核查 ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id); }) : null,
      ].filter(Boolean)),
    ]),
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: '数据' }),
      el('div', { className: 'action-list' }, [
        button('导入', '', () => openImportDialog(collection.id)),
        button('导出 CSV', '', () => { exportCollectionCsv(collection.id); closeActionDialog(); }),
        button('撤销', '', async () => { closeActionDialog(); await performUndo(); }),
        button('重做', '', async () => { closeActionDialog(); await performRedo(); }),
      ]),
    ]),
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: '管理' }),
      el('div', { className: 'action-list' }, [
        collection.type === 'normal' ? button('当前词表', '', () => openCollectionMenu(collection.id)) : null,
        button('应用设置与备份', '', () => openSettingsDialog()),
      ].filter(Boolean)),
    ]),
  ];
  openActionDialog({ title: collection.name, body: actions });
}

function openCollectionMenu(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  if (!collection || collection.type !== 'normal') return;
  const name = el('input', { value: collection.name, required: true, maxlength: 40 });
  const label = el('input', { value: collection.label || '', maxlength: 80 });
  const body = [field('名称', name), field('副标题', label)];
  if (annotationCountForCollection(collectionId)) body.push(button('清空标注', 'secondary-button', async () => { await clearAnnotationsForCollection(collectionId); }));
  body.push(button('删除词表', 'danger-button', () => confirmDeleteCollection(collectionId)));
  openDialog({ title: collection.name, body, onSubmit: async () => { await renameCollection(collectionId, name.value, label.value); } });
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
      const items = parsed.entries.slice(0, 80).map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.gloss ? ` · ${item.gloss}` : ''}` }));
      if (parsed.entries.length > 80) items.push(el('div', { className: 'preview-item muted', text: `另有 ${parsed.entries.length - 80} 项未显示` }));
      if (parsed.errors.length) items.unshift(el('div', { className: 'preview-item danger', text: `${parsed.errors.length} 行存在问题，将跳过无效行。` }));
      preview.replaceChildren(...items);
    } catch (error) { parsed = null; preview.replaceChildren(el('div', { className: 'preview-item danger', text: error.message })); }
  });
  openDialog({
    title: '导入',
    description: '支持 TXT、Markdown、CSV 和 JSON。',
    body: [field('文件', fileInput), field('导入方式', mode), preview],
    submitText: '执行导入',
    onSubmit: async () => {
      if (!parsed || parsed.kind !== 'entries') throw new Error('请选择有效文件');
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
    description: `将删除“${collection.name}”的来源关系；仍有其他来源的词汇会自动回落。`,
    body: el('div', { className: 'warning-box', text: '该操作可以立即撤销，但建议在大规模修改前先导出完整 JSON。' }),
    submitText: '确认删除',
    onSubmit: async () => {
      await deleteCollection(collectionId);
      if (currentCollectionId === collectionId) { closeActionDialog(); closeDialog({ all: true }); goHome(); }
      else currentDialogMeta.onRestore?.();
    },
  });
}

function confirmDeleteDomain(domainId) {
  closeDialog();
  const domain = getState().domainById.get(domainId);
  openConfirmDialog({
    title: '删除整个词域',
    description: `将删除“${domain.name}”及其中全部词表、内容、PIN 和标注。`,
    body: el('div', { className: 'warning-box', text: '这是大范围操作。请确认已有完整 JSON 备份。' }),
    submitText: '确认删除词域',
    onSubmit: async () => { await deleteDomain(domainId); currentDialogMeta.onRestore?.(); goHome(); },
  });
}

function confirmRemoveSource(entryId, collectionId) {
  const entry = getState().entryById.get(entryId);
  openConfirmDialog({
    title: '从当前词表移除',
    description: `从当前词表移除 “${entry.text}”。`,
    body: el('p', { className: 'help-text', text: '若它仍属于其他词表，将自动显示在优先级最高的剩余词表；普通词失去全部来源后会被删除。' }),
    submitText: '移除',
    onSubmit: async () => { await removeEntryFromCollection(entryId, collectionId); closeActionDialog(); },
  });
}

function confirmDeleteEntry(entryId) {
  const entry = getState().entryById.get(entryId);
  openConfirmDialog({
    title: '删除',
    description: `删除 “${entry.text}” 及其全部来源、PIN、标注和短语索引。`,
    body: el('div', { className: 'warning-box', text: '该操作可以通过撤销恢复。' }),
    submitText: '彻底删除',
    onSubmit: async () => { await deleteEntry(entryId); closeActionDialog(); },
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
      resultBox.replaceChildren(...candidates.map((item) => el('div', { className: 'preview-item', text: `${item.text}${item.gloss ? ` · ${item.gloss}` : ''}` })));
    } catch (error) { displayError(error); }
    finally { generate.disabled = false; generate.textContent = '重新生成'; }
  });
  openDialog({
    title: 'AI 新增',
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
  if (!collection || !entries.length) { showToast('当前词表没有可核查内容'); return; }
  const batches = createAiCheckBatches(entries);
  const model = getSelectedModel();
  const summary = el('div', { className: 'preview-list' }, [
    el('div', { className: 'preview-item', text: collection.name }),
    el('div', { className: 'preview-item', text: entries.length.toLocaleString() }),
    el('div', { className: 'preview-item', text: `${batches.length} 批` }),
    el('div', { className: `preview-item${model ? '' : ' danger'}`, text: model || '未选择模型' }),
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
  jumpToEntry(review.ids[review.index], { reason: 'annotation' });
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
  else { renderReviewBar(); jumpToEntry(entryId, { reason: 'annotation' }); }
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
      jumpToEntry(review.ids[review.index], { reason: 'annotation' });
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
  const input = el('input', { type: 'search', placeholder: '搜索', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select');
  scope.append(el('option', { value: 'all', text: '全部' }));
  scope.append(el('option', { value: `collection:${SYSTEM_GLOBAL_WORDS_ID}`, text: '全局总表' }));
  scope.append(el('option', { value: `collection:${SYSTEM_GLOBAL_PHRASES_ID}`, text: '全局短语表' }));
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    scope.append(el('option', { value: `domain:${domain.id}`, text: domain.name }));
    const group = el('optgroup', { label: domain.name });
    group.append(el('option', { value: `collection:${systemDomainWordsCollectionId(domain.id)}`, text: '总词表' }));
    const collections = state.collections
      .filter((item) => item.domainId === domain.id && !item.hidden)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const collection of collections) group.append(el('option', { value: `collection:${collection.id}`, text: collection.name }));
    scope.append(group);
  }
  scope.value = currentCollectionId ? `collection:${currentCollectionId}` : 'all';

  const aiButton = button('AI 联想', 'secondary-button hidden', async () => {});
  const status = el('p', { className: 'search-status help-text' });
  const results = el('div', { className: 'search-results' });
  let requestSequence = 0;
  let searchTimer = 0;
  let allowedScopeValue = '';
  let allowedIds = new Set();

  const visibleIds = () => {
    const value = scope.value;
    if (value === allowedScopeValue) return allowedIds;
    allowedScopeValue = value;
    if (value === 'all') allowedIds = new Set(state.entries.map((entry) => entry.id));
    else if (value.startsWith('domain:')) {
      const domainId = value.slice('domain:'.length);
      allowedIds = new Set(state.entries.filter((entry) => entry.domainId === domainId).map((entry) => entry.id));
    } else if (value.startsWith('collection:')) {
      allowedIds = new Set(getVisibleEntries(value.slice('collection:'.length)).map((entry) => entry.id));
    } else allowedIds = new Set();
    return allowedIds;
  };
  const selectResult = (entry, collectionId) => {
    const targetEntry = collectionId === SYSTEM_GLOBAL_PHRASES_ID ? (globalPhraseRepresentative(entry.normalizedText) || entry) : entry;
    closeSearchDialog();
    requestAnimationFrame(() => requestAnimationFrame(() => navigateCollection(collectionId, targetEntry.id, 'search')));
  };
  const targetCollectionForResult = (entry) => {
    const value = scope.value;
    if (value.startsWith('collection:')) {
      const id = value.slice('collection:'.length);
      if (getVisibleEntries(id).some((candidate) => candidate.id === entry.id)) return id;
    }
    if (value.startsWith('domain:')) return entry.kind === 'phrase'
      ? systemPhraseCollectionId(entry.domainId)
      : systemDomainWordsCollectionId(entry.domainId);
    return entry.kind === 'phrase' ? SYSTEM_GLOBAL_PHRASES_ID : SYSTEM_GLOBAL_WORDS_ID;
  };
  const showEntries = (entries, label = '') => {
    status.textContent = label || (entries.length ? entries.length.toLocaleString() : '无结果');
    results.replaceChildren(...entries.map((entry) => searchResultButton(entry, selectResult, targetCollectionForResult(entry))));
  };
  const renderLocal = () => {
    requestSequence += 1;
    const query = input.value.trim();
    aiButton.classList.toggle('hidden', !isChineseQuery(query));
    if (!query) {
      status.textContent = '';
      results.replaceChildren();
      return;
    }
    const allowed = visibleIds();
    const found = search(query, { limit: 180 }).filter((entry) => allowed.has(entry.id)).slice(0, 80);
    showEntries(found);
  };
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = window.setTimeout(renderLocal, 140);
  });
  scope.addEventListener('change', () => {
    allowedScopeValue = '';
    clearTimeout(searchTimer);
    renderLocal();
  });
  aiButton.addEventListener('click', async () => {
    const query = input.value.trim();
    if (!query) return;
    const sequence = ++requestSequence;
    aiButton.disabled = true;
    aiButton.textContent = '联想中…';
    status.textContent = '';
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
      showEntries(found);
    } catch (error) {
      if (sequence === requestSequence) displayError(error);
    } finally {
      if (sequence === requestSequence) {
        aiButton.disabled = false;
        aiButton.textContent = 'AI 联想';
      }
    }
  });
  elements['search-body'].replaceChildren(el('div', { className: 'search-controls' }, [input, scope, aiButton]), status, results);
  if (!elements['search-dialog'].open) {
    lockPageForModal();
    elements['search-dialog'].showModal();
  }
  requestAnimationFrame(updateVisualViewportVars);
}

function openSettingsDialog() {
  const state = getState();
  const key = el('input', { type: 'password', value: getApiKey(), autocomplete: 'off', placeholder: 'gsk_…' });
  const model = el('select');
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '无序号', selected: state.settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '字母内编号', selected: state.settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '连续编号', selected: !['none', 'group'].includes(state.settings.numberMode) }),
  ]);
  const updated = el('p', { className: 'help-text' });
  const renderModels = () => {
    const catalog = getModelCatalog();
    model.replaceChildren(el('option', { value: '', text: catalog.length ? '选择模型' : '未刷新' }), ...catalog.map((item) => el('option', { value: item.id, text: `${item.id}${item.active ? '' : '（历史）'}`, selected: item.id === getSelectedModel() })));
    updated.textContent = getModelCatalogUpdatedAt() ? new Date(getModelCatalogUpdatedAt()).toLocaleString() : '';
  };
  renderModels();
  const refresh = button('刷新模型', 'secondary-button', async () => {
    try { setApiKey(key.value); refresh.disabled = true; refresh.textContent = '刷新中…'; await refreshModels(); renderModels(); showToast('已刷新'); }
    catch (error) { displayError(error); }
    finally { refresh.disabled = false; refresh.textContent = '刷新模型'; }
  });
  const exchangeButton = button('数据交换', 'secondary-button', openDataExchangeDialog);
  const manageButton = button('管理词库', 'secondary-button', openLibraryManager);
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('API Key', key), field('模型', model), updated, refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号', numberMode)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [manageButton])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [exchangeButton])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '版本' }), el('p', { className: 'help-text', text: `Vocabulary Index ${APP_VERSION}` })]),
  ];
  openDialog({ title: '设置', body, submitText: '保存', onSubmit: async () => { setApiKey(key.value); if (model.value) selectModel(model.value); await setNumberMode(numberMode.value); showToast('已保存'); } });
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
      preview.replaceChildren(el('div', { className: 'preview-item', text: `${backup.domains.length} · ${backup.collections.length} · ${backup.entries.length.toLocaleString()}` }));
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
      el('p', { className: 'help-text', text: '旧词性仍保留在数据层；界面已隐藏。每个词域已建立短语表。' }),
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
  const activeHandler = dialogSubmitHandler;
  try {
    if (submit) { submit.disabled = true; submit.dataset.oldText = submit.textContent; submit.textContent = '处理中…'; }
    await activeHandler();
    if (dialogSubmitHandler === activeHandler) closeDialog();
    renderApp();
  } catch (error) { displayError(error); }
  finally { if (submit?.isConnected) { submit.disabled = false; submit.textContent = submit.dataset.oldText || '保存'; } }
}

export async function initializeUI() {
  elements['dialog-form'].addEventListener('submit', handleDialogSubmit);
  elements['confirm-form'].addEventListener('submit', handleConfirmSubmit);
  elements['dialog-close'].addEventListener('click', closeDialog);
  elements['action-close'].addEventListener('click', closeActionDialog);
  elements['search-close'].addEventListener('click', closeSearchDialog);
  elements['confirm-cancel'].addEventListener('click', closeConfirmDialog);
  elements['app-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['app-dialog'], closeDialog));
  elements['action-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['action-dialog'], closeActionDialog));
  elements['search-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['search-dialog'], closeSearchDialog));
  elements['confirm-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['confirm-dialog'], closeConfirmDialog));
  elements['app-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
  elements['action-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeActionDialog(); });
  elements['search-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeSearchDialog(); });
  elements['confirm-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeConfirmDialog(); });
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
  window.addEventListener('popstate', renderApp);
  window.visualViewport?.addEventListener('resize', updateVisualViewportVars);
  window.addEventListener('scroll', persistScrollPosition, { passive: true });
  subscribe(({ type }) => {
    if (type === 'mutation' && suppressNextMutationRender) {
      suppressNextMutationRender = false;
      return;
    }
    renderApp();
  });
  await initializeStore();
  elements['boot-screen'].classList.add('hidden');
  elements.app.classList.remove('hidden');
  renderApp();
  setTimeout(showMigrationNotice, 60);
}
