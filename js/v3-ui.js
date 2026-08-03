import {
  acknowledgeMigrationNotice, addCollection, addDomain, addEntry, addPhraseForWord,
  clearAllAnnotations, clearAnnotationsForEntries, deleteCollection, deleteDomain, deleteEntry, dismissAnnotation,
  editEntry, editEntryInCollection, exportFullBackup, getLastPosition, getPhraseComponents, getRelatedPhrases, getState,
  getPinsForCollection, getVisibleEntries, getViewMode, getCalendarMonth, getStudyStamp, importEntries, initializeStore, moveCollection, redo,
  removeEntryFromCollection, renameCollection, renameDomain, reorderCollections, reorderDomains, recordAiAnnotationChanges, replaceAnnotations, resetToSeed, restoreBackup,
  refreshStudyDate, search, setCalendarMonth, setDomainGlossEnabled, setLastPosition, setNumberMode, setViewMode, subscribe, togglePin, undo,
} from './v3-store.js';
import {
  AiCheckController, checkEntries, createAiCheckBatches, getApiKey, getModelCatalog, getModelCatalogUpdatedAt,
  getSelectedModel, refreshModels, selectModel, setApiKey, suggestEntries, suggestSearchTerms,
} from './v3-ai.js';
import {
  downloadText, entriesToCsv, readImportFile,
} from './v3-import.js';
import { normalizeEnglish, positionScopeDomainId, systemPhraseCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID } from './v3-model.js';
import { NEW_COLLECTION_TARGET, NEW_DOMAIN_TARGET, createVixPackage } from './v3-exchange.js';
import { buildChatGPTPrompt, buildChatGPTShortcutUrl, buildOxfordLookupUrl, createEntryContext } from './v3-integrations.js';

const APP_VERSION = '3.5.1';
/** @type {Record<string, any>} */
const elements = Object.fromEntries([
  'boot-screen', 'app', 'back-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'main-content', 'large-title', 'large-title-eyebrow', 'large-title-heading', 'large-title-subtitle',
  'home-annotation-banner', 'home-annotation-icon', 'home-annotation-text', 'clear-all-annotations', 'query-menu', 'relation-target-menu',
  'home-view', 'collection-view', 'collection-toolbar', 'pin-bar', 'annotation-review-bar', 'letter-nav', 'entry-list',
  'bottom-toolbar', 'bottom-last-position', 'back-to-top', 'bottom-mode', 'bottom-view-switch', 'bottom-search', 'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',
  'app-dialog', 'dialog-form', 'dialog-title', 'dialog-description', 'dialog-close', 'dialog-body', 'dialog-actions',
  'action-dialog', 'action-title', 'action-description', 'action-close', 'action-body',
  'search-dialog', 'search-close', 'search-body',
  'confirm-dialog', 'confirm-form', 'confirm-title', 'confirm-description', 'confirm-body', 'confirm-cancel', 'confirm-submit',
  'hidden-file-input',
].map((id) => [id, document.getElementById(id)]));

let currentCollectionId = '';
let currentViewKind = 'word';
const expandedLettersByCollection = new Map();
let pendingJumpEntryId = '';
let pendingJumpReason = 'jump';
let persistentJumpEntryId = '';
let pinIndex = 0;
let pinCollectionId = '';
let activeTask = null;
let review = { ids: [], index: 0, collectionId: '', viewKind: '' };
let dialogSubmitHandler = null;
let confirmSubmitHandler = null;
let confirmCancelHandler = null;
let confirmChoiceRequired = false;
let collectionRenderContext = null;
let scrollPersistenceTimer = 0;
let suppressScrollPersistenceUntil = 0;
let taskPanelExpanded = true;
let waitingServiceWorker = null;
let serviceWorkerReloadPending = false;
let activeSection = 'main';
let navigationRevision = 0;
const expandedRelations = new Set();
const dialogStack = [];
let currentDialogMeta = { onRestore: null };
let openModalCount = 0;
let modalScrollY = 0;
let modalTouchY = 0;
let appNavigationDepth = 0;
let pendingPageSnapshot = null;
let pageTransitionTimer = 0;
let renderRevision = 0;
const viewStateSnapshots = new Map();
let homeScrollY = 0;
let restoreHomeScrollPending = false;
let activeQueryMenu = null;
let activeRelationTargetMenu = null;
let scrollUiFrame = 0;
let letterTrackInteractionUntil = 0;
let letterTrackResyncTimer = 0;
let routeRenderFrame = 0;
let entryChunkObserver = null;
const entryChunkData = new WeakMap();
const entryChunkByEntryId = new Map();
const iconTemplateCache = new Map();
const ENTRY_CHUNK_SIZE = 42;
const ENTRY_ROW_ESTIMATE = 56;

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
  back: '<path d="M14.8 5.4 8.2 12l6.6 6.6"></path>',
  search: '<circle cx="10.7" cy="10.7" r="6.2"></circle><path d="m15.4 15.4 4.4 4.4"></path>',
  target: '<circle cx="12" cy="12" r="6.4"></circle><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"></circle><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4"></path>',
  relation: '<path d="M8 7.2h8M8.2 16.8h7.6"></path><circle cx="6" cy="7.2" r="2"></circle><circle cx="18" cy="7.2" r="2"></circle><circle cx="6" cy="16.8" r="2"></circle><circle cx="18" cy="16.8" r="2"></circle>',
  disclosure: '<path d="M8.9 6.35c0-.72.78-1.15 1.39-.77l6.95 4.34c1.25.78 1.25 2.6 0 3.38l-6.95 4.34c-.61.38-1.39-.05-1.39-.77V6.35Z"></path><path d="m11.35 9.25 4.2 2.75-4.2 2.75"></path>',
  jump: '<circle cx="8.2" cy="12" r="3.3"></circle><circle cx="8.2" cy="12" r=".85" fill="currentColor" stroke="none"></circle><path d="M11.7 12h7.1M16 9.25 18.8 12 16 14.75"></path>',
  pin: '<path d="M9.1 3.8h5.8l-.75 4.4 2.8 2.75v1.75h-3.65v6.25L12 21l-1.3-2.05V12.7H7.05v-1.75l2.8-2.75-.75-4.4Z"></path>',
  more: '<circle cx="5.2" cy="12" r="1.35" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"></circle><circle cx="18.8" cy="12" r="1.35" fill="currentColor" stroke="none"></circle>',
  chevron: '<path d="m8.4 9.3 3.6 3.6 3.6-3.6"></path>',
  doubleChevron: '<path d="m6.7 9.3 3.6 3.6 3.6-3.6M11.2 9.3l3.6 3.6 3.6-3.6"></path>',
  enter: '<path d="M18.8 5.2v6.9H7.1"></path><path d="m10.1 9.1-3 3 3 3"></path>',
  refresh: '<rect x="4.2" y="5.4" width="15.6" height="14.4" rx="2.5"></rect><path d="M8 3.5v3.9M16 3.5v3.9M4.2 9.7h15.6"></path><path d="M15.8 13.1a3.55 3.55 0 1 1-1.05-1.2"></path><path d="M15.8 11.15v2.35h-2.35"></path>',
  calendar: '<rect x="3.8" y="5.4" width="16.4" height="15" rx="2.4"></rect><path d="M8 3.4v4M16 3.4v4M3.8 9.9h16.4"></path>',
  alphabet: '<path d="M4.8 19 9.6 5l4.8 14M6.7 14h5.8"></path><path d="M16.6 8.1h3.2l-3.2 4.1h3.2"></path>',
  phrase: '<path d="M4.5 6.5h15M4.5 12h11.2M4.5 17.5h15"></path>',
  word: '<path d="M5.2 5.1h13.6M12 5.1v13.8M8.2 18.9h7.6"></path>',
  unmarked: '<circle cx="12" cy="12" r="8.1"></circle><path d="M9.5 9.5a2.75 2.75 0 1 1 4.15 2.35c-1.05.62-1.65 1.16-1.65 2.25M12 17.3h.01"></path>',
  top: '<path d="M5.2 5h13.6"></path><path d="m7.1 12.2 4.9-4.9 4.9 4.9"></path><path d="M12 7.7v11.2"></path>',
  intra: '<rect x="4.2" y="5.2" width="15.6" height="13.6" rx="2.4"></rect><path d="M7.4 12h8.5M13.1 9.2 15.9 12l-2.8 2.8"></path>',
  external: '<rect x="3.3" y="5.2" width="6.6" height="13.6" rx="1.8"></rect><rect x="14.1" y="5.2" width="6.6" height="13.6" rx="1.8"></rect><path d="M9.6 12h6.1M13.2 9.4l2.6 2.6-2.6 2.6"></path>',
  multi: '<circle cx="5.2" cy="12" r="2.2"></circle><path d="M7.5 12h3.2c2.2 0 2.2-5 4.5-5h3.5M15.9 4.4 18.7 7l-2.8 2.6M10.7 12c2.2 0 2.2 5 4.5 5h3.5M15.9 14.4l2.8 2.6-2.8 2.6"></path>',
  globalDown: '<path d="M5 5h14M7.2 8.6h9.6"></path><path d="M12 9v7.1M9.3 13.5 12 16.2l2.7-2.7"></path><rect x="6.2" y="18" width="11.6" height="2.6" rx="1.3"></rect>',
  dictionary: '<path d="M5.2 4.8h5.1c1.05 0 1.7.35 1.7 1.25v13.1c0-.9-.65-1.25-1.7-1.25H5.2V4.8Z"></path><path d="M18.8 4.8h-5.1c-1.05 0-1.7.35-1.7 1.25v13.1c0-.9.65-1.25 1.7-1.25h5.1V4.8Z"></path><path d="M7.4 8h2.2M14.4 8h2.2M7.4 11h2.2M14.4 11h2.2"></path>',
  aiChat: '<path d="M5.1 5.2h13.8a1.9 1.9 0 0 1 1.9 1.9v8a1.9 1.9 0 0 1-1.9 1.9h-7.2l-4.4 3.1V17H5.1a1.9 1.9 0 0 1-1.9-1.9v-8a1.9 1.9 0 0 1 1.9-1.9Z"></path><path d="M8 10.9h.01M12 10.9h.01M16 10.9h.01"></path>',
  query: '<circle cx="9.3" cy="10.3" r="5.15"></circle><path d="m13.2 14.15 3.9 3.9"></path><path d="M17.3 4.65v4.3M15.15 6.8h4.3"></path>',
  warning: '<path d="M10.5 4.2 3.6 17.1A2 2 0 0 0 5.35 20h13.3a2 2 0 0 0 1.75-2.9L13.5 4.2a1.7 1.7 0 0 0-3 0Z"></path><path d="M12 8.4v5.1M12 16.7h.01"></path>',
  clear: '<path d="M5.2 6.6h13.6M9.1 6.6V4.4h5.8v2.2M7.2 6.6l.8 13h8l.8-13"></path><path d="M10.1 10.1v5.8M13.9 10.1v5.8"></path>',
  close: '<path d="m7.35 7.35 9.3 9.3M16.65 7.35l-9.3 9.3"></path>',
  grip: '<circle cx="8" cy="7" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="16" cy="7" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="8" cy="12" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="16" cy="12" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="8" cy="17" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="16" cy="17" r="1.15" fill="currentColor" stroke="none"></circle>',
  add: '<path d="M12 5v14M5 12h14"></path>',
};

function svgIcon(name, className = '') {
  let template = iconTemplateCache.get(name);
  if (!template) {
    template = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    template.setAttribute('viewBox', '0 0 24 24');
    template.setAttribute('aria-hidden', 'true');
    template.setAttribute('focusable', 'false');
    template.setAttribute('fill', 'none');
    template.setAttribute('stroke', 'currentColor');
    template.setAttribute('stroke-width', '1.75');
    template.setAttribute('stroke-linecap', 'round');
    template.setAttribute('stroke-linejoin', 'round');
    template.innerHTML = ICONS[name] || '';
    iconTemplateCache.set(name, template);
  }
  const svg = /** @type {SVGElement} */ (template.cloneNode(true));
  svg.setAttribute('class', `ui-icon${className ? ` ${className}` : ''}`);
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
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    const left = viewport?.offsetLeft || 0;
    const bottom = Math.max(0, window.innerHeight - top - height);
    document.documentElement.style.setProperty('--visual-height', `${Math.round(height)}px`);
    document.documentElement.style.setProperty('--visual-top', `${Math.round(top)}px`);
    document.documentElement.style.setProperty('--visual-left', `${Math.round(left)}px`);
    document.documentElement.style.setProperty('--visual-bottom', `${Math.round(bottom)}px`);
    const keyboardVisible = height < window.innerHeight - 120;
    document.documentElement.classList.toggle('keyboard-visible', keyboardVisible);
    elements['search-dialog']?.classList.toggle('keyboard-visible', keyboardVisible);
    if (activeQueryMenu) positionQueryMenu();
    updateOverlayLayout();
  });
}

function updateOverlayLayout() {
  requestAnimationFrame(() => {
    const updateVisible = elements['update-banner'] && !elements['update-banner'].classList.contains('hidden');
    const updateHeight = updateVisible ? Math.ceil(elements['update-banner'].getBoundingClientRect().height + 8) : 0;
    document.documentElement.style.setProperty('--update-overlay-offset', `${updateHeight}px`);
    requestAnimationFrame(() => {
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const topSurfaces = [...document.querySelectorAll('.topbar, .update-banner, .home-annotation-banner, .context-bar, .letter-nav')]
        .filter((node) => !node.classList.contains('hidden'))
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.height > 0 && rect.bottom > viewportTop && rect.top < viewportTop + 280)
        .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
      let bottom = viewportTop;
      for (const rect of topSurfaces) if (rect.top <= bottom + 14) bottom = Math.max(bottom, rect.bottom);
      bottom = Math.max(bottom, viewportTop + 72);
      document.documentElement.style.setProperty('--toast-top', `${Math.ceil(bottom + 8)}px`);
      document.documentElement.style.setProperty('--content-sticky-top', `${Math.ceil(bottom + 2)}px`);
    });
  });
}

function lockPageForModal() {
  openModalCount += 1;
  if (openModalCount !== 1) return;
  modalScrollY = window.scrollY;
  const body = document.body;
  body.style.position = 'fixed';
  body.style.top = `-${modalScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  document.documentElement.classList.add('modal-open');
  body.classList.add('modal-open');
  updateVisualViewportVars();
}

function unlockPageForModal() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount) return;
  const body = document.body;
  document.documentElement.classList.remove('modal-open');
  body.classList.remove('modal-open');
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  window.scrollTo({ top: modalScrollY, behavior: 'auto' });
}

function modalScrollableTarget(target) {
  const node = target instanceof Element ? target.closest('.dialog-body, .dialog-card, #dialog-form, #confirm-form') : null;
  if (!node) return null;
  return node.scrollHeight > node.clientHeight + 1 ? node : null;
}

function handleModalTouchStart(event) {
  if (!openModalCount || !event.touches?.length) return;
  modalTouchY = event.touches[0].clientY;
}

function handleModalTouchMove(event) {
  if (!openModalCount || !event.touches?.length) return;
  const scroller = modalScrollableTarget(event.target);
  if (!scroller) { event.preventDefault(); return; }
  const nextY = event.touches[0].clientY;
  const delta = nextY - modalTouchY;
  modalTouchY = nextY;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
  if ((atTop && delta > 0) || (atBottom && delta < 0)) event.preventDefault();
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
    queueMicrotask(() => elements['dialog-close']?.focus({ preventScroll: true }));
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
  queueMicrotask(() => elements['dialog-close']?.focus({ preventScroll: true }));
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
  queueMicrotask(() => elements['action-close']?.focus({ preventScroll: true }));
}

function closeSearchDialog() {
  if (elements['search-dialog'].open) {
    elements['search-dialog'].close();
    unlockPageForModal();
  }
}

function closeConfirmDialog({ force = false } = {}) {
  if (confirmChoiceRequired && !force) return false;
  if (elements['confirm-dialog'].open) {
    elements['confirm-dialog'].close();
    unlockPageForModal();
  }
  confirmSubmitHandler = null;
  confirmCancelHandler = null;
  confirmChoiceRequired = false;
  return true;
}

function openConfirmDialog({ title, description = '', body = [], submitText = '确认', cancelText = '取消', onSubmit, onCancel = null, choiceRequired = false, destructive = true }) {
  elements['confirm-title'].textContent = title;
  elements['confirm-description'].textContent = description;
  elements['confirm-description'].classList.toggle('hidden', !description);
  elements['confirm-body'].replaceChildren(...(Array.isArray(body) ? body : [body]));
  elements['confirm-submit'].textContent = submitText;
  elements['confirm-submit'].className = destructive ? 'danger-button' : 'primary-button';
  elements['confirm-cancel'].textContent = cancelText;
  confirmSubmitHandler = onSubmit;
  confirmCancelHandler = onCancel;
  confirmChoiceRequired = Boolean(choiceRequired);
  if (!elements['confirm-dialog'].open) {
    lockPageForModal();
    elements['confirm-dialog'].showModal();
  }
}

function handleConfirmCancel() {
  const handler = confirmCancelHandler;
  closeConfirmDialog({ force: true });
  if (handler) Promise.resolve().then(handler).catch(displayError);
}

function collectionRoute(collectionId, entryId = '', viewKind = '') {
  const query = new URLSearchParams();
  query.set('collection', collectionId);
  if (viewKind) query.set('view', viewKind);
  if (entryId) query.set('entry', entryId);
  return `#${query}`;
}

