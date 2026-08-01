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
import { normalizeEnglish, systemPhraseCollectionId } from './v3-model.js';

const APP_VERSION = '3.0.1';
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

function updateVisualViewportVars() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  document.documentElement.style.setProperty('--visual-height', `${height}px`);
  document.documentElement.style.setProperty('--visual-top', `${offsetTop}px`);
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
  window.scrollTo(0, lockedScrollY);
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
      el('span', { className: 'arrow', text: '›' }),
    ]),
    label ? el('div', { className: 'label', text: label }) : null,
    el('div', { className: 'count', text: count.toLocaleString() }),
  ]);
}

function searchResultButton(entry, onSelect) {
  const state = getState();
  const collectionId = projectionCollectionForEntry(entry.id);
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
    const collections = state.collections
      .filter((item) => item.domainId === domain.id)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const section = el('section', { className: 'manager-domain', dataset: { sortId: domain.id } });
    const domainHeader = el('div', { className: 'manager-domain-header' }, [
      button('☰', 'drag-handle', () => {}, { title: '拖动词域' }),
      el('strong', { text: domain.name }),
      button('⋯', 'manager-more', () => openDomainMenu(domain.id), { title: '词域操作' }),
    ]);
    const list = el('div', { className: 'manager-list' });
    for (const collection of collections) {
      list.append(el('div', { className: 'manager-row', dataset: { sortId: collection.id } }, [
        button('☰', 'drag-handle', () => {}, { title: '拖动词表' }),
        el('span', { className: 'manager-name', text: collection.name }),
        el('span', { className: 'manager-count', text: getVisibleEntries(collection.id).length.toLocaleString() }),
        collection.type === 'normal'
          ? button('⋯', 'manager-more', () => openCollectionMenu(collection.id), { title: '词表操作' })
          : el('span', { className: 'manager-fixed', text: '' }),
      ]));
    }
    list.append(button('＋', 'manager-add', () => openAddCollectionDialog(domain.id), { title: '新建词表' }));
    section.append(domainHeader, list);
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
  elements['page-subtitle'].textContent = `${state.entries.filter((entry) => entry.kind === 'word').length.toLocaleString()} · 本地保存`;
  elements['settings-button'].textContent = '•••';
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

  const sections = [];
  for (const domain of [...state.domains].sort((a, b) => a.order - b.order)) {
    const collections = state.collections
      .filter((item) => item.domainId === domain.id)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const heading = state.domains.length > 1
      ? el('div', { className: 'domain-heading' }, [el('h3', { text: domain.name })])
      : null;
    const grid = collections.length
      ? el('div', { className: 'collection-grid' }, collections.map(collectionCard))
      : el('div', { className: 'empty-state', text: '暂无内容' });
    sections.push(el('section', { className: 'domain-section' }, [heading, grid]));
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
  elements['settings-button'].textContent = '•••';
  elements['settings-button'].setAttribute('aria-label', '更多');
  renderCollectionToolbar(collection);
  renderPinBar(collection);
  renderEntryList(collection, domain, entries);
  if (pendingJumpEntryId) queueMicrotask(() => jumpToEntry(pendingJumpEntryId, { collectionId: collection.id }));
}

function renderCollectionToolbar(collection) {
  const annotationCount = annotationCountForCollection(collection.id);
  const lastPosition = getLastPosition(collection.domainId, collection.id);
  const quickActions = [];
  if (lastPosition) quickActions.push(button('继续上次位置', 'secondary-button compact-button continue-button', () => jumpToEntry(lastPosition, { collectionId: collection.id }), { title: '继续上次位置' }));
  if (annotationCount) quickActions.push(button(`${annotationCount}`, 'secondary-button compact-button annotation-count-button', () => startAnnotationReview(collection.id), { title: '待核查' }));
  if (quickActions.length) elements['collection-toolbar'].replaceChildren(el('div', { className: 'collection-quick-actions' }, quickActions));
  else elements['collection-toolbar'].replaceChildren();
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

function relationItemsForEntry(entry) {
  if (entry.kind === 'word') {
    return getRelatedPhrases(entry.id)
      .map((phrase) => ({ id: phrase.id, text: phrase.text, entry: phrase }))
      .sort((a, b) => normalizeEnglish(a.text).localeCompare(normalizeEnglish(b.text), 'en'));
  }
  const byToken = new Map();
  for (const component of getPhraseComponents(entry.id)) {
    const key = normalizeEnglish(component.token);
    if (!key || byToken.has(key)) continue;
    byToken.set(key, { id: component.entry?.id || '', text: component.token, entry: component.entry || null });
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

function renderRelationPanel(entry) {
  const items = relationItemsForEntry(entry);
  if (!items.length || !expandedRelations.has(entry.id)) return null;
  return el('div', { className: 'relation-panel' }, items.map((item) =>
    el('button', { type: 'button', className: `relation-item${item.entry ? '' : ' unresolved'}`, on: { click: () => copyText(item.text).catch(displayError) } }, [
      el('span', { text: item.text }),
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

async function toggleEntryPin(entry, collection) {
  const wasPinned = getState().pinByEntry.has(entry.id);
  await togglePin(entry.id, collection.id);
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

function renderEntryRow(entry, collection, _domain, indexes = { groupIndex: 0, globalIndex: 0 }) {
  const state = getState();
  const pinned = state.pinByEntry.has(entry.id);
  const annotation = state.annotationByEntry.get(entry.id);
  const numberMode = state.settings.numberMode || 'global';
  const indexText = numberMode === 'group' ? `${indexes.groupIndex}.` : numberMode === 'global' ? `${indexes.globalIndex}.` : '';
  const relations = relationItemsForEntry(entry);
  const expanded = expandedRelations.has(entry.id);
  const row = el('article', { className: `entry-row${expanded ? ' relations-open' : ''}`, id: `entry-${entry.id}`, dataset: { entryId: entry.id } });
  const line = el('div', { className: 'entry-line' }, [
    el('button', { type: 'button', className: 'copy-entry', on: { click: () => copyEntry(entry, collection) } }, [
      indexText ? el('span', { className: 'entry-index', text: indexText }) : null,
      el('span', { className: 'entry-text', text: entry.text }),
    ]),
    annotation ? button('•', 'entry-annotation', () => startAnnotationReview(collection.id, entry.id), { title: '待核查' }) : null,
    relations.length ? button(expanded ? '⌃' : '⌄', 'entry-relations', () => toggleEntryRelations(entry.id), { title: expanded ? '收起' : '展开' }) : null,
    button('PIN', `entry-pin${pinned ? ' active' : ''}`, () => toggleEntryPin(entry, collection).catch(displayError), { title: pinned ? '取消 PIN' : '设置 PIN' }),
    button('⋯', 'entry-more', () => openEntryActions(entry.id, collection.id), { title: '更多' }),
  ]);
  row.append(line, renderRelationPanel(entry));
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
    await setLastPosition(entry.domainId, collection.id, entry.id);
    lastPersistedEntryId = entry.id;
    if (firstSavedPosition && currentCollectionId === collection.id) {
      renderCollectionToolbar(collection);
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

/** @param {string} entryId @param {{ behavior?: ScrollBehavior, collectionId?: string }} [options] */
function jumpToEntry(entryId, { behavior = 'smooth', collectionId = currentCollectionId } = {}) {
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
          if (firstSavedPosition && currentCollectionId === collection.id) renderCollectionToolbar(collection);
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
  const input = el('input', { type: 'search', placeholder: '搜索', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select');
  scope.append(el('option', { value: 'all', text: '全部' }));
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    scope.append(el('option', { value: `domain:${domain.id}`, text: domain.name }));
    const group = el('optgroup', { label: domain.name });
    const collections = state.collections
      .filter((item) => item.domainId === domain.id)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    for (const collection of collections) group.append(el('option', { value: `collection:${collection.id}`, text: collection.name }));
    scope.append(group);
  }
  scope.value = currentCollectionId ? `collection:${currentCollectionId}` : 'all';

  const aiButton = button('AI 联想', 'secondary-button hidden', async () => {});
  const status = el('p', { className: 'search-status help-text' });
  const results = el('div', { className: 'search-results' });
  let requestSequence = 0;

  const visibleIds = () => {
    const value = scope.value;
    if (value === 'all') return new Set(state.entries.map((entry) => entry.id));
    if (value.startsWith('domain:')) {
      const domainId = value.slice('domain:'.length);
      return new Set(state.entries.filter((entry) => entry.domainId === domainId).map((entry) => entry.id));
    }
    if (value.startsWith('collection:')) {
      return new Set(getVisibleEntries(value.slice('collection:'.length)).map((entry) => entry.id));
    }
    return new Set();
  };
  const selectResult = (entry, collectionId) => {
    closeSearchDialog();
    navigateCollection(collectionId, entry.id);
  };
  const showEntries = (entries, label = '') => {
    status.textContent = label || (entries.length ? entries.length.toLocaleString() : '无结果');
    results.replaceChildren(...entries.map((entry) => searchResultButton(entry, selectResult)));
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
  input.addEventListener('input', renderLocal);
  scope.addEventListener('change', renderLocal);
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
  requestAnimationFrame(() => {
    updateVisualViewportVars();
    try { input.focus({ preventScroll: true }); } catch { input.focus(); }
  });
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
  const exportButton = button('导出完整 JSON', 'secondary-button', () => exportBackupNow().catch(displayError));
  const restoreButton = button('恢复备份', 'secondary-button', openRestoreDialog);
  const manageButton = button('管理词库', 'secondary-button', openLibraryManager);
  const body = [
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('API Key', key), field('模型', model), updated, refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号', numberMode)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [manageButton])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [exportButton, restoreButton])]),
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
  window.visualViewport?.addEventListener('resize', updateVisualViewportVars);
  window.visualViewport?.addEventListener('scroll', updateVisualViewportVars);
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