function parseRoute() {
  const query = new URLSearchParams(location.hash.replace(/^#/, ''));
  return {
    collectionId: query.get('collection') || '',
    entryId: query.get('entry') || '',
    viewKind: ['word', 'phrase'].includes(query.get('view')) ? query.get('view') : '',
  };
}

function viewKindForCollection(collection, entry = null, requested = '') {
  if (!collection) return 'word';
  if (collection.type === 'normal') {
    if (['word', 'phrase'].includes(requested)) return requested;
    if (entry?.kind === 'phrase') return 'phrase';
    if (entry?.kind === 'word') return 'word';
    return 'word';
  }
  return isPhraseCollection(collection) ? 'phrase' : 'word';
}

function currentSnapshot() {
  if (!currentCollectionId) return { type: 'home', scrollY: window.scrollY };
  const collection = getState().collectionById.get(currentCollectionId);
  if (!collection) return null;
  const section = currentViewKind;
  return {
    type: 'collection', collectionId: currentCollectionId, viewKind: section,
    scrollY: window.scrollY,
    expandedLetters: [...expandedLettersFor(currentCollectionId, section)],
    expandedRelations: [...expandedRelations].filter((key) => key.startsWith(`${currentCollectionId}\u0000${section}\u0000`)),
    activeSection,
  };
}

function persistCurrentHistorySnapshot() {
  const snapshot = currentSnapshot();
  const state = { ...(history.state || {}), vix: true, depth: appNavigationDepth, pageSnapshot: snapshot };
  history.replaceState(state, '', location.href);
  if (snapshot?.type === 'collection') viewStateSnapshots.set(`${snapshot.collectionId}:${snapshot.viewKind}`, snapshot);
}

function applySnapshotBeforeRender(snapshot, collection, viewKind) {
  if (!snapshot || snapshot.type !== 'collection' || snapshot.collectionId !== collection.id || snapshot.viewKind !== viewKind) return;
  const expanded = expandedLettersFor(collection.id, viewKind);
  expanded.clear();
  for (const letter of snapshot.expandedLetters || []) expanded.add(letter);
  for (const key of [...expandedRelations]) if (key.startsWith(`${collection.id}\u0000${viewKind}\u0000`)) expandedRelations.delete(key);
  for (const key of snapshot.expandedRelations || []) expandedRelations.add(key);
  activeSection = snapshot.activeSection || viewKind;
}

function restoreSnapshotAfterRender(snapshot, token = renderRevision) {
  if (!snapshot) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (token !== renderRevision) return;
    window.scrollTo({ top: Math.max(0, Number(snapshot.scrollY || 0)), behavior: 'auto' });
    syncActiveAlphabetHeading();
    updateBackToTopVisibility();
  }));
}

function clearExpandedRelationsForView(collectionId, viewKind) {
  const prefix = `${collectionId}\u0000${viewKind}\u0000`;
  for (const key of [...expandedRelations]) if (key.startsWith(prefix)) expandedRelations.delete(key);
}

function prepareTargetExpansion(collection, entry, viewKind, reason) {
  const expanded = expandedLettersFor(collection.id, viewKind);
  if (reason === 'home') {
    expanded.clear();
    clearExpandedRelationsForView(collection.id, viewKind);
    return;
  }
  if (entry && ['search', 'relation', 'route', 'annotation', 'mode'].includes(reason)) {
    expanded.clear();
    clearExpandedRelationsForView(collection.id, viewKind);
    expanded.add(letterForEntry(entry));
  }
}

function performPageTransition(callback, enabled = true) {
  clearTimeout(pageTransitionTimer);
  if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { callback(); return; }
  elements['collection-view']?.classList.add('page-transition-out');
  pageTransitionTimer = window.setTimeout(() => {
    callback();
    requestAnimationFrame(() => {
      elements['collection-view']?.classList.remove('page-transition-out');
      elements['collection-view']?.classList.add('page-transition-in');
      requestAnimationFrame(() => elements['collection-view']?.classList.remove('page-transition-in'));
    });
  }, 70);
}

function navigateCollection(collectionId, entryId = '', reason = 'jump', requestedView = '') {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entry = entryId ? state.entryById.get(entryId) : null;
  if (!collection) return;
  const nextView = viewKindForCollection(collection, entry, requestedView);
  const pageChanged = currentCollectionId !== collectionId || currentViewKind !== nextView;
  persistCurrentHistorySnapshot();
  if (!currentCollectionId) homeScrollY = window.scrollY;
  closeQueryMenu();
  closeRelationTargetMenu();
  prepareTargetExpansion(collection, entry, nextView, reason);
  const depth = appNavigationDepth + 1;
  const hash = collectionRoute(collectionId, entryId, collection.type === 'normal' ? nextView : '');
  history.pushState({ vix: true, depth }, '', hash);
  appNavigationDepth = depth;
  currentCollectionId = collectionId;
  currentViewKind = nextView;
  pendingJumpEntryId = entryId;
  pendingJumpReason = reason;
  pendingPageSnapshot = null;
  performPageTransition(renderApp, pageChanged);
}

function navigateBack() {
  persistCurrentHistorySnapshot();
  if (appNavigationDepth > 0) history.back();
  else goHome();
}

function goHome() {
  closeReview();
  closeQueryMenu();
  closeRelationTargetMenu();
  restoreHomeScrollPending = Boolean(currentCollectionId);
  pendingJumpEntryId = '';
  pendingPageSnapshot = null;
  currentCollectionId = '';
  currentViewKind = 'word';
  appNavigationDepth = 0;
  history.replaceState({ vix: true, depth: 0, pageSnapshot: { type: 'home', scrollY: homeScrollY } }, '', location.pathname + location.search);
  renderApp();
}

function handleHistoryNavigation(event) {
  appNavigationDepth = Number(event.state?.depth || 0);
  pendingPageSnapshot = event.state?.pageSnapshot || null;
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
  return positionScopeDomainId(collection, entry);
}

function isGlobalCollection(collectionOrId) {
  const id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id;
  return [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(id);
}

function relationExpansionKey(collectionId, entryId, viewKind = currentViewKind) {
  return `${collectionId}\u0000${viewKind}\u0000${entryId}`;
}

function annotationRecordForEntry(entry, collection) {
  const state = getState();
  if (!entry) return null;
  const annotation = state.annotationByEntry.get(entry.id);
  return annotation ? { annotation, sourceEntryId: entry.id } : null;
}

function reviewDisplayEntryId(entryId, collectionId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return '';
  return getState().visibleEntryIdsByCollection.get(collectionId)?.has(entryId) ? entryId : '';
}

function entriesForCollectionView(collectionId, viewKind = '') {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = state.projection.get(collectionId) || [];
  if (collection?.type !== 'normal') return entries;
  const kind = ['word', 'phrase'].includes(viewKind) ? viewKind : currentViewKind;
  return entries.filter((entry) => entry.kind === kind);
}

function entryIdsForCollectionView(collectionId, viewKind = '') {
  return entriesForCollectionView(collectionId, viewKind).map((entry) => entry.id);
}

function annotationCountForCollection(collectionId, viewKind = '') {
  const state = getState();
  const visible = new Set(entryIdsForCollectionView(collectionId, viewKind));
  return state.annotations.filter((item) => visible.has(item.entryId)).length;
}


function expandedLettersFor(collectionId, section = 'main') {
  const key = `${collectionId}:${section}`;
  let set = expandedLettersByCollection.get(key);
  if (!set) {
    set = new Set();
    expandedLettersByCollection.set(key, set);
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

function collectionCountSummary(collectionId) {
  const state = getState();
  if (isGlobalCollection(collectionId)) {
    const count = state.projectionUniqueCounts.get(collectionId) || 0;
    return collectionId === SYSTEM_GLOBAL_WORDS_ID ? `${count.toLocaleString()} 词` : `${count.toLocaleString()} 短语`;
  }
  let words = 0;
  let phrases = 0;
  for (const entry of getVisibleEntries(collectionId)) {
    if (entry.kind === 'phrase') phrases += 1;
    else words += 1;
  }
  return `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`;
}

function collectionCard(collection) {
  const state = getState();
  const entries = getVisibleEntries(collection.id);
  const label = displayCollectionLabel(collection);
  let words = 0;
  let phrases = 0;
  for (const entry of entries) {
    if (entry.kind === 'phrase') phrases += 1;
    else words += 1;
  }
  const count = collection.type === 'normal'
    ? `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`
    : (isGlobalCollection(collection.id) ? (state.projectionUniqueCounts.get(collection.id) || 0) : entries.length).toLocaleString();
  const globalSystem = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collection.id);
  const domainSystem = !globalSystem && (
    collection.id === systemDomainWordsCollectionId(collection.domainId)
    || collection.id === systemPhraseCollectionId(collection.domainId)
    || collection.type === 'system-phrases'
  );
  const classes = [
    'collection-card',
    collection.type === 'normal' ? 'composite-card' : '',
    globalSystem || domainSystem ? 'system-card' : '',
    globalSystem ? 'global-system-card' : '',
    domainSystem ? 'domain-system-card' : '',
  ].filter(Boolean).join(' ');
  return el('button', {
    type: 'button',
    className: classes,
    on: { click: () => navigateCollection(collection.id, '', 'home') },
  }, [
    el('div', { className: 'collection-card-title' }, [
      el('h3', { text: collection.name }),
      el('span', { className: 'arrow' }, [svgIcon('enter')]),
    ]),
    label ? el('div', { className: 'label', text: label }) : null,
    el('div', { className: 'count', text: count }),
  ]);
}

function searchResultButton(entry, onSelect, collectionId = projectionCollectionForEntry(entry.id)) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const conflict = isGlobalCollection(collectionId) && state.globalConflictKeys.has(`${entry.kind}\u0000${entry.normalizedText}`);
  const contextLabel = conflict
    ? [state.domainById.get(entry.domainId)?.name, collection?.name].filter(Boolean).join(' · ')
    : collection?.name;
  return el('button', { type: 'button', className: 'search-result', on: { click: () => onSelect(entry, collectionId) } }, [
    el('strong', { text: entry.text }),
    contextLabel ? el('span', { text: contextLabel }) : null,
  ]);
}

function makeSortableList(container, onCommit) {
  let dragged = null;
  let pointerId = null;
  let originalIds = [];
  const finish = async (commit = true) => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    pointerId = null;
    if (!commit) {
      const rowById = new Map([...container.querySelectorAll(':scope > [data-sort-id]')].map((item) => [item.dataset.sortId, item]));
      for (const id of originalIds) if (rowById.has(id)) container.append(rowById.get(id));
      originalIds = [];
      return;
    }
    const ids = [...container.querySelectorAll(':scope > [data-sort-id]')].map((item) => item.dataset.sortId);
    originalIds = [];
    try { await onCommit(ids); }
    catch (error) { displayError(error); }
  };
  container.querySelectorAll('.drag-handle').forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      const row = handle.closest('[data-sort-id]');
      if (!row) return;
      event.preventDefault();
      pointerId = event.pointerId;
      originalIds = [...container.querySelectorAll(':scope > [data-sort-id]')].map((item) => item.dataset.sortId);
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
    handle.addEventListener('pointerup', () => finish(true));
    handle.addEventListener('pointercancel', () => finish(false));
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
      iconButton('grip', 'drag-handle', '拖动词域', () => {}),
      el('strong', { text: domain.name }),
      iconButton('more', 'manager-more', '词域操作', () => openDomainMenu(domain.id)),
    ]);
    const fixed = el('div', { className: 'manager-fixed-list' }, [
      el('div', { className: 'manager-row fixed' }, [
        el('span', { className: 'manager-lock', text: '1' }),
        el('span', { className: 'manager-name', text: '词汇总表' }),
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
        iconButton('grip', 'drag-handle', '拖动词表', () => {}),
        el('span', { className: 'manager-name', text: collection.name }),
        el('span', { className: 'manager-count', text: collectionCountSummary(collection.id) }),
        iconButton('more', 'manager-more', '词表操作', () => openCollectionMenu(collection.id)),
      ]));
    }
    list.append(iconButton('add', 'manager-add', '新建词表', () => openAddCollectionDialog(domain.id)));
    section.append(domainHeader, fixed, list);
    domainList.append(section);
    makeSortableList(list, (ids) => reorderCollections(domain.id, ids));
  }
  makeSortableList(domainList, reorderDomains);
  root.append(domainList, el('button', { type: 'button', className: 'secondary-button manager-add-domain', on: { click: openAddDomainDialog } }, [svgIcon('add'), el('span', { text: '新建词域' })]));
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

async function downloadRecoveryBackup(prefix = 'recovery') {
  const backup = await exportFullBackup();
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  downloadText(`vocabulary-index-${prefix}-${APP_VERSION}-${stamp}.json`, `${JSON.stringify(backup, null, 2)}\n`);
  showToast('完整备份下载已发起');
}

function offerOptionalBackup(onContinue, { title = '是否下载完整备份？', description = '本次操作会修改或覆盖数据。是否先下载当前完整备份？' } = {}) {
  const advance = async () => {
    await cancelActiveTaskForDataChange();
    requestAnimationFrame(() => onContinue());
  };
  openConfirmDialog({
    title,
    description,
    body: el('p', { className: 'help-text', text: '此选择只决定是否下载备份；无论选择哪一项，操作都会继续。' }),
    submitText: '下载备份',
    cancelText: '不下载',
    onSubmit: async () => {
      try { await downloadRecoveryBackup('recovery-before-change'); }
      catch (error) { displayError(error); }
      finally { await advance(); }
    },
    onCancel: async () => { await advance(); },
    choiceRequired: true,
    destructive: false,
  });
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
  const baseRevision = getState().revision;
  const [content, currentBackup] = await Promise.all([file.text(), exportFullBackup()]);
  const id = ++dataExchangeRequestId;
  const plan = await new Promise((resolve, reject) => {
    dataExchangeRequests.set(id, { resolve, reject });
    getDataExchangeWorker().postMessage({ id, content, currentBackup, selection, conflictPolicy });
  });
  return { ...plan, baseRevision };
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
    ['跳过脏归属', summary.skippedMemberships],
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
  if (initialPlan.membershipIssues?.length) {
    const issueLabel = (item) => {
      if (item.type === 'ambiguous-bare-entry-key') return '歧义裸键';
      if (item.type === 'ambiguous-entry-text' || item.type === 'ambiguous-entry-reference') return '歧义词条引用';
      if (item.type === 'unresolved-collection-reference') return '无效词表引用';
      return '无法解析词条';
    };
    body.push(el('div', { className: 'warning-box compact-warning', text: '文件包含无法安全绑定的脏归属数据。系统不会猜测；这些归属将被跳过，其他合法内容继续导入。' }));
    body.push(el('div', { className: 'conflict-list' }, initialPlan.membershipIssues.slice(0, 20).map((item) => {
      const candidates = (item.candidates || []).map((candidate) => `${candidate.domainId} · ${candidate.text}`).join('；');
      return el('div', { className: 'conflict-item' }, [
        el('strong', { text: `${issueLabel(item)}：${item.reference || '(空)'}` }),
        el('span', { text: `${item.collectionKey ? `目标 ${item.collectionKey}` : '未声明目标'}${candidates ? `；候选 ${candidates}` : ''}` }),
      ]);
    })));
    if (initialPlan.membershipIssues.length > 20) body.push(el('p', { className: 'help-text', text: `另有 ${initialPlan.membershipIssues.length - 20} 项脏归属未展开。` }));
  }
  openDialog({
    title: '导入预检',
    description: selection.mode === 'replace'
      ? '确认后先选择是否下载当前完整备份，再以单次事务替换所选范围。'
      : '确认后以单次事务合并所选内容。',
    body,
    submitText: selection.mode === 'replace' && selection.scope === 'global' ? '继续替换全局内容' : '继续导入',
    destructive: selection.mode === 'replace',
    onSubmit: async () => {
      const finalSelection = { ...selection, targetMode: initialPlan.mismatch ? targetMode.value : 'current' };
      const finalPlan = await planDataExchangeFile(file, finalSelection, initialPlan.conflicts?.length ? conflictPolicy.value : 'current');
      closeDialog({ all: true });
      if (selection.mode === 'replace') {
        requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
          title: '确认完整替换',
          description: '确认后将替换所选范围。',
          submitText: '确认替换',
          onSubmit: async () => {
            if (getState().revision !== finalPlan.baseRevision) {
              const refreshedPlan = await planDataExchangeFile(file, finalSelection, initialPlan.conflicts?.length ? conflictPolicy.value : 'current');
              requestAnimationFrame(() => openDataExchangePreview(file, finalSelection, refreshedPlan));
              showToast('数据已变化，已重新生成导入预检');
              return;
            }
            await cancelActiveTaskForDataChange();
            await restoreBackup(finalPlan.nextBackup);
            goHome();
            showToast('内容 JSON 已替换');
          },
        })));
        return;
      }
      if (getState().revision !== finalPlan.baseRevision) {
        const refreshedPlan = await planDataExchangeFile(file, finalSelection, initialPlan.conflicts?.length ? conflictPolicy.value : 'current');
        requestAnimationFrame(() => openDataExchangePreview(file, finalSelection, refreshedPlan));
        showToast('数据已变化，已重新生成导入预检');
        return;
      }
      await cancelActiveTaskForDataChange();
      await restoreBackup(finalPlan.nextBackup);
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
    el('option', { value: 'reset-seed', text: '还原到 Seed' }),
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
    else if (operation.value === 'reset-seed') status.textContent = '还原随当前版本发布的初始词域、词表和内容，并重置 PIN、位置、标注与显示设置；执行前可选择是否下载完整备份。';
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
      if (operation.value === 'reset-seed') {
        closeDialog({ all: true });
        requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
          title: '还原到当前版本 Seed',
          description: '确认后将替换全部本地内容和个人状态。',
          submitText: '确认还原',
          onSubmit: async () => {
            await resetToSeed();
            goHome();
            showToast('已还原到当前版本 Seed');
          },
        }), { title: '还原前是否下载备份？' }));
        return;
      }
      if (operation.value === 'restore-backup') {
        const parsed = await readImportFile(file.files?.[0]);
        if (parsed.kind !== 'backup') throw new Error('该文件不是完整备份');
        closeDialog({ all: true });
        requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
          title: '确认恢复完整备份',
          description: '确认后将整体替换本机应用状态。',
          submitText: '确认恢复',
          onSubmit: async () => {
            await restoreBackup(parsed.backup);
            goHome();
            showToast('完整备份已恢复');
          },
        }), { title: '恢复前是否下载当前备份？' }));
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
  try { await cancelActiveTaskForDataChange(); if (!(await undo())) showToast('没有可撤销操作'); }
  catch (error) { displayError(error); }
}

async function performRedo() {
  try { await cancelActiveTaskForDataChange(); if (!(await redo())) showToast('没有可重做操作'); }
  catch (error) { displayError(error); }
}

function renderLargeTitle({ eyebrow = '', title = '', subtitle = '' } = {}) {
  elements['large-title-eyebrow'].textContent = eyebrow;
  elements['large-title-eyebrow'].classList.toggle('hidden', !eyebrow);
  elements['large-title-heading'].textContent = title;
  elements['large-title-subtitle'].textContent = subtitle;
  elements['large-title-subtitle'].classList.toggle('hidden', !subtitle);
}

async function clearAllAnnotationsFromHome() {
  await cancelActiveTaskForDataChange();
  await clearAllAnnotations();
  showToast('全部标注已撤销');
}

function renderHomeAnnotationBanner() {
  const total = getState().annotations.length;
  if (!total || currentCollectionId) {
    elements['home-annotation-banner'].classList.add('hidden');
    updateOverlayLayout();
    return;
  }
  elements['home-annotation-icon'].replaceChildren(svgIcon('warning'));
  elements['home-annotation-text'].textContent = `${total.toLocaleString()} 条待处理标注`;
  elements['clear-all-annotations'].replaceChildren(svgIcon('clear'), el('span', { text: '全部撤销' }));
  elements['home-annotation-banner'].classList.remove('hidden');
  updateOverlayLayout();
}

function renderHome(token = renderRevision) {
  const state = getState();
  currentCollectionId = '';
  elements.app.classList.remove('is-collection', 'has-pin', 'has-review');
  elements['collection-view'].classList.remove('system-collection-view', 'global-system-view', 'domain-system-view');
  elements['collection-view'].classList.remove('has-letter-nav');
  elements['home-view'].classList.remove('hidden');
  elements['collection-view'].classList.add('hidden');
  elements['back-button'].classList.add('hidden');
  elements['search-button'].classList.remove('hidden');
  elements['bottom-toolbar'].classList.add('hidden');
  elements['pin-bar'].classList.add('hidden');
  elements['back-to-top']?.classList.add('hidden');
  elements['page-title'].textContent = '词汇索引';
  elements['page-subtitle'].textContent = 'Vocabulary Index';
  renderLargeTitle({ eyebrow: 'VOCABULARY INDEX', title: '词汇索引', subtitle: `${(state.projectionUniqueCounts.get(SYSTEM_GLOBAL_WORDS_ID) || 0).toLocaleString()} 个全局词汇` });
  elements['settings-button'].replaceChildren(svgIcon('more'));
  elements['settings-button'].setAttribute('aria-label', '设置');

  const homeActions = [button('管理', 'secondary-button compact-button', openLibraryManager)];

  const sections = [el('section', { className: 'index-scope global-scope' }, [
    el('header', { className: 'scope-heading' }, [
      el('h3', { text: '全局' }),
      el('div', { className: 'scope-actions' }, homeActions),
    ]),
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
  elements['home-view'].replaceChildren(...sections);
  renderHomeAnnotationBanner();
  if (restoreHomeScrollPending) {
    restoreHomeScrollPending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (token === renderRevision) window.scrollTo({ top: homeScrollY, behavior: 'auto' }); }));
  }
}

function renderCollection(token = renderRevision) {
  const state = getState();
  const collection = state.collectionById.get(currentCollectionId);
  if (!collection) { goHome(); return; }
  const domain = state.domainById.get(collection.domainId);
  const allEntries = getVisibleEntries(collection.id);
  const route = parseRoute();
  const routedEntry = route.entryId ? state.entryById.get(route.entryId) : null;
  const snapshotView = pendingPageSnapshot?.collectionId === collection.id ? pendingPageSnapshot.viewKind : '';
  currentViewKind = viewKindForCollection(collection, routedEntry, route.viewKind || snapshotView || currentViewKind);
  activeSection = currentViewKind;
  applySnapshotBeforeRender(pendingPageSnapshot, collection, currentViewKind);
  if (pendingJumpEntryId) prepareTargetExpansion(collection, state.entryById.get(pendingJumpEntryId), currentViewKind, pendingJumpReason);
  const entries = collection.type === 'normal'
    ? allEntries.filter((entry) => entry.kind === currentViewKind)
    : allEntries;
  const globalSystemView = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID].includes(collection.id);
  const domainSystemView = !globalSystemView && (
    collection.id === systemDomainWordsCollectionId(collection.domainId)
    || collection.id === systemPhraseCollectionId(collection.domainId)
    || collection.type === 'system-phrases'
  );
  elements['collection-view'].classList.toggle('system-collection-view', globalSystemView || domainSystemView);
  elements['collection-view'].classList.toggle('global-system-view', globalSystemView);
  elements['collection-view'].classList.toggle('domain-system-view', domainSystemView);
  elements['collection-view'].dataset.viewKind = currentViewKind;
  elements.app.classList.add('is-collection');
  elements['home-view'].classList.add('hidden');
  elements['collection-view'].classList.remove('hidden');
  elements['back-button'].classList.remove('hidden');
  elements['home-annotation-banner'].classList.add('hidden');
  elements['search-button'].classList.add('hidden');
  elements['bottom-toolbar'].classList.remove('hidden');
  elements['page-title'].textContent = collection.name;
  let words = 0;
  let phrases = 0;
  for (const entry of allEntries) {
    if (entry.kind === 'phrase') phrases += 1;
    else words += 1;
  }
  const countText = collection.type === 'normal'
    ? `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`
    : (globalSystemView ? (state.projectionUniqueCounts.get(collection.id) || 0) : allEntries.length).toLocaleString();
  const viewLabel = collection.type === 'normal' ? (currentViewKind === 'phrase' ? '短语视图' : '词汇视图') : '';
  const collectionSubtitle = [countText, viewLabel, displayCollectionLabel(collection)].filter(Boolean).join(' · ');
  elements['page-subtitle'].textContent = collectionSubtitle;
  renderLargeTitle({ eyebrow: domain?.name || (globalSystemView ? '全局索引' : ''), title: collection.name, subtitle: collectionSubtitle });
  elements['settings-button'].replaceChildren(svgIcon('more'));
  elements['settings-button'].setAttribute('aria-label', '更多');
  renderCollectionToolbar(collection);
  renderEntryList(collection, domain, entries, currentViewKind);
  renderPinBar(collection);
  renderBottomToolbar(collection, currentViewKind);
  const jumpEntryId = pendingJumpEntryId;
  const jumpReason = pendingJumpReason;
  const restoreSnapshot = pendingPageSnapshot;
  if (jumpEntryId) queueMicrotask(() => {
    if (token === renderRevision) jumpToEntry(jumpEntryId, { collectionId: collection.id, reason: jumpReason });
  });
  else if (restoreSnapshot) restoreSnapshotAfterRender(restoreSnapshot, token);
  else if (jumpReason === 'home') requestAnimationFrame(() => {
    if (token === renderRevision) window.scrollTo({ top: 0, behavior: 'auto' });
  });
  pendingPageSnapshot = null;
  if (!jumpEntryId) pendingJumpReason = 'jump';
}

function renderCollectionToolbar(collection) {
  const annotationCount = annotationCountForCollection(collection.id, currentViewKind);
  if (annotationCount) {
    const reviewButton = el('button', {
      type: 'button', className: 'secondary-button compact-button annotation-count-button',
      title: '进入当前词表标注审阅', 'aria-label': `当前词表有 ${annotationCount} 条待核查标注`,
      on: { click: () => startAnnotationReview(collection.id, '', currentViewKind) },
    }, [svgIcon('warning'), el('span', { text: annotationCount.toLocaleString() })]);
    elements['collection-toolbar'].replaceChildren(el('div', { className: 'collection-quick-actions' }, [reviewButton]));
  } else elements['collection-toolbar'].replaceChildren();
}

function currentMode(collection, section = currentViewKind) {
  return getViewMode(collection.id, section);
}

function currentBrowseAnchorEntry(collection, section = currentViewKind) {
  const entryId = firstVisibleEntryId();
  const entry = entryId ? getState().entryById.get(entryId) : null;
  if (!entry || sectionForEntry(entry) !== section) return null;
  if (!getState().visibleEntryIdsByCollection.get(collection.id)?.has(entry.id)) return null;
  return entry;
}

async function saveCurrentBrowseAnchor(collection, section = currentViewKind) {
  const entry = currentBrowseAnchorEntry(collection, section);
  if (!entry) {
    showToast('当前位置没有可保存的词条', 'warning');
    return false;
  }
  const mode = currentMode(collection, section);
  await setLastPosition(positionDomainId(collection, entry), collection.id, entry.id, { mode, section });
  updateLastPositionButton(collection);
  showToast(`已保存位置：${entry.text}`);
  return true;
}

function bindBrowseAnchorButton(target, collection, section = currentViewKind) {
  let holdTimer = 0;
  let held = false;
  let pointerId = null;
  const clearHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = 0;
  };
  target.onpointerdown = (event) => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    held = false;
    clearHold();
    holdTimer = window.setTimeout(async () => {
      held = true;
      holdTimer = 0;
      try {
        await saveCurrentBrowseAnchor(collection, section);
        target.title = '短按跳到浏览锚点；长按覆盖保存当前位置';
        target.setAttribute('aria-label', target.title);
        navigator.vibrate?.(12);
      } catch (error) { displayError(error); }
    }, 520);
  };
  target.onpointerup = (event) => {
    if (pointerId !== event.pointerId) return;
    clearHold();
    pointerId = null;
    if (held) {
      event.preventDefault();
      event.stopPropagation();
      requestAnimationFrame(() => { held = false; });
    }
  };
  target.onpointercancel = () => { clearHold(); pointerId = null; held = false; };
  target.onpointerleave = (event) => {
    if (pointerId === event.pointerId && event.buttons === 0) { clearHold(); pointerId = null; }
  };
  target.oncontextmenu = async (event) => {
    event.preventDefault();
    clearHold();
    pointerId = null;
    held = true;
    try {
      await saveCurrentBrowseAnchor(collection, section);
      target.title = '短按跳到浏览锚点；长按覆盖保存当前位置';
      target.setAttribute('aria-label', target.title);
      navigator.vibrate?.(12);
    } catch (error) { displayError(error); }
  };
  target.onclick = (event) => {
    if (held) { event.preventDefault(); held = false; return; }
    const mode = currentMode(collection, section);
    const anchor = getLastPosition(positionDomainId(collection), collection.id, { mode, section });
    if (!anchor) {
      showToast('长按此按钮保存当前位置');
      return;
    }
    jumpToEntry(anchor, { collectionId: collection.id, reason: 'last' });
  };
}

function renderBottomToolbar(collection, section = currentViewKind) {
  const mode = currentMode(collection, section);
  const last = getLastPosition(positionDomainId(collection), collection.id, { mode, section });
  const lastButton = elements['bottom-last-position'];
  lastButton.replaceChildren(svgIcon('target'));
  lastButton.disabled = false;
  lastButton.title = last ? '短按跳到浏览锚点；长按覆盖保存当前位置' : '长按保存当前位置';
  lastButton.setAttribute('aria-label', lastButton.title);
  bindBrowseAnchorButton(lastButton, collection, section);

  elements['back-to-top'].classList.remove('hidden');
  elements['back-to-top'].replaceChildren(svgIcon('top'));
  elements['back-to-top'].onclick = returnToTop;

  const modeButton = elements['bottom-mode'];
  modeButton.replaceChildren(svgIcon(mode === 'date' ? 'alphabet' : 'calendar'));
  modeButton.title = mode === 'date' ? '切换到字母排序' : '切换到日期排序';
  modeButton.setAttribute('aria-label', modeButton.title);
  modeButton.onclick = () => switchCollectionMode(collection, section).catch(displayError);

  const switchButton = elements['bottom-view-switch'];
  const canSwitch = collection.type === 'normal';
  const nextKind = section === 'word' ? 'phrase' : 'word';
  switchButton.replaceChildren(svgIcon(nextKind === 'phrase' ? 'phrase' : 'word'));
  switchButton.disabled = !canSwitch;
  switchButton.title = canSwitch ? `切换到${nextKind === 'phrase' ? '短语' : '词汇'}视图` : '系统总表已按内容类型固定';
  switchButton.setAttribute('aria-label', switchButton.title);
  switchButton.onclick = canSwitch ? () => switchCollectionView(collection, nextKind) : null;

  elements['bottom-search'].replaceChildren(svgIcon('search'));
  elements['bottom-search'].onclick = openSearchDialog;
  updateBackToTopVisibility();
}

function switchCollectionView(collection, nextKind) {
  if (collection.type !== 'normal' || !['word', 'phrase'].includes(nextKind) || nextKind === currentViewKind) return;
  persistCurrentHistorySnapshot();
  const snapshot = viewStateSnapshots.get(`${collection.id}:${nextKind}`) || null;
  currentViewKind = nextKind;
  activeSection = nextKind;
  pendingPageSnapshot = snapshot;
  pendingJumpEntryId = '';
  pendingJumpReason = snapshot ? 'return' : 'home';
  const nextHash = collectionRoute(collection.id, '', nextKind);
  history.replaceState({ ...(history.state || {}), vix: true, depth: appNavigationDepth, pageSnapshot: snapshot }, '', nextHash);
  performPageTransition(renderApp, true);
}

function sectionForEntry(entry) {
  return entry?.kind === 'phrase' ? 'phrase' : 'word';
}

function isCompositeCollection(collection) {
  return collection?.type === 'normal';
}

function isPhraseCollection(collection) {
  return collection?.type === 'system-phrases' || collection?.type === 'system-global-phrases';
}

function lastPositionButton(collection, section = currentViewKind, mode = getViewMode(collection.id, section)) {
  const entryId = getLastPosition(positionDomainId(collection), collection.id, { mode, section });
  const target = iconButton('target', 'last-position-button', entryId ? '短按跳到浏览锚点；长按覆盖保存当前位置' : '长按保存当前位置', () => {});
  target.disabled = false;
  target.dataset.section = section;
  target.dataset.mode = mode;
  bindBrowseAnchorButton(target, collection, section);
  return target;
}

function updateLastPositionButton(collection) {
  elements['collection-view'].querySelectorAll('.last-position-button').forEach((target) => {
    const section = target.dataset.section || currentViewKind;
    const mode = target.dataset.mode || getViewMode(collection.id, section);
    target.disabled = false;
  });
  if (elements['bottom-last-position'] && !elements['bottom-toolbar'].classList.contains('hidden')) {
    const section = currentViewKind;
    const mode = getViewMode(collection.id, section);
    elements['bottom-last-position'].disabled = false;
  }
}

function syncPinIndexForEntry(collectionId, entryId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const pins = getPinsForCollection(collectionId).filter((pin) => {
    const entry = state.entryById.get(pin.entryId);
    return collection?.type !== 'normal' || entry?.kind === currentViewKind;
  });
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
  const pins = getPinsForCollection(collection.id).filter((pin) => {
    const entry = state.entryById.get(pin.entryId);
    return collection.type !== 'normal' || entry?.kind === currentViewKind;
  });
  if (pinCollectionId !== collection.id) {
    pinCollectionId = collection.id;
    pinIndex = 0;
  }
  if (review.ids.length || !pins.length) {
    elements['pin-bar'].classList.add('hidden');
    elements.app.classList.remove('has-pin');
    if (!pins.length) pinIndex = 0;
    updateOverlayLayout();
    return;
  }
  if (pendingJumpEntryId) syncPinIndexForEntry(collection.id, pendingJumpEntryId);
  pinIndex = Math.max(0, Math.min(pinIndex, pins.length - 1));
  const pin = pins[pinIndex];
  const entry = state.entryById.get(pin.entryId);
  const pinDomainLabel = entry && isGlobalCollection(collection)
    && state.globalConflictKeys.has(`${entry.kind}\u0000${entry.normalizedText}`)
    ? (state.domainById.get(entry.domainId)?.name || entry.domainId)
    : '';
  elements['pin-bar'].classList.remove('hidden');
  elements.app.classList.add('has-pin');
  elements.app.classList.remove('has-review');
  elements['pin-bar'].replaceChildren(
    iconButton('chevron', 'pin-nav-button pin-prev', '上一个 PIN', () => jumpPinned(collection.id, -1)),
    el('button', { type: 'button', className: 'pin-current', 'aria-label': '重新定位当前 PIN', on: { click: () => entry && jumpToEntry(entry.id, { reason: 'pin' }) } }, [
      el('span', { className: 'pin-kicker', text: `PIN ${pinIndex + 1}/${pins.length}` }),
      el('strong', { text: [entry?.text || 'PIN 已失效', pinDomainLabel].filter(Boolean).join(' · ') }),
    ]),
    iconButton('chevron', 'pin-nav-button pin-next', '下一个 PIN', () => jumpPinned(collection.id, 1)),
  );
  updateOverlayLayout();
}

function letterForEntry(entry) {
  const letter = entry.normalizedText.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : '#';
}

function dateAnchorId(section, dateKey) {
  return `date-${section}-${dateKey}`;
}

function formatStudyDate(dateKey) {
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-').map(Number);
  const currentYear = new Date().getFullYear();
  return year === currentYear ? `${month}·${day}` : `${String(year).slice(-2)}·${month}·${day}`;
}

function currentSectionEntries(section) {
  return collectionRenderContext?.sections?.get(section)?.entries || [];
}

function jumpToSection(section) {
  const context = collectionRenderContext;
  if (!context?.sections?.has(section)) return;
  const sectionContext = context.sections.get(section);
  const target = sectionContext.root || sectionContext.sectionByKey.values().next().value || null;
  if (!target) return;
  activeSection = section;
  suppressScrollPersistence(500);
  positionHeadingBelowChrome(target.querySelector('.content-section-title, .letter-heading, .date-year-title, .date-unmarked-heading') || target);
}

async function switchCollectionMode(collection, section = currentViewKind) {
  const currentModeValue = getViewMode(collection.id, section);
  const nextMode = currentModeValue === 'date' ? 'alphabet' : 'date';
  const currentEntry = currentBrowseAnchorEntry(collection, section);
  pendingJumpEntryId = currentEntry?.id || '';
  pendingJumpReason = currentEntry ? 'mode' : 'home';
  if (!currentEntry) {
    expandedLettersFor(collection.id, section).clear();
    clearExpandedRelationsForView(collection.id, section);
  }
  await setViewMode(collection.id, nextMode, section);
}

function monthShift(monthKey, delta) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || '');
  const base = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
  base.setMonth(base.getMonth() + delta);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
}

function calendarForSection(collection, section, dates) {
  const sortedDates = [...dates].sort().reverse();
  const initial = getCalendarMonth(collection.id, section) || sortedDates[0]?.slice(0, 7)
    || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const monthKey = initial;
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const available = new Set(sortedDates.filter((date) => date.startsWith(`${monthKey}-`)));
  const grid = [];
  for (let index = 0; index < offset; index += 1) grid.push(el('span', { className: 'calendar-empty', 'aria-hidden': 'true' }));
  for (let day = 1; day <= days; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const enabled = available.has(dateKey);
    grid.push(button(String(day), enabled ? 'calendar-day active' : 'calendar-day', () => {
      const target = document.getElementById(dateAnchorId(section, dateKey));
      if (!target) return;
      activeSection = section;
      suppressScrollPersistence(500);
      positionHeadingBelowChrome(target);
    }, { disabled: !enabled, title: enabled ? `跳到 ${dateKey}` : '该日没有记录' }));
  }
  const calendar = el('section', { className: 'study-calendar', dataset: { section, month: monthKey }, 'aria-label': `${year} 年 ${month} 月学习日期` }, [
    el('header', { className: 'calendar-header' }, [
      iconButton('doubleChevron', 'calendar-prev-year', '上一年', async () => {
        const next = monthShift(monthKey, -12);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      iconButton('chevron', 'calendar-prev calendar-prev-month', '上个月', async () => {
        const next = monthShift(monthKey, -1);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      el('strong', { text: `${year} 年 ${month} 月` }),
      iconButton('chevron', 'calendar-next calendar-next-month', '下个月', async () => {
        const next = monthShift(monthKey, 1);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      iconButton('doubleChevron', 'calendar-next-year', '下一年', async () => {
        const next = monthShift(monthKey, 12);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
    ]),
    el('div', { className: 'calendar-weekdays', 'aria-hidden': 'true' }, ['一', '二', '三', '四', '五', '六', '日'].map((text) => el('span', { text }))),
    el('div', { className: 'calendar-grid' }, grid),
  ]);
  return calendar;
}

function navigationControls(collection, section, sectionContext, mode) {
  const track = [];
  if (mode === 'alphabet') {
    elements['collection-view'].classList.add('has-letter-nav');
    for (const letter of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']) {
      const enabled = sectionContext.grouped.has(letter);
      const control = button(letter, enabled ? '' : 'empty', () => {
        if (!enabled) return;
        setLetterSectionOpen(section, letter, true);
        const target = sectionContext.sectionByKey.get(letter);
        if (target) {
          activeSection = section;
          suppressScrollPersistence(300);
          positionHeadingBelowChrome(target.querySelector('.letter-heading') || target);
        }
      }, { disabled: !enabled });
      control.dataset.letter = letter;
      control.dataset.section = section;
      track.push(control);
    }
  }
  return { fixed: [], track };
}

function scheduleLetterTrackFinalSync(delay = 190) {
  clearTimeout(letterTrackResyncTimer);
  letterTrackResyncTimer = window.setTimeout(() => {
    letterTrackResyncTimer = 0;
    letterTrackInteractionUntil = 0;
    syncActiveAlphabetHeading();
  }, delay);
}

function populateNavigationBar(nav, controls) {
  const track = el('div', { className: 'letter-nav-track' }, controls.track);
  const markTrackInteraction = (duration = 500) => { letterTrackInteractionUntil = Date.now() + duration; };
  track.addEventListener('pointerdown', () => {
    clearTimeout(letterTrackResyncTimer);
    markTrackInteraction(900);
  }, { passive: true });
  track.addEventListener('pointerup', () => {
    markTrackInteraction(180);
    scheduleLetterTrackFinalSync(190);
  }, { passive: true });
  track.addEventListener('pointercancel', () => {
    markTrackInteraction(120);
    scheduleLetterTrackFinalSync(130);
  }, { passive: true });
  track.addEventListener('scroll', () => {
    markTrackInteraction(170);
    scheduleLetterTrackFinalSync(180);
  }, { passive: true });
  nav.replaceChildren(track);
  nav.classList.toggle('no-track', !controls.track.length);
}

function createSectionContext(section, entries, collection, mode) {
  const grouped = new Map();
  const dates = new Set();
  if (mode === 'alphabet') {
    for (const entry of entries) {
      const letter = letterForEntry(entry);
      const list = grouped.get(letter) || [];
      list.push(entry);
      grouped.set(letter, list);
    }
  } else {
    elements['collection-view'].classList.remove('has-letter-nav');
    for (const entry of entries) {
      const dateKey = getStudyStamp(entry, collection.id)?.reviewDateKey;
      if (dateKey) dates.add(dateKey);
    }
  }
  return { section, entries, grouped, sectionByKey: new Map(), root: null, dates };
}

function resetEntryChunking() {
  entryChunkObserver?.disconnect();
  entryChunkObserver = null;
  entryChunkByEntryId.clear();
}

function captureScrollAnchor() {
  const top = readingViewportBounds().top + 1;
  const candidates = [...elements['entry-list'].querySelectorAll('.letter-heading, .date-day-title, .date-unmarked-heading, .entry-row')];
  const anchor = candidates.find((node) => node.getBoundingClientRect().bottom > top) || null;
  return anchor ? { node: anchor, top: anchor.getBoundingClientRect().top } : null;
}

function restoreScrollAnchor(anchor) {
  if (!anchor?.node?.isConnected) return;
  const delta = anchor.node.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) > .5) window.scrollBy({ top: delta, behavior: 'auto' });
}

function materializeEntryChunk(chunk, { anchor = null, restore = true } = {}) {
  const data = entryChunkData.get(chunk);
  if (!data || data.renderToken !== renderRevision || chunk.dataset.rendered === 'true') return false;
  const capturedAnchor = anchor || (chunk.isConnected ? captureScrollAnchor() : null);
  chunk.dataset.rendered = 'true';
  const rows = data.items.map(({ entry, groupIndex }) => renderEntryRow(entry, data.collection, data.domain, {
    groupIndex,
    globalIndex: data.globalIndexById.get(entry.id) || groupIndex,
  }));
  chunk.replaceChildren(...rows);
  chunk.style.minHeight = '';
  entryChunkObserver?.unobserve(chunk);
  if (restore && capturedAnchor) requestAnimationFrame(() => {
    if (data.renderToken === renderRevision) restoreScrollAnchor(capturedAnchor);
  });
  return true;
}

function ensureEntryChunkObserver() {
  if (entryChunkObserver || !('IntersectionObserver' in window)) return entryChunkObserver;
  entryChunkObserver = new IntersectionObserver((records) => {
    const chunks = records.filter((record) => record.isIntersecting).map((record) => record.target);
    if (!chunks.length) return;
    const token = renderRevision;
    const anchor = captureScrollAnchor();
    let changed = false;
    for (const chunk of chunks) changed = materializeEntryChunk(chunk, { anchor, restore: false }) || changed;
    if (changed && anchor) requestAnimationFrame(() => {
      if (token === renderRevision) restoreScrollAnchor(anchor);
    });
  }, { rootMargin: '960px 0px 960px' });
  return entryChunkObserver;
}

function renderEntryChunks(entries, collection, domain, globalIndexById, { startIndex = 1, renderFirst = true, groupIndexById = null } = {}) {
  const fragment = document.createDocumentFragment();
  for (let offset = 0; offset < entries.length; offset += ENTRY_CHUNK_SIZE) {
    const slice = entries.slice(offset, offset + ENTRY_CHUNK_SIZE);
    const chunk = el('div', { className: 'entry-chunk', dataset: { rendered: 'false' } });
    const items = slice.map((entry, index) => ({ entry, groupIndex: groupIndexById?.get(entry.id) || startIndex + offset + index }));
    entryChunkData.set(chunk, { items, collection, domain, globalIndexById, renderToken: renderRevision });
    for (const { entry } of items) entryChunkByEntryId.set(entry.id, chunk);
    const estimatedHeight = slice.reduce((total, entry) => {
      const kind = entryLayoutKind(entry, displayGlossForEntry(entry, collection, domain));
      const rowHeight = kind === 'phrase-extreme' ? 88 : kind === 'phrase-two-line' ? 72 : ENTRY_ROW_ESTIMATE;
      const relationHeight = expandedRelations.has(relationExpansionKey(collection.id, entry.id))
        ? Math.max(0, relationItemsForEntry(entry).length * 42 + 8)
        : 0;
      return total + rowHeight + relationHeight;
    }, 0);
    chunk.style.minHeight = `${estimatedHeight}px`;
    fragment.append(chunk);
    if (renderFirst && offset === 0) materializeEntryChunk(chunk);
    else {
      const observer = ensureEntryChunkObserver();
      if (observer) observer.observe(chunk);
      else materializeEntryChunk(chunk);
    }
  }
  return fragment;
}

function groupedNumberIndex(entries, collection) {
  const shareByText = isGlobalCollection(collection);
  const result = new Map();
  let number = 0;
  let previousKey = '';
  for (const entry of entries) {
    const key = shareByText ? `${entry.kind}\u0000${entry.normalizedText}` : entry.id;
    if (key !== previousKey) {
      number += 1;
      previousKey = key;
    }
    result.set(entry.id, number);
  }
  return result;
}

function uniqueEntryCountForDisplay(entries, collection) {
  if (!isGlobalCollection(collection)) return entries.length;
  return new Set(entries.map((entry) => `${entry.kind}\u0000${entry.normalizedText}`)).size;
}

function renderAlphabetContent(context, sectionContext) {
  const { collection, domain, globalIndexById } = context;
  const section = sectionContext.section;
  const expandedLetters = expandedLettersFor(collection.id, section);
  const root = el('section', { className: `content-section ${section}-content`, id: `content-${section}`, dataset: { section } });
  if (!sectionContext.entries.length) {
    root.append(el('div', { className: 'empty-state compact-empty', text: section === 'word' ? '暂无词汇' : '暂无短语' }));
    sectionContext.root = root;
    return root;
  }
  for (const letter of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].filter((item) => sectionContext.grouped.has(item))) {
    const sectionNode = el('section', {
      className: 'letter-section', id: `letter-${section}-${letter === '#' ? 'other' : letter}`, dataset: { letter, section },
    });
    const heading = button('', 'letter-heading', (event) => toggleLetterSectionWithAnchor(section, letter, event.currentTarget));
    heading.setAttribute('aria-expanded', expandedLetters.has(letter) ? 'true' : 'false');
    heading.append(
      el('span', { className: 'letter-title', text: letter }),
      el('span', { className: 'letter-count', text: uniqueEntryCountForDisplay(sectionContext.grouped.get(letter), collection).toLocaleString() }),
      el('span', { className: 'letter-indicator' }, [svgIcon('chevron')]),
    );
    sectionNode.append(heading);
    if (expandedLetters.has(letter)) {
      const body = el('div', { className: 'letter-body' });
      const groupEntries = sectionContext.grouped.get(letter);
      body.append(renderEntryChunks(groupEntries, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(groupEntries, collection) }));
      sectionNode.append(body);
    }
    sectionContext.sectionByKey.set(letter, sectionNode);
    root.append(sectionNode);
  }
  sectionContext.root = root;
  return root;
}

function renderDateContent(context, sectionContext) {
  const { collection, domain, globalIndexById } = context;
  const section = sectionContext.section;
  const root = el('section', { className: `content-section date-content ${section}-content`, id: `content-${section}`, dataset: { section } });
  const stampedByDate = new Map();
  const unmarked = [];
  for (const entry of sectionContext.entries) {
    const stamp = getStudyStamp(entry, collection.id);
    if (!stamp) {
      unmarked.push(entry);
      continue;
    }
    const group = stampedByDate.get(stamp.reviewDateKey) || [];
    group.push(entry);
    stampedByDate.set(stamp.reviewDateKey, group);
  }
  const dates = [...stampedByDate.keys()].sort((a, b) => b.localeCompare(a));
  let currentYear = '';
  let currentMonth = '';
  for (const dateKey of dates) {
    const [year, month, day] = dateKey.split('-');
    if (year !== currentYear) {
      currentYear = year;
      currentMonth = '';
      root.append(el('h2', { className: 'date-year-title', text: year }));
    }
    if (month !== currentMonth) {
      currentMonth = month;
      root.append(el('h3', { className: 'date-month-title', text: `${Number(month)} 月` }));
    }
    const entries = stampedByDate.get(dateKey).sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
    const daySection = el('section', { className: 'date-day-section', id: dateAnchorId(section, dateKey), dataset: { date: dateKey, section } }, [
      el('h4', { className: 'date-day-title', text: `${Number(day)} 日` }),
    ]);
    const dayBody = el('div', { className: 'letter-body date-day-body' });
    dayBody.append(renderEntryChunks(entries, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(entries, collection) }));
    daySection.append(dayBody);
    root.append(daySection);
    sectionContext.sectionByKey.set(dateKey, daySection);
  }
  unmarked.sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  if (unmarked.length) {
    const unmarkedBody = el('div', { className: 'letter-body unmarked-body' });
    unmarkedBody.append(renderEntryChunks(unmarked, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(unmarked, collection) }));
    const unmarkedSection = el('section', { className: 'date-unmarked-section', id: `unmarked-${section}`, dataset: { section } }, [
      el('h2', { className: 'date-unmarked-heading', text: '未标注' }),
      unmarkedBody,
    ]);
    root.append(unmarkedSection);
    sectionContext.sectionByKey.set('unmarked', unmarkedSection);
  }
  if (!dates.length && !unmarked.length) root.append(el('div', { className: 'empty-state compact-empty', text: section === 'word' ? '暂无词汇' : '暂无短语' }));
  sectionContext.root = root;
  return root;
}

function renderEntryList(collection, domain, entries, section = currentViewKind) {
  resetEntryChunking();
  collectionRenderContext = null;
  const mode = getViewMode(collection.id, section);
  const sections = new Map();
  const sectionContext = createSectionContext(section, entries, collection, mode);
  sections.set(section, sectionContext);
  activeSection = section;
  const globalIndexById = groupedNumberIndex(entries, collection);
  const context = { collection, domain, entries, mode, sections, firstSection: section, globalIndexById };
  collectionRenderContext = context;

  if (mode === 'alphabet') {
    elements['letter-nav'].classList.remove('hidden');
    elements['letter-nav'].dataset.section = section;
    elements['letter-nav'].setAttribute('aria-label', `${section === 'word' ? '词汇' : '短语'}字母索引`);
    populateNavigationBar(elements['letter-nav'], navigationControls(collection, section, sectionContext, mode));
  } else {
    elements['letter-nav'].classList.add('hidden');
    elements['letter-nav'].replaceChildren();
  }

  const output = [];
  if (mode === 'date') output.push(calendarForSection(collection, section, sectionContext.dates));
  output.push(mode === 'date' ? renderDateContent(context, sectionContext) : renderAlphabetContent(context, sectionContext));
  elements['entry-list'].replaceChildren(...output);
  updateBackToTopVisibility();
  updateOverlayLayout();
}

function setLetterSectionOpen(section, letter, open) {
  const context = collectionRenderContext;
  if (!context || context.collection.id !== currentCollectionId || context.mode !== 'alphabet') return false;
  const sectionContext = context.sections.get(section);
  const sectionNode = sectionContext?.sectionByKey.get(letter);
  const entries = sectionContext?.grouped.get(letter);
  if (!sectionNode || !entries) return false;
  const expandedLetters = expandedLettersFor(currentCollectionId, section);
  const heading = sectionNode.querySelector('.letter-heading');
  const indicator = sectionNode.querySelector('.letter-indicator');
  let body = sectionNode.querySelector('.letter-body');
  if (open) {
    expandedLetters.add(letter);
    if (!body) {
      body = el('div', { className: 'letter-body' });
      body.append(renderEntryChunks(entries, context.collection, context.domain, context.globalIndexById, { groupIndexById: groupedNumberIndex(entries, context.collection) }));
      sectionNode.append(body);
    }
  } else {
    expandedLetters.delete(letter);
    if (body) {
      for (const chunk of body.querySelectorAll('.entry-chunk')) {
        entryChunkObserver?.unobserve(chunk);
        const data = entryChunkData.get(chunk);
        for (const item of data?.items || []) {
          if (entryChunkByEntryId.get(item.entry.id) === chunk) entryChunkByEntryId.delete(item.entry.id);
        }
      }
      body.remove();
    }
  }
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (indicator) indicator.classList.toggle('open', open);
  updateActiveLetter(section, letter);
  persistCurrentHistorySnapshot();
  return true;
}

function toggleLetterSectionWithAnchor(section, letter, heading) {
  const context = collectionRenderContext;
  if (!context || context.mode !== 'alphabet') return;
  const open = !expandedLettersFor(currentCollectionId, section).has(letter);
  if (open) {
    setLetterSectionOpen(section, letter, true);
    return;
  }
  const beforeTop = heading?.getBoundingClientRect().top;
  const root = document.documentElement;
  const previousAnchor = root.style.overflowAnchor;
  root.style.overflowAnchor = 'none';
  setLetterSectionOpen(section, letter, false);
  requestAnimationFrame(() => {
    if (heading?.isConnected && Number.isFinite(beforeTop)) {
      const delta = heading.getBoundingClientRect().top - beforeTop;
      if (Math.abs(delta) > .5) window.scrollBy({ top: delta, behavior: 'auto' });
    }
    requestAnimationFrame(() => { root.style.overflowAnchor = previousAnchor; syncActiveAlphabetHeading(); });
  });
}

function updateActiveLetter(section, letter = '', { ensureVisible = false } = {}) {
  const track = elements['letter-nav'].querySelector('.letter-nav-track');
  if (!track) return;
  const buttons = [...track.querySelectorAll('button[data-letter]')];
  for (const button of buttons) button.classList.toggle('active', button.dataset.letter === letter && button.dataset.section === section);
  const active = buttons.find((button) => button.dataset.letter === letter && button.dataset.section === section);
  if (!active || !ensureVisible || Date.now() < letterTrackInteractionUntil) return;

  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  if (letter === 'A' || maxScroll <= 1) {
    if (track.scrollLeft !== 0) track.scrollTo({ left: 0, behavior: 'auto' });
    return;
  }
  if (letter === '#') {
    if (Math.abs(track.scrollLeft - maxScroll) > 1) track.scrollTo({ left: maxScroll, behavior: 'auto' });
    return;
  }

  const trackRect = track.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  const buttonWidth = Math.max(1, activeRect.width || 52);
  const startGuard = trackRect.left + buttonWidth * 1.15;
  const endGuard = trackRect.right - buttonWidth * 1.15;
  let nextLeft = track.scrollLeft;
  if (activeRect.right >= endGuard) {
    nextLeft = Math.min(maxScroll, track.scrollLeft + (activeRect.right - endGuard) + buttonWidth * 1.45);
  } else if (activeRect.left <= startGuard) {
    nextLeft = Math.max(0, track.scrollLeft - (startGuard - activeRect.left) - buttonWidth * 1.45);
  } else return;
  nextLeft = Math.max(0, Math.min(maxScroll, nextLeft));
  if (Math.abs(nextLeft - track.scrollLeft) > 1) track.scrollTo({ left: nextLeft, behavior: 'auto' });
}

function syncActiveAlphabetHeading() {
  const context = collectionRenderContext;
  if (!currentCollectionId || !context || context.mode !== 'alphabet') return;
  const probe = readingViewportBounds().top + 2;
  const sections = [...elements['entry-list'].querySelectorAll('.letter-section[data-letter][data-section]')];
  let active = null;
  for (const node of sections) {
    const rect = node.getBoundingClientRect();
    if (rect.top <= probe && rect.bottom > probe) { active = node; break; }
    if (rect.top <= probe) active = node;
    else if (!active) { active = node; break; }
  }
  if (!active) return;
  for (const heading of elements['entry-list'].querySelectorAll('.letter-heading.active-sticky')) heading.classList.remove('active-sticky');
  active.querySelector('.letter-heading')?.classList.add('active-sticky');
  activeSection = active.dataset.section || activeSection;
  updateActiveLetter(activeSection, active.dataset.letter || '', { ensureVisible: true });
}

function updateLargeTitleState() {
  const title = elements['large-title'];
  const topbar = document.querySelector('.topbar');
  if (!title || !topbar) return;
  const titleRect = title.getBoundingClientRect();
  const barRect = topbar.getBoundingClientRect();
  const collapsed = titleRect.bottom <= barRect.bottom + 12 || window.scrollY >= Math.max(44, title.offsetTop + title.offsetHeight - 36);
  elements.app.classList.toggle('large-title-collapsed', collapsed);
}

function normalDestinationsForEntries(entries, { preferredCollectionId = '', domainId = '' } = {}) {
  const state = getState();
  const seen = new Set();
  const destinations = [];
  for (const entry of entries.filter(Boolean)) {
    for (const membership of state.membershipsByEntry.get(entry.id) || []) {
      const collection = state.collectionById.get(membership.collectionId);
      if (!collection || collection.type !== 'normal' || collection.hidden) continue;
      if (domainId && collection.domainId !== domainId) continue;
      if (!state.visibleEntryIdsByCollection.get(collection.id)?.has(entry.id)) continue;
      const key = `${collection.id}\u0000${entry.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      destinations.push({
        entry,
        collectionId: collection.id,
        label: `${collection.name} · ${entry.kind === 'phrase' ? '短语区' : '词汇区'}`,
        domainId: collection.domainId,
      });
    }
  }
  return destinations.sort((a, b) => {
    const domainA = Number(state.domainById.get(a.domainId)?.order || 0);
    const domainB = Number(state.domainById.get(b.domainId)?.order || 0);
    if (domainA !== domainB) return domainA - domainB;
    const collectionA = state.collectionById.get(a.collectionId);
    const collectionB = state.collectionById.get(b.collectionId);
    return Number(collectionA?.order || 0) - Number(collectionB?.order || 0)
      || String(collectionA?.name || '').localeCompare(String(collectionB?.name || ''));
  });
}

function hasRelationsForEntry(entry) {
  const state = getState();
  if (entry.kind === 'word') return getRelatedPhrases(entry.id).length > 0;
  const components = getPhraseComponents(entry.id);
  return components.some((component) => (state.wordsByNormalizedText.get(normalizeEnglish(component.token)) || []).length);
}

function relationItemsForEntry(entry) {
  const state = getState();
  if (entry.kind === 'word') {
    const byText = new Map();
    for (const relatedPhrase of getRelatedPhrases(entry.id)) {
      const targetEntries = state.phrasesByNormalizedText.get(relatedPhrase.normalizedText) || [relatedPhrase];
      const item = byText.get(relatedPhrase.normalizedText) || {
        text: relatedPhrase.text,
        normalizedText: relatedPhrase.normalizedText,
        kind: 'phrase',
        targetEntries: [],
      };
      for (const candidate of targetEntries) {
        if (!item.targetEntries.some((target) => target.id === candidate.id)) item.targetEntries.push(candidate);
      }
      byText.set(relatedPhrase.normalizedText, item);
    }
    return [...byText.values()].map((item) => ({
      ...item,
      destinations: normalDestinationsForEntries(item.targetEntries),
    })).sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  }

  const byToken = new Map();
  for (const component of getPhraseComponents(entry.id)) {
    const key = normalizeEnglish(component.token);
    if (!key) continue;
    const item = byToken.get(key) || {
      text: component.token,
      normalizedText: key,
      kind: 'word',
      targetEntries: [],
    };
    for (const word of state.wordsByNormalizedText.get(key) || []) {
      if (!item.targetEntries.some((candidate) => candidate.id === word.id)) item.targetEntries.push(word);
    }
    byToken.set(key, item);
  }
  return [...byToken.values()].map((item) => ({
    ...item,
    destinations: normalDestinationsForEntries(item.targetEntries),
  })).sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
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
  closeRelationTargetMenu();
  closeActionDialog();
  navigateCollection(destination.collectionId, destination.entry.id, 'relation', destination.entry.kind);
}

function relationNavigationMode(sourceEntry, destinations) {
  if (destinations.length > 1) return 'multi';
  if (destinations.length === 1 && destinations[0].domainId === sourceEntry.domainId) return 'intra';
  return destinations.length === 1 ? 'external' : 'none';
}

function closeRelationTargetMenu({ restoreFocus = false } = {}) {
  if (!activeRelationTargetMenu) return;
  const source = activeRelationTargetMenu.source;
  elements['relation-target-menu'].classList.add('hidden');
  elements['relation-target-menu'].replaceChildren();
  activeRelationTargetMenu = null;
  if (restoreFocus && source?.isConnected) source.focus({ preventScroll: true });
}

function positionRelationTargetMenu() {
  if (!activeRelationTargetMenu || elements['relation-target-menu'].classList.contains('hidden')) return;
  const source = activeRelationTargetMenu.source;
  if (!source?.isConnected) { closeRelationTargetMenu(); return; }
  const menu = elements['relation-target-menu'];
  const sourceRect = source.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const chromeBottom = Math.max(viewportTop + 8, document.querySelector('.topbar')?.getBoundingClientRect().bottom || viewportTop);
  const gap = 8;
  let top = sourceRect.bottom + gap;
  let below = true;
  if (top + menuRect.height > viewportBottom - 8) {
    top = sourceRect.top - menuRect.height - gap;
    below = false;
  }
  top = Math.max(chromeBottom + 8, Math.min(top, viewportBottom - menuRect.height - 8));
  const left = Math.min(Math.max(viewportLeft + 8, sourceRect.right - menuRect.width), viewportRight - menuRect.width - 8);
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.classList.toggle('below', below);
}

function openRelationTargetMenu(item, sourceEntry, source) {
  closeRelationTargetMenu();
  const state = getState();
  const destinations = item.destinations || [];
  activeRelationTargetMenu = { source, item, sourceEntry };
  elements['relation-target-menu'].replaceChildren(
    el('div', { className: 'relation-target-menu-title', text: `跳转到 · ${item.text}` }),
    ...destinations.map((destination) => {
      const domainName = state.domainById.get(destination.domainId)?.name || destination.domainId;
      const label = [domainName, destination.label].filter(Boolean).join(' · ');
      const option = button(label, 'relation-target-option', () => navigateRelationDestination(destination));
      option.setAttribute('role', 'menuitem');
      return option;
    }),
  );
  elements['relation-target-menu'].classList.remove('hidden');
  requestAnimationFrame(() => {
    positionRelationTargetMenu();
    elements['relation-target-menu'].querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
  });
}

function jumpToRelation(item, sourceEntry, sourceButton = null) {
  const destinations = item.destinations || [];
  if (!destinations.length) return;
  if (destinations.length === 1) {
    navigateRelationDestination(destinations[0]);
    return;
  }
  if (sourceButton) openRelationTargetMenu(item, sourceEntry, sourceButton);
}

function displayGlossForRelationItem(item, sourceEntry) {
  const state = getState();
  const candidates = item.kind === 'phrase'
    ? (state.phrasesByNormalizedText.get(item.normalizedText) || [])
    : (state.wordsByNormalizedText.get(item.normalizedText) || []);
  if (!candidates.length) return '';
  const domain = state.domainById.get(sourceEntry?.domainId);
  if (!domain?.glossEnabled) return '';
  return candidates.find((candidate) => candidate.domainId === sourceEntry.domainId && candidate.glossHant)?.glossHant || '';
}

function renderRelationPanel(entry, items = null) {
  const relationItems = items || relationItemsForEntry(entry);
  if (!relationItems.length || !expandedRelations.has(relationExpansionKey(currentCollectionId, entry.id))) return null;
  return el('div', { className: 'relation-panel' }, relationItems.map((item) => {
    const gloss = displayGlossForRelationItem(item, entry);
    const navigationMode = relationNavigationMode(entry, item.destinations || []);
    const navigationLabel = navigationMode === 'multi'
      ? `选择 ${item.text} 的跳转目标`
      : navigationMode === 'external'
        ? `跳到其他独立域中的 ${item.text}`
        : `跳到当前独立域中的 ${item.text}`;
    const jumpButton = item.destinations?.length ? iconButton(
      navigationMode,
      `relation-jump ${navigationMode}`,
      navigationLabel,
      (event) => jumpToRelation(item, entry, event.currentTarget),
    ) : el('span', { className: 'relation-jump-placeholder', 'aria-hidden': 'true' });
    return el('div', { className: 'relation-item' }, [
      el('button', { type: 'button', className: 'relation-copy', on: { click: () => copyText(item.text).catch(displayError) } }, [el('span', { className: 'relation-text', text: item.text })]),
      gloss ? el('span', { className: 'relation-gloss', text: gloss, title: gloss }) : el('span', { className: 'relation-gloss empty', 'aria-hidden': 'true' }),
      jumpButton,
    ]);
  }));
}

function indexesForRenderedEntry(context, entry) {
  const globalIndex = context.globalIndexById.get(entry.id) || 1;
  const section = sectionForEntry(entry);
  const sectionContext = context.sections.get(section);
  if (!sectionContext) return { groupIndex: 1, globalIndex };
  if (context.mode === 'alphabet') {
    const group = sectionContext.grouped.get(letterForEntry(entry)) || [];
    return { groupIndex: groupedNumberIndex(group, context.collection).get(entry.id) || 1, globalIndex };
  }
  const stamp = getStudyStamp(entry, context.collection.id);
  const group = stamp
    ? sectionContext.entries.filter((item) => getStudyStamp(item, context.collection.id)?.reviewDateKey === stamp.reviewDateKey)
      .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'))
    : sectionContext.entries.filter((item) => !getStudyStamp(item, context.collection.id))
      .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  return { groupIndex: groupedNumberIndex(group, context.collection).get(entry.id) || 1, globalIndex };
}

function toggleEntryRelations(entryId) {
  closeQueryMenu();
  const key = relationExpansionKey(currentCollectionId, entryId);
  if (expandedRelations.has(key)) expandedRelations.delete(key);
  else expandedRelations.add(key);
  const context = collectionRenderContext;
  const entry = getState().entryById.get(entryId);
  const current = document.getElementById(`entry-${entryId}`);
  if (!context || !entry || !current) return;
  const beforeTop = current.getBoundingClientRect().top;
  const next = renderEntryRow(entry, context.collection, context.domain, indexesForRenderedEntry(context, entry));
  current.replaceWith(next);
  requestAnimationFrame(() => {
    const delta = next.getBoundingClientRect().top - beforeTop;
    if (Math.abs(delta) > .5) window.scrollBy({ top: delta, behavior: 'auto' });
    persistCurrentHistorySnapshot();
  });
}

async function toggleEntryPin(entry, collection, sourceButton = null) {
  closeQueryMenu();
  const existingPin = getState().pinByEntry.get(entry.id) || null;
  const wasPinned = Boolean(existingPin);
  sourceButton?.classList.toggle('active', !wasPinned);
  sourceButton?.setAttribute('aria-pressed', wasPinned ? 'false' : 'true');
  try {
    await togglePin(entry.id, collection.id);
  } catch (error) {
    sourceButton?.classList.toggle('active', wasPinned);
    sourceButton?.setAttribute('aria-pressed', wasPinned ? 'true' : 'false');
    throw error;
  }
  syncPinIndexForEntry(collection.id, entry.id);
  const context = collectionRenderContext;
  const current = document.getElementById(`entry-${entry.id}`);
  if (context && current) current.replaceWith(renderEntryRow(entry, collection, context.domain, indexesForRenderedEntry(context, entry)));
  renderPinBar(collection);
  showToast(wasPinned ? 'PIN 已取消' : existingPin ? 'PIN 已移到当前词表' : 'PIN 已设置');
}

function displayGlossForEntry(entry, collection, domain) {
  const state = getState();
  const entryDomain = state.domainById.get(entry.domainId);
  if (isGlobalCollection(collection)) return entryDomain?.glossEnabled ? entry.glossHant || '' : '';
  return domain?.glossEnabled ? entry.glossHant || '' : '';
}

async function refreshEntryStudyDate(entry, collection, sourceButton = null) {
  closeQueryMenu();
  const section = sectionForEntry(entry);
  const mode = getViewMode(collection.id, section);
  if (mode === 'date') {
    pendingJumpEntryId = entry.id;
    pendingJumpReason = 'study-date';
  }
  sourceButton?.classList.add('updating');
  try {
    const stamp = await refreshStudyDate(entry.id, collection.id);
    if (mode === 'alphabet') {
      const context = collectionRenderContext;
      const row = document.getElementById(`entry-${entry.id}`);
      if (context && row) row.replaceWith(renderEntryRow(entry, collection, context.domain, indexesForRenderedEntry(context, entry)));
      showToast(`学习日期已刷新：${formatStudyDate(stamp.reviewDateKey)}`);
    }
  } catch (error) {
    pendingJumpEntryId = '';
    throw error;
  } finally {
    sourceButton?.classList.remove('updating');
  }
}

function openOxfordLookup(entry) {
  window.location.assign(buildOxfordLookupUrl(entry.text));
}

function openChatGPTEntryQuery(entry, collection) {
  const state = getState();
  const context = createEntryContext(state, entry, collection.id, {
    appVersion: APP_VERSION,
    viewMode: getViewMode(collection.id, sectionForEntry(entry)),
    section: sectionForEntry(entry),
  });
  const prompt = buildChatGPTPrompt(context);
  window.location.assign(buildChatGPTShortcutUrl(prompt));
}

function estimatedTextUnits(text) {
  let units = 0;
  for (const char of String(text || '')) {
    if (/\s/.test(char)) units += 0.42;
    else if (/[ilI1'.,:;|]/.test(char)) units += 0.48;
    else if (/[mwMW@%&]/.test(char)) units += 1.28;
    else if (/[^\x00-\x7F]/.test(char)) units += 1.05;
    else units += 0.86;
  }
  return units;
}

function entryLayoutKind(entry, gloss = '') {
  if (entry.kind !== 'phrase') return 'word-normal';
  const phraseUnits = estimatedTextUnits(entry.text);
  const glossUnits = estimatedTextUnits(gloss);
  if (phraseUnits <= 13.5 && glossUnits <= 18) return 'phrase-normal';
  if (phraseUnits <= 28 && glossUnits <= 24) return 'phrase-two-line';
  return 'phrase-extreme';
}

function handleEntryPrimaryAction(entry, collection, annotationRecord) {
  if (annotationRecord) startAnnotationReview(collection.id, annotationRecord.sourceEntryId);
  else copyEntry(entry, collection);
}

function createTextViewport(entry, collection, gloss, annotationRecord, layoutKind, indexText = '') {
  const isScrollable = entry.kind === 'word' || layoutKind === 'phrase-extreme';
  let pointerStart = null;
  let suppressClick = false;
  const viewport = el('div', {
    className: `entry-text-viewport${isScrollable ? ' horizontally-scrollable' : ''}${gloss ? ' has-gloss' : ' no-gloss'}`,
    role: 'button', tabindex: 0,
    'aria-label': annotationRecord ? `处理 ${entry.text} 的待核查标注` : `复制 ${entry.text}`,
  });
  const lexemeStack = el('span', { className: 'entry-lexeme-stack' }, [
    el('span', { className: 'entry-text', text: entry.text, title: entry.text }),
    gloss ? el('span', { className: 'entry-gloss', text: gloss, title: gloss }) : null,
  ]);
  const primaryLine = el('div', { className: 'entry-primary-text-line' }, [
    indexText ? el('span', { className: 'entry-index-inline', text: indexText, 'aria-hidden': 'true' }) : null,
    lexemeStack,
  ]);
  const content = el('div', { className: 'entry-text-content' }, [primaryLine]);
  viewport.append(content);
  const updateOverflowState = () => {
    if (!isScrollable) return;
    const overflow = viewport.scrollWidth > viewport.clientWidth + 1;
    viewport.classList.toggle('has-overflow', overflow);
    viewport.classList.toggle('at-scroll-start', !overflow || viewport.scrollLeft <= 1);
    viewport.classList.toggle('at-scroll-end', !overflow || viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 1);
  };
  if (isScrollable) {
    viewport.scrollLeft = 0;
    viewport.addEventListener('pointerdown', (event) => {
      pointerStart = { x: event.clientX, y: event.clientY };
      suppressClick = false;
    }, { passive: true });
    viewport.addEventListener('pointermove', (event) => {
      if (!pointerStart) return;
      const dx = Math.abs(event.clientX - pointerStart.x);
      const dy = Math.abs(event.clientY - pointerStart.y);
      if (dx > 7 && dx > dy * 1.15) suppressClick = true;
    }, { passive: true });
    viewport.addEventListener('pointerup', () => { pointerStart = null; }, { passive: true });
    viewport.addEventListener('pointercancel', () => { pointerStart = null; suppressClick = true; }, { passive: true });
    viewport.addEventListener('scroll', () => {
      suppressClick = true;
      updateOverflowState();
      clearTimeout(viewport._scrollEndTimer);
      viewport._scrollEndTimer = setTimeout(() => { suppressClick = false; }, 120);
    }, { passive: true });
    requestAnimationFrame(updateOverflowState);
  }
  viewport.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    handleEntryPrimaryAction(entry, collection, annotationRecord);
  });
  viewport.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleEntryPrimaryAction(entry, collection, annotationRecord);
  });
  return viewport;
}

function closeQueryMenu({ restoreFocus = false } = {}) {
  if (!activeQueryMenu) return;
  const source = activeQueryMenu.source;
  elements['query-menu'].classList.add('hidden');
  elements['query-menu'].classList.remove('below');
  elements['query-menu'].replaceChildren();
  activeQueryMenu.source?.setAttribute('aria-expanded', 'false');
  activeQueryMenu = null;
  if (restoreFocus && source?.isConnected) source.focus({ preventScroll: true });
}

function positionQueryMenu() {
  if (!activeQueryMenu || elements['query-menu'].classList.contains('hidden')) return;
  if (!activeQueryMenu.source?.isConnected) { closeQueryMenu(); return; }
  const sourceRect = activeQueryMenu.source.getBoundingClientRect();
  const menu = elements['query-menu'];
  const menuRect = menu.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const chromeBottom = Math.max(viewportTop + 8, document.querySelector('.topbar')?.getBoundingClientRect().bottom || viewportTop);
  const gap = 9;
  let top = sourceRect.top - menuRect.height - gap;
  let below = false;
  if (top < chromeBottom + 8) {
    top = sourceRect.bottom + gap;
    below = true;
  }
  top = Math.max(viewportTop + 8, Math.min(top, viewportBottom - menuRect.height - 8));
  const left = Math.min(
    Math.max(viewportLeft + 8, sourceRect.left + sourceRect.width / 2 - menuRect.width / 2),
    viewportRight - menuRect.width - 8,
  );
  const arrowX = Math.min(menuRect.width - 16, Math.max(16, sourceRect.left + sourceRect.width / 2 - left));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.setProperty('--query-arrow-x', `${Math.round(arrowX)}px`);
  menu.classList.toggle('below', below);
}

function openQueryMenu(entry, collection, source) {
  if (activeQueryMenu?.entryId === entry.id && activeQueryMenu.source === source) {
    closeQueryMenu();
    return;
  }
  closeQueryMenu();
  activeQueryMenu = { entryId: entry.id, source };
  source.setAttribute('aria-expanded', 'true');
  const oxford = iconButton('dictionary', 'query-menu-option oxford-option', `在牛津英汉辞书中查询 ${entry.text}`, () => {
    closeQueryMenu();
    try { openOxfordLookup(entry); } catch (error) { displayError(error); }
  });
  oxford.setAttribute('role', 'menuitem');
  const chatgpt = iconButton('aiChat', 'query-menu-option chatgpt-option', `交给 ChatGPT 新建查询：${entry.text}`, () => {
    closeQueryMenu();
    try { openChatGPTEntryQuery(entry, collection); } catch (error) { displayError(error); }
  });
  chatgpt.setAttribute('role', 'menuitem');
  elements['query-menu'].replaceChildren(oxford, chatgpt);
  elements['query-menu'].classList.remove('hidden');
  requestAnimationFrame(() => {
    positionQueryMenu();
    oxford.focus({ preventScroll: true });
  });
}

function entryActionButtons(entry, collection, pinned, studyStamp) {
  const refresh = iconButton('refresh', 'entry-study-refresh', studyStamp ? '刷新学习日期' : '标注今天为学习日期', (event) => refreshEntryStudyDate(entry, collection, event.currentTarget).catch(displayError));
  const pin = el('button', {
    type: 'button', className: `entry-pin${pinned ? ' active' : ''}`,
    title: pinned ? '取消 PIN' : '设置 PIN', 'aria-label': pinned ? '取消 PIN' : '设置 PIN',
    'aria-pressed': pinned ? 'true' : 'false',
    on: { click: (event) => toggleEntryPin(entry, collection, event.currentTarget).catch(displayError) },
  }, [svgIcon('pin')]);
  const query = iconButton('query', 'entry-query', '选择查询方式', (event) => openQueryMenu(entry, collection, event.currentTarget));
  query.setAttribute('aria-haspopup', 'menu');
  query.setAttribute('aria-expanded', 'false');
  const more = iconButton('more', 'entry-more', '更多', () => openEntryActions(entry.id, collection.id));
  return { refresh, pin, query, more };
}

function renderEntryRow(entry, collection, domain, indexes = { groupIndex: 0, globalIndex: 0 }) {
  const state = getState();
  const pinRecord = state.pinByEntry.get(entry.id) || null;
  const pinned = Boolean(pinRecord);
  const annotationRecord = annotationRecordForEntry(entry, collection);
  const annotation = annotationRecord?.annotation || null;
  const numberMode = state.settings.numberMode || 'global';
  const indexText = numberMode === 'group' ? `${indexes.groupIndex}` : numberMode === 'global' ? `${indexes.globalIndex}` : '';
  const expanded = expandedRelations.has(relationExpansionKey(collection.id, entry.id));
  const relations = expanded ? relationItemsForEntry(entry) : null;
  const hasRelations = expanded ? Boolean(relations?.length) : hasRelationsForEntry(entry);
  const gloss = displayGlossForEntry(entry, collection, domain);
  const conflictKey = `${entry.kind}\u0000${entry.normalizedText}`;
  const sourceDomainLabel = isGlobalCollection(collection) && state.globalConflictKeys.has(conflictKey)
    ? (state.domainById.get(entry.domainId)?.name || entry.domainId)
    : '';
  const studyStamp = getStudyStamp(entry, collection.id);
  const layoutKind = entryLayoutKind(entry, gloss);
  const row = el('article', {
    className: `entry-row ${layoutKind}${indexText ? ' has-index' : ' no-index'}${gloss ? ' has-gloss' : ' no-gloss'}${(gloss || sourceDomainLabel) ? ' has-meta-row' : ' no-meta-row'}${expanded ? ' relations-open' : ''}${annotation ? ' annotated' : ''}${hasRelations ? ' has-relations' : ''}${sourceDomainLabel ? ' has-source-domain' : ''}`,
    id: `entry-${entry.id}`,
    dataset: { entryId: entry.id, section: sectionForEntry(entry), layout: layoutKind },
  });
  const actions = entryActionButtons(entry, collection, pinned, studyStamp);
  const actionItems = [];
  if (hasRelations) {
    actionItems.push(iconButton('disclosure', `entry-relations${expanded ? ' active' : ''}`, expanded ? '收起关联' : '展开关联', () => toggleEntryRelations(entry.id)));
    actionItems[0].setAttribute('aria-expanded', expanded ? 'true' : 'false');
  } else actionItems.push(el('span', { className: 'entry-action-placeholder', 'aria-hidden': 'true' }));
  actionItems.push(actions.refresh, actions.pin, actions.query, actions.more);
  const textViewport = createTextViewport(entry, collection, gloss, annotationRecord, layoutKind, indexText);
  const lineChildren = [textViewport];
  if (studyStamp) lineChildren.push(el('span', {
    className: 'entry-study-date marked',
    text: formatStudyDate(studyStamp.reviewDateKey),
    'aria-label': `最近学习日期 ${studyStamp.reviewDateKey}`,
  }));
  lineChildren.push(el('div', { className: 'entry-actions', 'aria-label': `${entry.text} 操作` }, actionItems));
  if (sourceDomainLabel) lineChildren.push(el('span', { className: 'entry-source-domain', text: sourceDomainLabel, title: `来源：${sourceDomainLabel}` }));
  const primary = el('div', { className: 'entry-line' }, lineChildren);
  if (annotationRecord) {
    primary.addEventListener('click', (event) => {
      if (event.target.closest('button, .entry-text-viewport')) return;
      startAnnotationReview(collection.id, annotationRecord.sourceEntryId);
    });
    primary.setAttribute('aria-label', `处理 ${entry.text} 的待核查标注`);
  }
  const shell = el('div', { className: 'entry-primary-shell' }, [primary]);
  row.append(shell);
  const relationPanel = expanded ? renderRelationPanel(entry, relations) : null;
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
  if (memberships.some((item) => item.collectionId === collection.id)) {
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
  const section = sectionForEntry(entry);
  if (context.mode === 'alphabet') {
    const letter = letterForEntry(entry);
    setLetterSectionOpen(section, letter, true);
    updateActiveLetter(section, letter);
  }
  const chunk = entryChunkByEntryId.get(entryId);
  if (chunk) materializeEntryChunk(chunk);
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
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportBottom = viewportTop + viewportHeight;
  const topRects = [...document.querySelectorAll('.topbar, .update-banner, .home-annotation-banner, .letter-nav')]
    .filter((candidate) => candidate && !candidate.classList.contains('hidden'))
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => rect.height > 0 && rect.bottom > viewportTop && rect.top < viewportTop + 280)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  let top = viewportTop;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const rect of topRects) if (rect.bottom > top && rect.top <= top + 14) top = rect.bottom;
  }
  const bottomRects = [...document.querySelectorAll('.bottom-toolbar, .pin-bar, .review-bar')]
    .filter((candidate) => candidate && !candidate.classList.contains('hidden'))
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => rect.height > 0 && rect.bottom > viewportBottom - 140);
  let bottom = viewportBottom - 8;
  for (const rect of bottomRects) bottom = Math.min(bottom, rect.top - 8);
  return { top: Math.max(viewportTop, top + 6), bottom: Math.max(top + 80, bottom) };
}

function positionHeadingBelowChrome(target) {
  if (!target) return false;
  const rect = target.getBoundingClientRect();
  const bounds = readingViewportBounds();
  const targetY = Math.max(0, window.scrollY + rect.top - bounds.top);
  window.scrollTo({ top: targetY, behavior: 'auto' });
  requestAnimationFrame(() => {
    if (!target.isConnected) return;
    const nextRect = target.getBoundingClientRect();
    const nextBounds = readingViewportBounds();
    const correction = nextRect.top - nextBounds.top;
    if (Math.abs(correction) > 1) window.scrollBy({ top: correction, behavior: 'auto' });
  });
  return true;
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
  if (!targetCollectionId || !state.visibleEntryIdsByCollection.get(targetCollectionId)?.has(entryId)) {
    showToast('该位置已失效');
    return false;
  }
  const targetCollection = state.collectionById.get(targetCollectionId);
  const targetViewKind = viewKindForCollection(targetCollection, entry, entry.kind);
  if (targetCollectionId !== currentCollectionId || (targetCollection?.type === 'normal' && targetViewKind !== currentViewKind)) {
    navigateCollection(targetCollectionId, entryId, reason, targetViewKind);
    return true;
  }
  const token = ++navigationRevision;
  activeSection = sectionForEntry(entry);
  syncPinIndexForEntry(currentCollectionId, entryId);
  pendingJumpEntryId = '';
  pendingJumpReason = 'jump';
  if (location.hash.includes('entry=')) history.replaceState({ ...(history.state || {}), vix: true, depth: appNavigationDepth }, '', collectionRoute(currentCollectionId, '', getState().collectionById.get(currentCollectionId)?.type === 'normal' ? currentViewKind : ''));
  const collection = state.collectionById.get(currentCollectionId);
  if (collection) renderPinBar(collection);
  const row = ensureEntryRendered(entryId);
  if (!row) return false;
  suppressScrollPersistence(650);
  requestAnimationFrame(() => {
    if (token !== navigationRevision || currentCollectionId !== targetCollectionId || !row.isConnected) return;
    positionElementAtReadingAnchor(row);
    requestAnimationFrame(() => {
      if (token === navigationRevision && row.isConnected) {
        markJumpTarget(row, reason);
        if (reason === 'study-date') showToast('学习日期已刷新并移到今天');
      }
    });
  });
  return true;
}

function jumpPinned(collectionId, direction = 1) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const pins = getPinsForCollection(collectionId).filter((pin) => {
    const entry = state.entryById.get(pin.entryId);
    return collection?.type !== 'normal' || entry?.kind === currentViewKind;
  });
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
  const bounds = readingViewportBounds();
  const x = Math.min(Math.max(24, window.innerWidth * 0.22), window.innerWidth - 24);
  for (const offset of [6, 26, 52, 84, 116]) {
    const node = document.elementFromPoint(x, Math.min(bounds.bottom - 4, bounds.top + offset));
    const row = /** @type {HTMLElement | null} */ (node?.closest?.('.entry-row') || null);
    if (row?.dataset.entryId) {
      if (row.dataset.section) activeSection = row.dataset.section;
      return row.dataset.entryId;
    }
  }
  const renderedRows = /** @type {NodeListOf<HTMLElement>} */ (elements['entry-list'].querySelectorAll('.entry-row'));
  for (const row of Array.from(renderedRows)) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > bounds.top + 1 && rect.top < bounds.bottom - 1) {
      if (row.dataset.section) activeSection = row.dataset.section;
      return row.dataset.entryId || null;
    }
  }
  return null;
}

function persistScrollPosition() {
  if (persistentJumpEntryId && Date.now() >= suppressScrollPersistenceUntil) clearPersistentJump();
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = setTimeout(() => {
    scrollPersistenceTimer = 0;
    persistCurrentHistorySnapshot();
  }, 220);
}

function updateBackToTopVisibility() {
  const button = elements['back-to-top'];
  if (!button) return;
  const atTop = window.scrollY < 24;
  button.disabled = atTop;
  button.classList.toggle('at-top', atTop);
  button.setAttribute('aria-label', atTop ? '已在顶部' : '返回顶部');
}

function returnToTop() {
  if (!currentCollectionId) return;
  suppressScrollPersistence(500);
  navigationRevision += 1;
  window.scrollTo({ top: 0, behavior: 'auto' });
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
  const isNormal = collection.type === 'normal';
  const text = el('input', { required: true, maxlength: 160, placeholder: isPhrase ? '例如：thread pool' : isNormal ? '例如：thread 或 thread pool' : '例如：thread' });
  const gloss = el('input', { maxlength: 120, placeholder: '可输入简体或繁体' });
  const body = [field(isPhrase ? '短语' : isNormal ? '词汇或短语' : '词汇', text)];
  if (domain.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: isPhrase ? '新增短语' : isNormal ? '新增词汇或短语' : '新增词汇',
    body,
    onSubmit: async () => {
      const entry = await addEntry(collectionId, text.value, { gloss: gloss.value });
      requestAnimationFrame(() => jumpToEntry(entry.id, { collectionId, reason: 'new-entry' }));
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
  openDialog({ title: '添加短语', body, onSubmit: async () => { await addPhraseForWord(entryId, text.value, { gloss: gloss.value }, getState().collectionById.get(currentCollectionId)?.type === 'normal' ? currentCollectionId : ''); } });
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
  const entries = entriesForCollectionView(collectionId, currentViewKind);
  const annotationCount = annotationCountForCollection(collectionId, currentViewKind);
  if (collection.virtual) {
    openActionDialog({ title: collection.name, body: [
      el('div', { className: 'action-list' }, [
        button('导出 CSV', '', () => { exportCollectionCsv(collection.id); closeActionDialog(); }),
        annotationCount ? button(`待核查 ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id, '', currentViewKind); }) : null,
        button('应用设置与备份', '', () => openSettingsDialog()),
      ].filter(Boolean)),
    ] });
    return;
  }
  const actions = [
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: '新增' }),
      el('div', { className: 'action-list' }, [
        button(collection.type === 'system-phrases' ? '新增短语' : collection.type === 'normal' ? '新增词汇或短语' : '新增词汇', '', () => openAddEntryDialog(collection.id)),
        button('AI 新增', '', () => openAiAddDialog(collection.id)),
      ]),
    ]),
    el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: 'AI' }),
      el('div', { className: 'action-list' }, [
        button('AI 核查', '', () => openAiCheckDialog(collection.id), { disabled: Boolean(activeTask) || !entries.length }),
        annotationCount ? button(`待核查 ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id, '', currentViewKind); }) : null,
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
  if (annotationCountForCollection(collectionId, currentViewKind)) body.push(button('清空当前视图标注', 'secondary-button', async () => {
    await clearAnnotationsForEntries(entryIdsForCollectionView(collectionId, currentViewKind));
  }));
  body.push(button('删除词表', 'danger-button', () => confirmDeleteCollection(collectionId)));
  openDialog({ title: collection.name, body, onSubmit: async () => { await renameCollection(collectionId, name.value, label.value); } });
}

function exportCollectionCsv(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entries = entriesForCollectionView(collectionId, currentViewKind);
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
      if (mode.value === 'replace') {
        const entriesToImport = parsed.entries;
        closeDialog({ all: true });
        requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
          title: '确认替换当前词表',
          description: '确认后将以导入文件替换当前词表范围。',
          submitText: '确认替换',
          onSubmit: async () => {
            await importEntries(collectionId, entriesToImport, { mode: 'replace' });
            showToast(`已替换导入 ${entriesToImport.length} 项`);
          },
        }), { title: '替换前是否下载备份？' }));
        return;
      }
      await importEntries(collectionId, parsed.entries, { mode: mode.value });
      showToast(`已导入 ${parsed.entries.length} 项`);
    },
  });
}

function confirmDeleteCollection(collectionId) {
  const collection = getState().collectionById.get(collectionId);
  closeDialog({ all: true });
  requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
      title: '删除词表',
      description: `将删除“${collection.name}”的来源关系；仍有其他来源的词汇会自动回落。`,
      body: el('div', { className: 'warning-box', text: '确认后执行。该操作仍可通过撤销恢复。' }),
      submitText: '确认删除',
      onSubmit: async () => {
        await deleteCollection(collectionId);
        if (currentCollectionId === collectionId) { closeActionDialog(); goHome(); }
        else renderApp();
      },
    }), { title: '删除词表前是否下载备份？' }));
}

function confirmDeleteDomain(domainId) {
  const domain = getState().domainById.get(domainId);
  closeDialog({ all: true });
  requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
      title: '删除整个词域',
      description: `将删除“${domain.name}”及其中全部词表、内容、PIN、标注和学习日期。`,
      body: el('div', { className: 'warning-box', text: '这是大范围操作。确认后执行。' }),
      submitText: '确认删除词域',
      onSubmit: async () => { await deleteDomain(domainId); goHome(); },
    }), { title: '删除词域前是否下载备份？' }));
}

function confirmRemoveSource(entryId, collectionId) {
  const entry = getState().entryById.get(entryId);
  closeActionDialog();
  requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
      title: '从当前词表移除',
      description: `从当前词表移除 “${entry.text}”。`,
      body: el('p', { className: 'help-text', text: '若它仍属于其他词表，将自动显示在优先级最高的剩余词表；普通词失去全部来源后会被删除。' }),
      submitText: '移除',
      onSubmit: async () => { await removeEntryFromCollection(entryId, collectionId); },
    }), { title: '移除前是否下载备份？' }));
}

function confirmDeleteEntry(entryId) {
  const entry = getState().entryById.get(entryId);
  closeActionDialog();
  requestAnimationFrame(() => offerOptionalBackup(() => openConfirmDialog({
      title: '删除',
      description: `删除 “${entry.text}” 及其全部来源、PIN、标注、学习日期和短语索引。`,
      body: el('div', { className: 'warning-box', text: '确认后执行。该操作仍可通过撤销恢复。' }),
      submitText: '彻底删除',
      onSubmit: async () => { await deleteEntry(entryId); },
    }), { title: '删除内容前是否下载备份？' }));
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
  const viewKind = collection?.type === 'normal' ? currentViewKind : viewKindForCollection(collection);
  const entries = entriesForCollectionView(collectionId, viewKind).map((entry) => ({ ...entry, sourceLabel: sourceLabelForCollection(entry.id, collectionId) }));
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
      setTimeout(() => startAiCheck(collectionId, viewKind), 0);
    },
  });
}

async function startAiCheck(collectionId, requestedViewKind = currentViewKind) {
  if (activeTask) return;
  const collection = getState().collectionById.get(collectionId);
  const viewKind = collection?.type === 'normal' ? requestedViewKind : viewKindForCollection(collection);
  const entries = entriesForCollectionView(collectionId, viewKind).map((entry) => ({ ...entry, sourceLabel: sourceLabelForCollection(entry.id, collectionId) }));
  if (!entries.length) return;
  const controller = new AiCheckController();
  const entryIds = entries.map((entry) => entry.id);
  let resolveCompletion;
  const task = {
    controller, paused: false, completed: 0, total: 1, collectionId, viewKind,
    status: '准备 AI 核查…', entryIds,
    aiChanges: new Map(), manualAnnotationEntryIds: new Set(), cancelledForDataChange: false,
    completion: new Promise((resolve) => { resolveCompletion = resolve; }),
  };
  activeTask = task;
  taskPanelExpanded = true;
  renderTaskPanel('准备 AI 核查…');
  try {
    const result = await checkEntries(entries, {
      controller,
      onProgress: (progress) => {
        if (activeTask !== task) return;
        task.completed = progress.completed;
        task.total = progress.total;
        renderTaskPanel(`批次 ${Math.min(progress.completed + 1, progress.total)} / ${progress.total}`);
      },
      onBatch: async (issues, batch) => {
        if (activeTask !== task || controller.cancelled) return;
        const eligibleBatch = batch.filter((entry) => !task.manualAnnotationEntryIds.has(entry.id));
        if (!eligibleBatch.length) return;
        const eligibleIds = new Set(eligibleBatch.map((entry) => entry.id));
        const before = new Map(eligibleBatch.map((entry) => [entry.id, structuredClone(getState().annotationByEntry.get(entry.id) || null)]));
        const expectedRevision = getState().revision;
        await replaceAnnotations(eligibleBatch.map((entry) => entry.id), issues.filter((item) => eligibleIds.has(item.entryId)), {
          expectedEntries: eligibleBatch.map((entry) => ({ id: entry.id, updatedAt: entry.updatedAt, normalizedText: entry.normalizedText })),
          expectedRevision,
        });
        for (const entry of eligibleBatch) {
          const left = before.get(entry.id) || null;
          const right = structuredClone(getState().annotationByEntry.get(entry.id) || null);
          if (JSON.stringify(left) === JSON.stringify(right)) continue;
          const existing = task.aiChanges.get(entry.id);
          task.aiChanges.set(entry.id, { entryId: entry.id, before: existing?.before ?? left, after: right });
        }
      },
    });
    await recordAiAnnotationChanges([...task.aiChanges.values()], `AI 核查：${getState().collectionById.get(collectionId)?.name || collectionId} · ${viewKind === 'phrase' ? '短语' : '词汇'}`);
    if (activeTask === task && !task.cancelledForDataChange) showToast(result.cancelled ? '核查已取消；已完成批次可整体撤销' : 'AI 核查完成');
  } catch (error) {
    try { await recordAiAnnotationChanges([...task.aiChanges.values()], `AI 核查：${getState().collectionById.get(collectionId)?.name || collectionId} · ${viewKind === 'phrase' ? '短语' : '词汇'}`); } catch {}
    if (activeTask === task && error?.name !== 'AbortError') displayError(error);
  }
  finally {
    if (activeTask === task) activeTask = null;
    renderTaskPanel('');
    resolveCompletion?.();
  }
}

async function cancelActiveTaskForDataChange() {
  if (!activeTask) return;
  const task = activeTask;
  task.cancelledForDataChange = true;
  task.controller.cancel();
  task.status = '正在停止 AI 核查…';
  renderTaskPanel(task.status);
  await task.completion;
  showToast('数据即将变更，AI 核查已取消');
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

function annotationReviewIds(collectionId = '', viewKind = '') {
  const state = getState();
  const annotated = new Set(state.annotations.map((item) => item.entryId));
  if (collectionId) return entriesForCollectionView(collectionId, viewKind).filter((entry) => annotated.has(entry.id)).map((entry) => entry.id);
  const domainOrder = new Map(state.domains.map((domain, index) => [domain.id, index]));
  return [...state.annotations]
    .map((item) => state.entryById.get(item.entryId))
    .filter(Boolean)
    .sort((a, b) => (domainOrder.get(a.domainId) ?? Number.MAX_SAFE_INTEGER) - (domainOrder.get(b.domainId) ?? Number.MAX_SAFE_INTEGER)
      || a.normalizedText.localeCompare(b.normalizedText, 'en') || a.id.localeCompare(b.id))
    .map((entry) => entry.id);
}

function startAnnotationReview(collectionId = '', startEntryId = '', requestedViewKind = currentViewKind) {
  const state = getState();
  const collection = collectionId ? state.collectionById.get(collectionId) : null;
  const viewKind = collection?.type === 'normal' ? requestedViewKind : (collection ? viewKindForCollection(collection) : '');
  const ids = annotationReviewIds(collectionId, viewKind);
  if (!ids.length) { showToast(collectionId ? '当前词表没有待核查标注' : '没有待核查标注'); return; }
  const requestedIndex = startEntryId ? ids.indexOf(startEntryId) : 0;
  review = { ids, index: requestedIndex >= 0 ? requestedIndex : 0, collectionId, viewKind };
  renderReviewBar();
  const displayId = reviewDisplayEntryId(review.ids[review.index], collectionId) || review.ids[review.index];
  jumpToEntry(displayId, { collectionId: collectionId || projectionCollectionForEntry(displayId), reason: 'annotation' });
}

function syncReview() {
  const currentId = review.ids[review.index] || '';
  const ids = annotationReviewIds(review.collectionId, review.viewKind);
  if (!ids.length) { closeReview(); return false; }
  const currentIndex = currentId ? ids.indexOf(currentId) : -1;
  review.index = currentIndex >= 0 ? currentIndex : Math.min(review.index, ids.length - 1);
  review.ids = ids;
  return true;
}

async function clearCurrentReviewAnnotations() {
  const collectionId = review.collectionId || currentCollectionId;
  if (!collectionId) return;
  await cancelActiveTaskForDataChange();
  await clearAnnotationsForEntries(entryIdsForCollectionView(collectionId, review.viewKind || currentViewKind));
  review = { ids: [], index: 0, collectionId: '', viewKind: '' };
  renderReviewBar();
  showToast('当前词表标注已全部撤销');
}

function renderReviewBar() {
  if (!review.ids.length) {
    elements['annotation-review-bar'].classList.add('hidden');
    elements.app.classList.remove('has-review');
    if (currentCollectionId) {
      const collection = getState().collectionById.get(currentCollectionId);
      if (collection) renderPinBar(collection);
    }
    updateOverlayLayout();
    return;
  }
  const state = getState();
  const entryId = review.ids[review.index];
  const entry = state.entryById.get(entryId);
  const annotation = state.annotationByEntry.get(entryId);
  if (!entry || !annotation) { if (syncReview()) renderReviewBar(); return; }
  const displayEntryId = reviewDisplayEntryId(entryId, review.collectionId) || entryId;
  const targetCollectionId = review.collectionId || projectionCollectionForEntry(entryId);
  const reviewDomainLabel = isGlobalCollection(targetCollectionId)
    && state.globalConflictKeys.has(`${entry.kind}\u0000${entry.normalizedText}`)
    ? (state.domainById.get(entry.domainId)?.name || entry.domainId)
    : '';
  if (targetCollectionId && targetCollectionId !== currentCollectionId) {
    navigateCollection(targetCollectionId, displayEntryId);
    return;
  }
  elements['pin-bar'].classList.add('hidden');
  elements.app.classList.remove('has-pin');
  elements['annotation-review-bar'].classList.remove('hidden');
  elements.app.classList.add('has-review');
  const previous = iconButton('chevron', 'review-nav review-prev', '上一个标注', () => navigateReview(-1));
  const next = iconButton('chevron', 'review-nav review-next', '下一个标注', () => navigateReview(1));
  const editCollectionId = review.collectionId && !isGlobalCollection(review.collectionId) ? review.collectionId : projectionCollectionForEntry(entryId);
  const edit = button('编辑', 'review-edit', () => openEditEntryDialog(entryId, editCollectionId));
  const dismiss = button('撤销此条', 'review-dismiss', () => dismissCurrentReviewAnnotation());
  const clearCurrent = iconButton('clear', 'review-clear-all', '撤销当前词表全部标注', () => clearCurrentReviewAnnotations().catch(displayError));
  const close = iconButton('close', 'review-close', '退出审阅', closeReview);
  elements['annotation-review-bar'].replaceChildren(
    previous,
    el('div', { className: 'review-text' }, [
      el('strong', { text: `${review.index + 1}/${review.ids.length} · ${entry.text}${reviewDomainLabel ? ` · ${reviewDomainLabel}` : ''}` }),
      el('span', { text: `${annotation.spelling.suggestion ? `建议 ${annotation.spelling.suggestion}` : '需检查'}${annotation.reason ? ` · ${annotation.reason}` : ''}` }),
    ]),
    next,
    el('div', { className: 'review-actions' }, [edit, dismiss, clearCurrent, close]),
  );
  updateOverlayLayout();
}

function navigateReview(direction) {
  if (!review.ids.length) return;
  review.index = (review.index + direction + review.ids.length) % review.ids.length;
  const entryId = review.ids[review.index];
  const displayEntryId = reviewDisplayEntryId(entryId, review.collectionId) || entryId;
  const targetCollectionId = review.collectionId || projectionCollectionForEntry(entryId);
  if (targetCollectionId !== currentCollectionId) navigateCollection(targetCollectionId, displayEntryId);
  else { renderReviewBar(); jumpToEntry(displayEntryId, { collectionId: targetCollectionId, reason: 'annotation' }); }
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
      const nextId = review.ids[review.index];
      const displayId = reviewDisplayEntryId(nextId, review.collectionId) || nextId;
      jumpToEntry(displayId, { collectionId: review.collectionId || projectionCollectionForEntry(nextId), reason: 'annotation' });
    }
  } catch (error) { displayError(error); }
}

function closeReview() {
  review = { ids: [], index: 0, collectionId: '', viewKind: '' };
  elements['annotation-review-bar'].classList.add('hidden');
  elements.app.classList.remove('has-review');
  if (currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    if (collection) renderPinBar(collection);
  }
  updateOverlayLayout();
}


function openSearchDialog() {
  const state = getState();
  const input = el('input', { type: 'search', placeholder: '搜索', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select');
  scope.append(el('option', { value: 'all', text: '全部' }));
  scope.append(el('option', { value: `collection:${SYSTEM_GLOBAL_WORDS_ID}`, text: '全局词汇总表' }));
  scope.append(el('option', { value: `collection:${SYSTEM_GLOBAL_PHRASES_ID}`, text: '全局短语总表' }));
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    scope.append(el('option', { value: `domain:${domain.id}`, text: domain.name }));
    const group = el('optgroup', { label: domain.name });
    group.append(el('option', { value: `collection:${systemDomainWordsCollectionId(domain.id)}`, text: '词汇总表' }));
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
      const collectionId = value.slice('collection:'.length);
      const targetCollection = state.collectionById.get(collectionId);
      allowedIds = new Set((targetCollection?.type === 'normal' && collectionId === currentCollectionId
        ? entriesForCollectionView(collectionId, currentViewKind)
        : getVisibleEntries(collectionId)).map((entry) => entry.id));
    } else allowedIds = new Set();
    return allowedIds;
  };
  const selectResult = (entry, collectionId) => {
    closeSearchDialog();
    requestAnimationFrame(() => requestAnimationFrame(() => navigateCollection(collectionId, entry.id, 'search')));
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
    const found = search(query, { limit: 80, entryIds: allowed });
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
        for (const entry of search(term, { limit: 80, entryIds: allowed })) {
          if (seen.has(entry.id)) continue;
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
    el('option', { value: 'group', text: '小标题内编号', selected: state.settings.numberMode === 'group' }),
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

function showMigrationNotice() {
  const state = getState();
  if (!state.settings.migrationNoticePending) return;
  const studyIssues = Array.isArray(state.settings.studyStampMigrationIssues) ? state.settings.studyStampMigrationIssues : [];
  const body = [
    el('div', { className: 'warning-box', text: '建议立即导出一份当前版本完整 JSON，并保留升级前备份直到真机验收完成。' }),
    el('p', { className: 'help-text', text: '系统总表现为具体内容的投影视图；跨域同形内容分别显示。学习日期已升级为具体内容状态。' }),
  ];
  if (studyIssues.length) body.push(el('details', { className: 'migration-issues' }, [
    el('summary', { text: `${studyIssues.length} 条旧全局学习日期存在跨域候选，已按旧域顺序迁移` }),
    el('ul', {}, studyIssues.slice(0, 50).map((item) => el('li', { text: `${item.sourceKey} → ${item.chosenEntryId}` }))),
    studyIssues.length > 50 ? el('p', { className: 'help-text', text: `另有 ${studyIssues.length - 50} 条，请在完整备份 settings.studyStampMigrationIssues 中查看。` }) : null,
  ]));
  openDialog({
    title: '数据模型升级完成',
    description: `已从 ${state.settings.migrationSource || '旧版本'} 迁移到 Schema 5。`,
    body,
    submitText: '我已了解',
    onSubmit: acknowledgeMigrationNotice,
  });
}

export function notifyServiceWorkerUpdate(worker) {
  waitingServiceWorker = worker || null;
  elements['update-banner']?.classList.toggle('hidden', !waitingServiceWorker);
  updateOverlayLayout();
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
  updateOverlayLayout();
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
    closeConfirmDialog({ force: true });
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
  const token = ++renderRevision;
  const route = parseRoute();
  const previousCollectionId = currentCollectionId;
  if (!route.collectionId && previousCollectionId) restoreHomeScrollPending = true;
  currentCollectionId = route.collectionId;
  if (route.viewKind) currentViewKind = route.viewKind;
  if (route.entryId) {
    pendingJumpEntryId = route.entryId;
    if (!['search', 'relation', 'annotation', 'last', 'mode', 'pin'].includes(pendingJumpReason)) pendingJumpReason = 'route';
  } else if (route.collectionId !== previousCollectionId && !pendingPageSnapshot) {
    pendingJumpEntryId = '';
    if (pendingJumpReason !== 'home') pendingJumpReason = 'jump';
  }
  closeQueryMenu();
  closeRelationTargetMenu();
  if (currentCollectionId) renderCollection(token); else renderHome(token);
  if (review.ids.length) { syncReview(); renderReviewBar(); }
  requestAnimationFrame(() => {
    if (token !== renderRevision) return;
    updateLargeTitleState();
    syncActiveAlphabetHeading();
    updateOverlayLayout();
  });
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
  } catch (error) { displayError(error); }
  finally { if (submit?.isConnected) { submit.disabled = false; submit.textContent = submit.dataset.oldText || '保存'; } }
}

function scheduleRouteRender() {
  if (routeRenderFrame) return;
  routeRenderFrame = requestAnimationFrame(() => {
    routeRenderFrame = 0;
    renderApp();
  });
}

function refreshVisibleEntryRows(entryIds = []) {
  if (!currentCollectionId || !collectionRenderContext) return;
  const changed = new Set(entryIds);
  const state = getState();
  for (const row of elements['entry-list'].querySelectorAll('.entry-row[data-entry-id]')) {
    const entry = state.entryById.get(row.dataset.entryId);
    if (!entry) continue;
    const affected = changed.has(entry.id);
    if (affected) row.replaceWith(renderEntryRow(entry, collectionRenderContext.collection, collectionRenderContext.domain, indexesForRenderedEntry(collectionRenderContext, entry)));
  }
}

function handleStoreEvent({ type, detail }) {
  if (type === 'calendar-month') return;
  if (type === 'mutation' && detail?.kind === 'pin') return;
  if (type === 'mutation' && detail?.kind === 'study-date' && currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    if (collection && getViewMode(collection.id, currentViewKind) === 'alphabet') return;
  }
  if (type === 'annotation-change') {
    if (activeTask && detail?.kind !== 'batch') {
      for (const entryId of detail?.entryIds || []) activeTask.manualAnnotationEntryIds?.add(entryId);
    }
    refreshVisibleEntryRows(detail?.entryIds || []);
    if (currentCollectionId) {
      const collection = getState().collectionById.get(currentCollectionId);
      if (collection) renderCollectionToolbar(collection);
    } else renderHomeAnnotationBanner();
    if (review.ids.length) {
      syncReview();
      renderReviewBar();
    }
    return;
  }
  renderApp();
}

function handleWindowScroll() {
  if (activeQueryMenu) closeQueryMenu();
  if (activeRelationTargetMenu) closeRelationTargetMenu();
  if (!scrollUiFrame) {
    scrollUiFrame = requestAnimationFrame(() => {
      scrollUiFrame = 0;
      updateLargeTitleState();
      syncActiveAlphabetHeading();
      updateBackToTopVisibility();
    });
  }
  if (!('onscrollend' in window)) persistScrollPosition();
}

export async function initializeUI() {
  elements['back-button']?.replaceChildren(svgIcon('back'));
  elements['search-button']?.replaceChildren(svgIcon('search'));
  elements['back-to-top']?.replaceChildren(svgIcon('top'));
  elements['dialog-close']?.replaceChildren(svgIcon('close'));
  elements['action-close']?.replaceChildren(svgIcon('close'));
  elements['search-close']?.replaceChildren(svgIcon('close'));
  elements['update-later-button']?.replaceChildren(svgIcon('close'));
  elements['dialog-form'].addEventListener('submit', handleDialogSubmit);
  elements['confirm-form'].addEventListener('submit', handleConfirmSubmit);
  elements['dialog-close'].addEventListener('click', closeDialog);
  elements['action-close'].addEventListener('click', closeActionDialog);
  elements['search-close'].addEventListener('click', closeSearchDialog);
  elements['confirm-cancel'].addEventListener('click', handleConfirmCancel);
  elements['app-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['app-dialog'], closeDialog));
  elements['action-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['action-dialog'], closeActionDialog));
  elements['search-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['search-dialog'], closeSearchDialog));
  elements['confirm-dialog'].addEventListener('click', (event) => closeDialogFromBackdrop(event, elements['confirm-dialog'], closeConfirmDialog));
  elements['app-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });
  elements['action-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeActionDialog(); });
  elements['search-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeSearchDialog(); });
  elements['confirm-dialog'].addEventListener('cancel', (event) => { event.preventDefault(); closeConfirmDialog(); });
  elements['back-button'].addEventListener('click', navigateBack);
  elements['clear-all-annotations']?.addEventListener('click', () => clearAllAnnotationsFromHome().catch(displayError));
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
  window.addEventListener('hashchange', () => { if (!history.state?.vix) scheduleRouteRender(); });
  window.addEventListener('popstate', handleHistoryNavigation);
  window.visualViewport?.addEventListener('resize', updateVisualViewportVars);
  window.visualViewport?.addEventListener('scroll', updateVisualViewportVars, { passive: true });
  window.addEventListener('resize', updateVisualViewportVars, { passive: true });
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (activeQueryMenu && !elements['query-menu'].contains(event.target) && !activeQueryMenu.source?.contains(event.target)) closeQueryMenu();
    if (activeRelationTargetMenu && !elements['relation-target-menu'].contains(event.target) && !activeRelationTargetMenu.source?.contains(event.target)) closeRelationTargetMenu();
  }, { capture: true });
  elements['query-menu']?.addEventListener('keydown', (event) => {
    const options = [...elements['query-menu'].querySelectorAll('[role="menuitem"]')];
    if (!options.length) return;
    const index = Math.max(0, options.indexOf(document.activeElement));
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      options[(index - 1 + options.length) % options.length].focus();
    } else if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      options[(index + 1) % options.length].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeQueryMenu({ restoreFocus: true });
    }
  });
  elements['relation-target-menu']?.addEventListener('keydown', (event) => {
    const options = [...elements['relation-target-menu'].querySelectorAll('[role="menuitem"]')];
    if (!options.length) return;
    const index = Math.max(0, options.indexOf(document.activeElement));
    if (['ArrowUp', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      options[(index - 1 + options.length) % options.length].focus();
    } else if (['ArrowDown', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      options[(index + 1) % options.length].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeRelationTargetMenu({ restoreFocus: true });
    }
  });
  const preventGestureZoom = (event) => {
    if (document.documentElement.classList.contains('standalone-pwa')) event.preventDefault();
  };
  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  document.addEventListener('touchstart', handleModalTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', handleModalTouchMove, { passive: false, capture: true });
  if ('onscrollend' in window) window.addEventListener('scrollend', persistScrollPosition, { passive: true });
  subscribe(handleStoreEvent);
  await initializeStore();
  const initialDepth = Number(history.state?.depth || 0);
  appNavigationDepth = Number.isFinite(initialDepth) ? initialDepth : 0;
  history.replaceState({ ...(history.state || {}), vix: true, depth: appNavigationDepth, pageSnapshot: history.state?.pageSnapshot || null }, '', location.href);
  updateVisualViewportVars();
  elements['boot-screen'].classList.add('hidden');
  elements.app.classList.remove('hidden');
  renderApp();
  setTimeout(showMigrationNotice, 60);
}
