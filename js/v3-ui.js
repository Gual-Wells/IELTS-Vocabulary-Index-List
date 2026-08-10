import {
  acknowledgeMigrationNotice, addCollection, addDomain, addEntry, addPhraseForWord,
  clearAllAnnotations, clearAnnotationsForEntries, deleteCollection, deleteDomain, deleteEntry, dismissAnnotation,
  editEntry, editEntryInCollection, exportFullBackup, getLastPosition, getRelationComponents, getRelatedEntries, getState,
  getPinsForCollection, getVisibleEntries, getViewMode, getCalendarMonth, getStudyStamp, hydrateRuntimeViewState, persistRuntimeViewState, importEntries, initializeStore, moveCollection, redo,
  removeEntryFromCollection, renameCollection, renameDomain, reorderCollections, reorderDomains, recordAiAnnotationChanges, replaceAnnotations, resetToSeed, restoreBackup,
  refreshStudyDate, search, setCalendarMonth, setDomainGlossEnabled, setDomainRelationExcluded, setLastPosition, setLowLevelRelationsClosed, setNumberMode, setViewMode, subscribe, togglePin, undo,
} from './v3-store.js';
import {
  AiCheckController, checkEntries, createAiCheckBatches, getApiKey, getModelCatalog,
  getSelectedModel, queryVocabularyEntry, refreshModels, selectModel, setApiKey, suggestEntries, suggestSearchTerms,
} from './v3-ai.js';
import {
  downloadText, entriesToCsv, readImportFile,
} from './v3-import.js';
import { normalizeEnglish, positionScopeDomainId, systemPhraseCollectionId, systemDomainContentCollectionId, systemDomainWordsCollectionId, SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID } from './v3-model.js';
import { NEW_COLLECTION_TARGET, NEW_DOMAIN_TARGET, createVixPackage } from './v3-exchange.js';
import { buildChatGPTPrompt, buildChatGPTShortcutUrl, buildCollinsExternalUrl, buildOxfordLookupUrl, createEntryContext, getCollinsApiKey, queryCollins, setCollinsApiKey } from './v3-integrations.js';
import { computeStickyCollapseTarget } from './v3-runtime-geometry.js';
import { clampRootScrollTarget, createScrollCoordinator, geometryIsStable, semanticAnchorError } from './v3-scroll-runtime.js';
import { ALPHABET_KEYS, MOTION_EASE, alphabetOrdinal, cameraTargetForActiveCell, createSemanticAxis, exponentialApproach, physicalAtSemantic, physicalScrollDuration, semanticAtPhysical, semanticScrollDuration } from './v3-motion-runtime.js';

const APP_VERSION = '4.7.1';
/** @type {Record<string, any>} */
const elements = Object.fromEntries([
  'boot-screen', 'app', 'back-button', 'home-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'main-content', 'large-title', 'large-title-eyebrow', 'large-title-heading', 'large-title-subtitle',
  'home-annotation-banner', 'home-annotation-icon', 'home-annotation-text', 'clear-all-annotations', 'query-menu', 'relation-target-menu',
  'home-view', 'collection-view', 'collection-toolbar', 'pin-bar', 'annotation-review-bar', 'letter-nav', 'entry-list',
  'bottom-toolbar', 'bottom-last-position', 'back-to-top', 'bottom-mode', 'bottom-view-switch', 'bottom-search', 'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',
  'app-dialog',
  'hidden-file-input',
].map((id) => [id, document.getElementById(id)]));

let currentCollectionId = '';
let currentViewKind = 'word';
let homeGlobalMode = 'structured';
let activeProviderQuery = null;
let providerQuerySequence = 0;
const expandedLettersByCollection = new Map();
const letterTrackStates = new WeakMap();
let pendingJumpEntryId = '';
let pendingJumpReason = 'jump';
let persistentJumpEntryId = '';
let pinIndex = 0;
let pinCollectionId = '';
let activeTask = null;
let review = { ids: [], index: 0, collectionId: '', viewKind: '' };
let activeSearchFrame = null;
let activeConfirmFrame = null;
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
const dockHideTimers = new WeakMap();
const popoverHideTimers = new WeakMap();
let alphabetSectionMetrics = [];
let alphabetMetricsRevision = 0;
let alphabetResizeObserver = null;
let cachedChromeBottom = 0;
let openModalCount = 0;
let modalTouchY = 0;
let appNavigationDepth = 0;
const NAVIGATION_MODEL = 'single-slot-vix-v1';
const navigationStack = [];
let navigationRuntimeId = '';
let navigationRootToken = '';
let navigationTraversalInProgress = false;
let pendingPageSnapshot = null;
let suppressPostRenderSnapshotRestore = false;
let presentationMutationInProgress = 0;
let activePageTransition = null;
let bufferedStateCommitInProgress = false;
let renderRevision = 0;
let homeScrollY = 0;
let restoreHomeScrollPending = false;
let activeQueryMenu = null;
let activeRelationTargetMenu = null;
let scrollUiFrame = 0;
let browseAnchorPress = null;
let browseAnchorSuppressClickUntil = 0;
let longpressGuardUntil = 0;
let longpressGuardTimer = 0;
let routeRenderFrame = 0;
let entryChunkObserver = null;
let entryChunkResizeObserver = null;
const entryChunkData = new WeakMap();
const entryChunkByEntryId = new Map();
const iconTemplateCache = new Map();
const ENTRY_CHUNK_SIZE = 42;
const ENTRY_ROW_ESTIMATE = 56;
const scrollCoordinator = createScrollCoordinator();
const scrollTrace = [];
const SCROLL_TRACE_LIMIT = 180;
const SCROLL_TRACE_ENABLED = new URLSearchParams(location.search).has('vix-scroll-debug');
let rootUserScrollActive = false;
let rootUserTouchReleased = true;
let rootUserTouchMoved = false;
let rootUserScrollReleaseTimer = 0;
let pendingVirtualAnchor = null;
let virtualMaterializeFrame = 0;
const queuedVirtualChunks = new Set();

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

function appendScrollTrace(event, detail = {}) {
  if (!SCROLL_TRACE_ENABLED) return;
  scrollTrace.push({ t: performance.now(), event, ...detail });
  if (scrollTrace.length > SCROLL_TRACE_LIMIT) scrollTrace.splice(0, scrollTrace.length - SCROLL_TRACE_LIMIT);
}

function rootScrollMetrics() {
  const root = document.scrollingElement || document.documentElement;
  return {
    root,
    scrollHeight: Number(root?.scrollHeight || 0),
    clientHeight: Number(root?.clientHeight || window.innerHeight || 0),
    maxScroll: Math.max(0, Number(root?.scrollHeight || 0) - Number(root?.clientHeight || window.innerHeight || 0)),
  };
}

function beginRootScrollTransaction(owner, target = null) {
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = 0;
  const transaction = scrollCoordinator.begin(owner, target);
  appendScrollTrace('begin', { epoch: transaction.epoch, owner: transaction.owner, target: transaction.target, scrollY: window.scrollY });
  return transaction;
}

function rootScrollToY(top, { epoch = 0, behavior = 'auto', source = 'coordinator' } = {}) {
  if (epoch && !scrollCoordinator.owns(epoch)) {
    appendScrollTrace('stale-write-rejected', { epoch, source, scrollY: window.scrollY });
    return false;
  }
  const metrics = rootScrollMetrics();
  const targetY = clampRootScrollTarget(top, metrics.scrollHeight, metrics.clientHeight);
  const before = window.scrollY;
  window.scrollTo({ top: targetY, behavior: /** @type {ScrollBehavior} */ (behavior) });
  appendScrollTrace('scroll-to', { epoch: epoch || scrollCoordinator.current()?.epoch || 0, source, before, targetY });
  return true;
}

function rootScrollByY(delta, { epoch = 0, behavior = 'auto', source = 'coordinator' } = {}) {
  if (epoch && !scrollCoordinator.owns(epoch)) {
    appendScrollTrace('stale-write-rejected', { epoch, source, scrollY: window.scrollY });
    return false;
  }
  const before = window.scrollY;
  const metrics = rootScrollMetrics();
  const targetY = clampRootScrollTarget(before + Number(delta || 0), metrics.scrollHeight, metrics.clientHeight);
  window.scrollTo({ top: targetY, behavior: /** @type {ScrollBehavior} */ (behavior) });
  appendScrollTrace('scroll-by', { epoch: epoch || scrollCoordinator.current()?.epoch || 0, source, before, delta, targetY });
  return true;
}

function finalizeRootScrollPresentation() {
  updateOverlayLayout({ immediate: true });
  if (currentCollectionId && collectionRenderContext?.mode === 'alphabet') refreshAlphabetSectionMetrics();
  updateLargeTitleState();
  updateBackToTopVisibility();
}

function finishRootScrollTransaction(epoch, { persist = true } = {}) {
  if (!scrollCoordinator.owns(epoch)) return false;
  const state = scrollCoordinator.current();
  scrollCoordinator.finish(epoch);
  appendScrollTrace('finish', { epoch, owner: state?.owner || '', scrollY: window.scrollY });
  // While a programmatic transaction is active, observer-driven active-letter
  // inference is suppressed. Commit the final Chrome/Sticky/Letter state once
  // the semantic position is stable, before persisting that state.
  finalizeRootScrollPresentation();
  if (persist) persistCurrentHistorySnapshot();
  return true;
}

function cancelRootScrollTransaction(reason = 'user-input') {
  const cancelled = scrollCoordinator.cancel(reason);
  if (cancelled) appendScrollTrace('cancel', { epoch: cancelled.epoch, owner: cancelled.owner, reason, scrollY: window.scrollY });
  return cancelled;
}

function nextPresentationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

const ICONS = {
  back: '<path d="M14.8 5.4 8.2 12l6.6 6.6"></path>',
  home: '<path d="m4.8 11.1 7.2-6.2 7.2 6.2"></path><path d="M6.7 10.2v8.7h10.6v-8.7M10 18.9v-5.2h4v5.2"></path>',
  search: '<circle cx="10.7" cy="10.7" r="6.2"></circle><path d="m15.4 15.4 4.4 4.4"></path>',
  target: '<circle cx="12" cy="12" r="6.4"></circle><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"></circle><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4"></path>',
  relation: '<path d="M8 7.2h8M8.2 16.8h7.6"></path><circle cx="6" cy="7.2" r="2"></circle><circle cx="18" cy="7.2" r="2"></circle><circle cx="6" cy="16.8" r="2"></circle><circle cx="18" cy="16.8" r="2"></circle>',
  disclosure: '<path d="M8.9 6.35c0-.72.78-1.15 1.39-.77l6.95 4.34c1.25.78 1.25 2.6 0 3.38l-6.95 4.34c-.61.38-1.39-.05-1.39-.77V6.35Z"></path><path d="m11.35 9.25 4.2 2.75-4.2 2.75"></path>',
  jump: '<circle cx="8.2" cy="12" r="3.3"></circle><circle cx="8.2" cy="12" r=".85" fill="currentColor" stroke="none"></circle><path d="M11.7 12h7.1M16 9.25 18.8 12 16 14.75"></path>',
  pin: '<path d="M9.1 3.8h5.8l-.75 4.4 2.8 2.75v1.75h-3.65v6.25L12 21l-1.3-2.05V12.7H7.05v-1.75l2.8-2.75-.75-4.4Z"></path>',
  more: '<circle cx="5.2" cy="12" r="1.35" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"></circle><circle cx="18.8" cy="12" r="1.35" fill="currentColor" stroke="none"></circle>',
  chevron: '<path d="m8.4 9.3 3.6 3.6 3.6-3.6"></path>',
  chevrons: '<path d="m6.3 9.3 3.6 3.6 3.6-3.6"></path><path d="m11.4 9.3 3.6 3.6 3.6-3.6"></path>',
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
  nonstruct: '<path d="M4.2 6.1h6.3v11.8H4.2zM13.5 6.1h6.3v11.8h-6.3z"></path><path d="M10.5 12h3M12 10.5v3"></path>',
  collins: '<path d="M5 4.8h14v14.4H5z"></path><path d="M8 8.2h8M8 12h6M8 15.8h7"></path>',
  groq: '<path d="M7.2 5.3h9.6M5.2 8.8h13.6v8.6H5.2z"></path><path d="M8.2 12h7.6M8.2 14.8h4.5"></path>',
  multi: '<circle cx="5.2" cy="12" r="2.2"></circle><path d="M7.5 12h3.2c2.2 0 2.2-5 4.5-5h3.5M15.9 4.4 18.7 7l-2.8 2.6M10.7 12c2.2 0 2.2 5 4.5 5h3.5M15.9 14.4l2.8 2.6-2.8 2.6"></path>',
  globalDown: '<path d="M5 5h14M7.2 8.6h9.6"></path><path d="M12 9v7.1M9.3 13.5 12 16.2l2.7-2.7"></path><rect x="6.2" y="18" width="11.6" height="2.6" rx="1.3"></rect>',
  dictionary: '<path d="M6 5.2h11.2c.9 0 1.6.7 1.6 1.6v10.4H7.6c-.9 0-1.6-.7-1.6-1.6V5.2Z"></path><path d="M8.7 9h6.8M6 16.4h12.8M7.6 19h11.2"></path>',
  switchParallel: '<path d="M5 8h12.2M14.4 5.2 17.2 8l-2.8 2.8"></path><path d="M19 16H6.8M9.6 13.2 6.8 16l2.8 2.8"></path>',
  aiChat: '<path d="M5.2 5.3h13.6v10.6H11l-4.1 2.8v-2.8H5.2z"></path><path d="M8.2 9.1h7.6M8.2 12.1h5.1"></path>',
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
let overlayLayoutFrame = 0;
let collapseTransactionRevision = 0;
let historyRestoreInProgress = false;
function visualViewportMetrics() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const width = viewport?.width || window.innerWidth;
  const top = viewport?.offsetTop || 0;
  const left = viewport?.offsetLeft || 0;
  return {
    height, width, top, left,
    bottom: Math.max(0, window.innerHeight - top - height),
  };
}

function applyVisualViewportVars() {
  const { height, width, top, left, bottom } = visualViewportMetrics();
  document.documentElement.style.setProperty('--visual-height', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--visual-width', `${Math.round(width)}px`);
  document.documentElement.style.setProperty('--visual-top', `${Math.round(top)}px`);
  document.documentElement.style.setProperty('--visual-left', `${Math.round(left)}px`);
  document.documentElement.style.setProperty('--visual-bottom', `${Math.round(bottom)}px`);
  document.documentElement.style.setProperty('--visual-center-x', `${Math.round(left + width / 2)}px`);
  document.documentElement.style.setProperty('--visual-center-y', `${Math.round(top + height / 2)}px`);
  const keyboardVisible = height < window.innerHeight - 120;
  document.documentElement.classList.toggle('keyboard-visible', keyboardVisible);
  activeSearchFrame?.layer?.classList.toggle('keyboard-visible', keyboardVisible);
}

function updateModalViewportGeometry({ immediate = false } = {}) {
  cancelAnimationFrame(viewportUpdateFrame);
  const apply = () => {
    viewportUpdateFrame = 0;
    applyVisualViewportVars();
  };
  if (immediate) apply();
  else viewportUpdateFrame = requestAnimationFrame(apply);
}

function updatePageViewportGeometry({ immediate = false } = {}) {
  cancelAnimationFrame(viewportUpdateFrame);
  const apply = () => {
    viewportUpdateFrame = 0;
    applyVisualViewportVars();
    if (activeQueryMenu) positionQueryMenu();
    if (activeRelationTargetMenu) positionRelationTargetMenu();
    updateOverlayLayout();
  };
  if (immediate) apply();
  else viewportUpdateFrame = requestAnimationFrame(apply);
}

function updateVisualViewportVars({ immediate = false } = {}) {
  if (openModalCount) updateModalViewportGeometry({ immediate });
  else updatePageViewportGeometry({ immediate });
}

function topChromeBottom({ includeLetterNav = true } = {}) {
  const viewportTop = window.visualViewport?.offsetTop || 0;
  const topSurfaces = [...document.querySelectorAll('.topbar, .update-banner, .home-annotation-banner')]
    .filter((node) => !node.classList.contains('hidden'))
    .map((node) => node.getBoundingClientRect())
    .filter((rect) => rect.height > 0 && rect.bottom > viewportTop && rect.top < viewportTop + 320)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  let bottom = viewportTop;
  for (const rect of topSurfaces) {
    if (rect.top <= bottom + 14) bottom = Math.max(bottom, rect.bottom);
  }
  // DOM geometry is the source of truth. The old viewportTop + 72 floor mixed
  // VisualViewport and layout coordinates and created the iPhone standalone gap.
  if (bottom <= viewportTop + .5) {
    const topbar = document.querySelector('.topbar');
    const fallbackRect = topbar?.getBoundingClientRect();
    if (fallbackRect?.height) bottom = Math.max(bottom, fallbackRect.bottom);
    else {
      const fallbackHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 64;
      bottom = viewportTop + fallbackHeight;
    }
  }
  const baseBottom = bottom;
  if (!includeLetterNav) return baseBottom;
  const nav = elements['letter-nav'];
  if (!nav || nav.classList.contains('hidden')) return baseBottom;
  const navHeight = Math.max(0, nav.getBoundingClientRect().height || nav.offsetHeight || 0);
  return baseBottom + navHeight;
}

function alphabetNavAttached() {
  const nav = elements['letter-nav'];
  if (!nav || nav.classList.contains('hidden')) return false;
  const baseBottom = topChromeBottom({ includeLetterNav: false });
  const rect = nav.getBoundingClientRect();
  return rect.height > 0 && rect.top <= baseBottom + 1.5 && rect.bottom > baseBottom + 1;
}

function applyOverlayLayoutNow() {
  const updateVisible = elements['update-banner'] && !elements['update-banner'].classList.contains('hidden');
  const updateHeight = updateVisible ? Math.ceil(elements['update-banner'].getBoundingClientRect().height + 8) : 0;
  document.documentElement.style.setProperty('--update-overlay-offset', `${updateHeight}px`);
  const baseBottom = topChromeBottom({ includeLetterNav: false });
  const bottom = topChromeBottom();
  const sealedBaseBottom = Math.floor(baseBottom + .01);
  const sealedBottom = Math.floor(bottom + .01);
  document.documentElement.style.setProperty('--sticky-base-top', `${sealedBaseBottom}px`);
  document.documentElement.style.setProperty('--chrome-bottom', `${sealedBottom}px`);
  document.documentElement.style.setProperty('--toast-top', `${Math.ceil(bottom + 8)}px`);
  document.documentElement.style.setProperty('--content-sticky-top', `${sealedBottom}px`);
  cachedChromeBottom = sealedBottom;
  if (activeQueryMenu) positionQueryMenu();
  if (activeRelationTargetMenu) positionRelationTargetMenu();
  syncActiveAlphabetHeading();
  return { baseBottom: sealedBaseBottom, contentTop: sealedBottom };
}

function updateOverlayLayout({ immediate = false } = {}) {
  if (immediate) {
    if (overlayLayoutFrame) cancelAnimationFrame(overlayLayoutFrame);
    overlayLayoutFrame = 0;
    return applyOverlayLayoutNow();
  }
  if (overlayLayoutFrame) return null;
  overlayLayoutFrame = requestAnimationFrame(() => {
    overlayLayoutFrame = 0;
    applyOverlayLayoutNow();
  });
  return null;
}

const MODAL_EXIT_MS = 108;
const POPOVER_EXIT_MS = 140;
const DOCK_EXIT_MS = 140;
const BUFFER_OUT_MS = 42;
const BUFFER_IN_MS = 58;
const ROOT_BUFFER_OUT_MS = 60;
const ROOT_BUFFER_IN_MS = 88;

function lockPageForModal() {
  if (openModalCount) return;
  openModalCount = 1;
  // Modality is owned by the retained overlay + inert/touch/focus guards.
  // Never mutate html/body overflow, scroll container or page Sticky geometry.
}

function unlockPageForModal() {
  if (!openModalCount) return;
  openModalCount = 0;
}

function modalScrollableTarget(target) {
  const node = target instanceof Element ? target.closest('.dialog-body') : null;
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

function focusableModalNodes(form) {
  return [...form.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((node) => node instanceof HTMLElement && !node.hidden && getComputedStyle(node).visibility !== 'hidden');
}

function createAppDialogFrame({
  title, description = '', body = [], submitText = '保存', cancelText = '取消', destructive = false,
  onSubmit = null, onCancel = null, showCancel = null, onRestore = null, variant = 'compact', kind = 'form',
  dismissible = true, showClose = true,
}) {
  const layer = el('section', {
    className: 'modal-layer',
    dataset: { depth: String(dialogStack.length + 1), variant, kind },
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
  });
  const backdrop = el('div', { className: 'modal-layer-backdrop', 'aria-hidden': 'true' });
  const form = el('form', { className: `modal-card modal-card-${variant}`, tabindex: '-1' });
  const titleNode = el('h2', { text: title });
  const descriptionNode = el('p', { className: `muted${description ? '' : ' hidden'}`, text: description });
  const closeButton = showClose ? iconButton('close', 'icon-button modal-close', '关闭', () => closeDialog()) : null;
  const headerChildren = [el('div', {}, [titleNode, descriptionNode])];
  if (closeButton) headerChildren.push(closeButton);
  const header = el('header', { className: 'dialog-header' }, headerChildren);
  const bodyNode = el('div', { className: 'dialog-body' }, Array.isArray(body) ? body : [body]);
  const actions = el('footer', { className: 'dialog-actions' });
  const includeCancel = showCancel == null ? Boolean(onSubmit) : Boolean(showCancel);
  const frame = {
    layer, form, body: bodyNode, actions, closeButton, onSubmit, onCancel, onRestore,
    submitButton: null, kind, dismissible, closing: false,
    returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
  };
  if (includeCancel) {
    actions.append(button(cancelText, 'secondary-button', () => {
      const handler = frame.onCancel;
      closeDialog();
      if (handler) Promise.resolve().then(handler).catch(displayError);
    }));
  }
  if (onSubmit) {
    frame.submitButton = el('button', { type: 'submit', className: destructive ? 'danger-button' : 'primary-button', text: submitText });
    actions.append(frame.submitButton);
  }
  if (!actions.childNodes.length) actions.classList.add('hidden');
  form.append(header, bodyNode, actions);
  layer.append(backdrop, form);

  backdrop.addEventListener('click', () => { if (frame.dismissible) closeDialog(); });
  layer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (frame.dismissible) closeDialog();
      event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableModalNodes(form);
    if (!focusable.length) { event.preventDefault(); form.focus({ preventScroll: true }); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus({ preventScroll: true }); }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!frame.onSubmit) return;
    const activeHandler = frame.onSubmit;
    try {
      if (frame.submitButton) {
        frame.submitButton.disabled = true;
        frame.submitButton.dataset.oldText = frame.submitButton.textContent || '';
        frame.submitButton.textContent = '处理中…';
      }
      await activeHandler();
      if (dialogStack.at(-1) === frame && frame.onSubmit === activeHandler) closeDialog();
    } catch (error) { displayError(error); }
    finally {
      if (frame.submitButton?.isConnected) {
        frame.submitButton.disabled = false;
        frame.submitButton.textContent = frame.submitButton.dataset.oldText || submitText;
      }
    }
  });
  return frame;
}

function finishModalLayerClose(frame, parent) {
  frame.layer.remove();
  if (parent && dialogStack.includes(parent)) {
    parent.layer.inert = false;
    parent.layer.removeAttribute('aria-hidden');
    parent.onRestore?.();
    requestAnimationFrame(() => {
      if (frame.returnFocus?.isConnected) frame.returnFocus.focus({ preventScroll: true });
      else parent.closeButton?.focus({ preventScroll: true });
    });
    return;
  }
  if (dialogStack.length) return;
  const host = elements['app-dialog'];
  host.classList.add('hidden');
  host.setAttribute('aria-hidden', 'true');
  if (elements.app) elements.app.inert = false;
  unlockPageForModal();
  requestAnimationFrame(() => frame.returnFocus?.isConnected && frame.returnFocus.focus({ preventScroll: true }));
}

function closeDialog({ all = false } = {}) {
  if (!dialogStack.length) return;
  const host = elements['app-dialog'];
  if (all) {
    const frames = dialogStack.splice(0, dialogStack.length);
    activeSearchFrame = null;
    activeConfirmFrame = null;
    for (const frame of frames) {
      frame.closing = true;
      frame.layer.classList.add('modal-layer-closing');
    }
    window.setTimeout(() => {
      for (const frame of frames) frame.layer.remove();
      if (dialogStack.length) return;
      host.classList.add('hidden');
      host.setAttribute('aria-hidden', 'true');
      if (elements.app) elements.app.inert = false;
      unlockPageForModal();
    }, MODAL_EXIT_MS);
    return;
  }
  const frame = dialogStack.pop();
  if (!frame || frame.closing) return;
  frame.closing = true;
  if (frame === activeSearchFrame) activeSearchFrame = null;
  if (frame === activeConfirmFrame) activeConfirmFrame = null;
  const parent = dialogStack.at(-1) || null;
  frame.layer.classList.add('modal-layer-closing');
  window.setTimeout(() => finishModalLayerClose(frame, parent), MODAL_EXIT_MS);
}

function openDialog({
  title, description = '', body = [], submitText = '保存', cancelText = '取消', destructive = false,
  onSubmit = null, onCancel = null, showCancel = null, onRestore = null, variant = 'compact', kind = 'form',
  dismissible = true, showClose = true,
}) {
  const host = elements['app-dialog'];
  const parent = dialogStack.at(-1);
  if (!dialogStack.length) {
    lockPageForModal();
    updateModalViewportGeometry({ immediate: true });
    if (elements.app) elements.app.inert = true;
    host.classList.remove('hidden');
    host.setAttribute('aria-hidden', 'false');
  }
  if (parent) {
    parent.layer.inert = true;
    parent.layer.setAttribute('aria-hidden', 'true');
  }
  const frame = createAppDialogFrame({ title, description, body, submitText, cancelText, destructive, onSubmit, onCancel, showCancel, onRestore, variant, kind, dismissible, showClose });
  dialogStack.push(frame);
  host.append(frame.layer);
  requestAnimationFrame(() => {
    if (!frame.layer.isConnected || frame.closing) return;
    const focusable = focusableModalNodes(frame.form);
    const safeFocus = frame.closeButton || focusable.find((node) => node.tagName === 'BUTTON') || frame.form;
    safeFocus?.focus?.({ preventScroll: true });
  });
  return frame;
}

function closeActionDialog() {
  if (activeProviderQuery) { activeProviderQuery.controller.abort(); activeProviderQuery = null; }
  const top = dialogStack.at(-1);
  if (top?.kind === 'action') closeDialog();
}

function openActionDialog({ title, description = '', body = [] }) {
  return openDialog({ title, description, body, showCancel: false, variant: 'action', kind: 'action' });
}

function closeSearchDialog({ immediate = false } = {}) {
  const frame = activeSearchFrame;
  if (!frame) return;
  if (dialogStack.at(-1) !== frame) { activeSearchFrame = null; return; }
  if (!immediate) {
    closeDialog();
    activeSearchFrame = null;
    return;
  }
  dialogStack.pop();
  frame.closing = true;
  activeSearchFrame = null;
  // A navigation-specific close must not focus the source Search button just
  // before WebKit records the source history snapshot.
  frame.returnFocus = null;
  frame.layer.classList.remove('modal-layer-entering', 'modal-layer-closing');
  const parent = dialogStack.at(-1) || null;
  finishModalLayerClose(frame, parent);
  updatePageViewportGeometry({ immediate: true });
}

function waitForMotionEnd(node, timeoutMs = 260) {
  if (!node?.isConnected) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      node.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === node && ['transform', 'opacity'].includes(event.propertyName)) finish();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    node.addEventListener('transitionend', onEnd);
  });
}

async function closeSearchDialogForNavigation() {
  const frame = activeSearchFrame;
  if (!frame) return;
  const card = frame.form;
  const startedAt = performance.now();
  closeSearchDialog();
  await waitForMotionEnd(card, MODAL_EXIT_MS + 80);
  // Page motion starts only after the modal lifecycle has actually finished,
  // not merely after transform/opacity emitted transitionend. This keeps the
  // modal layer, app inert state and next page transition in one clean order.
  const remaining = Math.max(0, MODAL_EXIT_MS + 8 - (performance.now() - startedAt));
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function closeConfirmDialog({ force = false } = {}) {
  const frame = activeConfirmFrame;
  if (!frame) return true;
  if (frame.choiceRequired && !force) return false;
  if (dialogStack.at(-1) === frame) closeDialog();
  activeConfirmFrame = null;
  return true;
}

function openConfirmDialog({ title, description = '', body = [], submitText = '确认', cancelText = '取消', onSubmit, onCancel = null, choiceRequired = false, destructive = true }) {
  const frame = openDialog({
    title, description, body, submitText, cancelText, onSubmit, onCancel,
    destructive, showCancel: true, showClose: false, dismissible: !choiceRequired,
    variant: 'confirm', kind: 'confirm',
  });
  frame.choiceRequired = Boolean(choiceRequired);
  activeConfirmFrame = frame;
  return frame;
}

function viewKindForCollection(collection, entry = null, requested = '') {
  if (!collection) return 'word';
  const state = getState();
  const domain = collection.domainId ? state.domainById.get(collection.domainId) : null;
  if (collection.type === 'system-global-content' || collection.type === 'system-domain-content' || domain?.contentMode === 'nonStructured') return 'content';
  if (collection.type === 'normal') {
    if (['word', 'phrase'].includes(requested)) return requested;
    if (entry?.kind === 'phrase') return 'phrase';
    if (entry?.kind === 'content') return 'content';
    return 'word';
  }
  return isPhraseCollection(collection) ? 'phrase' : 'word';
}

function newNavigationToken(prefix = 'nav') {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function rootNavigationHistoryState() {
  return {
    vix: true,
    navModel: NAVIGATION_MODEL,
    runtimeId: navigationRuntimeId,
    navToken: navigationRootToken,
    routeKind: 'root',
  };
}

function currentNavigationFrame() {
  if (!appNavigationDepth) return null;
  return navigationStack[appNavigationDepth - 1] || null;
}

function discardFrameRuntimeState(frame) {
  const snapshot = frame?.snapshot;
  if (!snapshot || snapshot.type !== 'collection') return;
  expandedLettersByCollection.delete(`${snapshot.collectionId}:${snapshot.viewKind}`);
  clearExpandedRelationsForView(snapshot.collectionId, snapshot.viewKind);
}

function discardNavigationFramesFrom(depth) {
  const keep = Math.max(0, Number(depth || 0));
  const removed = navigationStack.splice(keep);
  for (const frame of removed) discardFrameRuntimeState(frame);
  appNavigationDepth = navigationStack.length;
  return removed;
}

function currentSnapshot() {
  if (!currentCollectionId) return { type: 'home', scrollY: window.scrollY };
  const collection = getState().collectionById.get(currentCollectionId);
  if (!collection) return null;
  const section = currentViewKind;
  const mode = getViewMode(currentCollectionId);
  return {
    type: 'collection', collectionId: currentCollectionId, viewKind: section,
    mode,
    calendarMonth: mode === 'date' ? getCalendarMonth(currentCollectionId, section) : '',
    scrollY: window.scrollY,
    position: captureSemanticPosition(),
    expandedGroups: [...expandedLettersFor(currentCollectionId, section)],
    expandedRelations: [...expandedRelations].filter((key) => key.startsWith(`${currentCollectionId}\u0000${section}\u0000`)),
    activeSection,
  };
}

function persistCurrentHistorySnapshot() {
  if (navigationTraversalInProgress || scrollCoordinator.isActive()) return;
  const snapshot = currentSnapshot();
  if (!snapshot) return;
  if (!currentCollectionId) {
    homeScrollY = Math.max(0, Number(snapshot.scrollY || 0));
    return;
  }
  const frame = currentNavigationFrame();
  if (frame) frame.snapshot = snapshot;
}

function applySnapshotBeforeRender(snapshot, collection, viewKind) {
  if (!snapshot || snapshot.type !== 'collection' || snapshot.collectionId !== collection.id || snapshot.viewKind !== viewKind) return;
  const expanded = expandedLettersFor(collection.id, viewKind);
  expanded.clear();
  for (const key of snapshot.expandedGroups || snapshot.expandedLetters || []) expanded.add(key);
  for (const key of [...expandedRelations]) if (key.startsWith(`${collection.id}\u0000${viewKind}\u0000`)) expandedRelations.delete(key);
  for (const key of snapshot.expandedRelations || []) expandedRelations.add(key);
  activeSection = snapshot.activeSection || viewKind;
}

function restoreSnapshotAfterRender(snapshot, token = renderRevision) {
  if (!snapshot) return;
  const position = snapshot.position || { kind: 'scroll', scrollYFallback: Math.max(0, Number(snapshot.scrollY || 0)) };
  const transaction = beginRootScrollTransaction('history-fallback', position);
  const epoch = transaction.epoch;
  requestAnimationFrame(async () => {
    if (token !== renderRevision || !scrollCoordinator.owns(epoch)) return;
    prepareSemanticPositionGeometry(position, { reason: 'history-fallback' });
    restoreSemanticPosition(position, epoch, { source: 'history-fallback' });
    await settleSemanticPosition(epoch, position, { maxFrames: 4, tolerance: 1, source: 'history-fallback' });
    if (!scrollCoordinator.owns(epoch)) return;
    finishRootScrollTransaction(epoch, { persist: true });
  });
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
  if (entry && ['search', 'relation', 'route', 'annotation', 'pin', 'last'].includes(reason)) {
    clearExpandedRelationsForView(collection.id, viewKind);
    expanded.clear();
    if (getViewMode(collection.id) === 'alphabet') expanded.add(letterForEntry(entry));
    else expanded.add(dateExpansionKey(getStudyStamp(entry, collection.id)?.reviewDateKey || 'unmarked'));
  }
}

function dateExpansionKey(dateKey) {
  return `date:${dateKey || 'unmarked'}`;
}

function targetSnapshot(collection, viewKind) {
  const mode = getViewMode(collection.id);
  return {
    type: 'collection', collectionId: collection.id, viewKind,
    mode,
    calendarMonth: mode === 'date' ? initialCalendarMonthForView(collection.id, viewKind) : '',
    scrollY: 0,
    position: { kind: 'top', scrollYFallback: 0 },
    expandedGroups: [...expandedLettersFor(collection.id, viewKind)],
    expandedRelations: [...expandedRelations].filter((key) => key.startsWith(`${collection.id}\u0000${viewKind}\u0000`)),
    activeSection: viewKind,
  };
}

async function persistHydratedViewState(snapshot) {
  if (snapshot?.type !== 'collection') return;
  historyRestoreInProgress = true;
  try {
    await persistRuntimeViewState(snapshot.collectionId, {
      mode: snapshot.mode,
      section: snapshot.viewKind,
      calendarMonth: snapshot.calendarMonth || '',
    });
  } catch (error) {
    displayError(error);
  } finally {
    historyRestoreInProgress = false;
  }
}

function presentationMotionClass(kind) {
  return `vix-motion-${String(kind || 'none').replace(/[^a-z0-9-]/gi, '-')}`;
}

async function runPresentationTransition(kind, update) {
  if (activePageTransition?.finished) {
    try { await activePageTransition.finished; } catch { /* prior transition may be skipped by a newer one */ }
  }
  const root = document.documentElement;
  const className = presentationMotionClass(kind);
  root.classList.add('vix-motion-active', className);
  try {
    if (typeof document.startViewTransition !== 'function') {
      await update();
      return;
    }
    const transition = document.startViewTransition(() => Promise.resolve(update()));
    activePageTransition = transition;
    await transition.updateCallbackDone;
    await transition.finished.catch(() => {});
  } finally {
    root.classList.remove('vix-motion-active', className);
    activePageTransition = null;
  }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

async function animateSurfaceOpacity(node, from, to, duration, easing = 'cubic-bezier(.2,.7,.2,1)', { delay = 0 } = {}) {
  if (!node?.isConnected) return;
  node.style.opacity = String(from);
  if (prefersReducedMotion() || duration <= 0 || typeof node.animate !== 'function') {
    node.style.opacity = String(to);
    return;
  }
  const animation = node.animate([{ opacity: from }, { opacity: to }], {
    duration, delay, easing, fill: 'forwards',
  });
  try { await animation.finished; } catch { /* interrupted buffer is allowed to finish at the committed state */ }
  node.style.opacity = String(to);
  animation.cancel();
}

async function restoreTransientSemanticPosition(position, source = 'buffered-switch') {
  if (!position) return;
  const transaction = beginRootScrollTransaction(source, position);
  const epoch = transaction.epoch;
  prepareSemanticPositionGeometry(position, { reason: `${source}-prewarm`, passes: 3 });
  restoreSemanticPosition(position, epoch, { tolerance: .5, source });
  await settleSemanticPosition(epoch, position, { maxFrames: 4, tolerance: .75, source });
  if (scrollCoordinator.owns(epoch)) finishRootScrollTransaction(epoch, { persist: false });
}

async function runBufferedCollectionCommit(update, { position = null, source = 'buffered-switch', outMs = BUFFER_OUT_MS, inMs = BUFFER_IN_MS } = {}) {
  const surface = elements['collection-view'];
  const toolbar = elements['bottom-toolbar'];
  bufferedStateCommitInProgress = true;
  if (surface) surface.inert = true;
  if (toolbar) toolbar.inert = true;
  try {
    if (!surface?.isConnected || prefersReducedMotion()) {
      await update();
      if (position) await restoreTransientSemanticPosition(position, source);
      surface?.style.removeProperty('opacity');
      return;
    }
    await animateSurfaceOpacity(surface, 1, 0, outMs, 'cubic-bezier(.4,0,1,1)');
    surface.style.opacity = '0';
    await update();
    if (position) await restoreTransientSemanticPosition(position, source);
    await nextPresentationFrame();
    await animateSurfaceOpacity(surface, 0, 1, inMs, 'cubic-bezier(.2,.72,.2,1)');
    surface.style.removeProperty('opacity');
  } finally {
    if (surface) surface.inert = false;
    if (toolbar) toolbar.inert = false;
    bufferedStateCommitInProgress = false;
  }
}

async function runRootBufferedCommit(update) {
  const app = elements.app;
  if (!app?.isConnected || prefersReducedMotion()) { await update(); return; }
  await animateSurfaceOpacity(app, 1, 0, ROOT_BUFFER_OUT_MS, 'cubic-bezier(.4,0,1,1)');
  app.style.opacity = '0';
  await update();
  const topbar = app.querySelector('.topbar');
  const main = elements['main-content'];
  app.style.opacity = '1';
  if (topbar) topbar.style.opacity = '0';
  if (main) main.style.opacity = '0';
  await nextPresentationFrame();
  const tasks = [];
  if (topbar) tasks.push(animateSurfaceOpacity(topbar, 0, 1, 72, 'cubic-bezier(.2,.72,.2,1)'));
  if (main) tasks.push(animateSurfaceOpacity(main, 0, 1, ROOT_BUFFER_IN_MS, 'cubic-bezier(.2,.72,.2,1)', { delay: 12 }));
  await Promise.all(tasks);
  topbar?.style.removeProperty('opacity');
  main?.style.removeProperty('opacity');
  app.style.removeProperty('opacity');
}

function resetRootScrollForPreparedPage(source = 'page-top') {
  const transaction = beginRootScrollTransaction(source, { kind: 'top', scrollYFallback: 0 });
  rootScrollToY(0, { epoch: transaction.epoch, source });
  finishRootScrollTransaction(transaction.epoch, { persist: false });
}

function clearRecursivePresentationState() {
  pendingJumpEntryId = '';
  pendingJumpReason = 'home';
  pendingPageSnapshot = null;
  suppressPostRenderSnapshotRestore = false;
  persistentJumpEntryId = '';
  expandedRelations.clear();
  expandedLettersByCollection.clear();
  currentCollectionId = '';
  currentViewKind = 'word';
  activeSection = 'main';
  appNavigationDepth = 0;
}

function renderCommittedRoot({ resetScroll = false, restoreScroll = false } = {}) {
  closeReview();
  closeQueryMenu({ immediate: true });
  closeRelationTargetMenu({ immediate: true });
  clearRecursivePresentationState();
  if (resetScroll) {
    homeGlobalMode = 'structured';
    homeScrollY = 0;
  }
  restoreHomeScrollPending = false;
  renderApp();
  if (resetScroll) resetRootScrollForPreparedPage('home-reset');
  else if (restoreScroll) {
    const transaction = beginRootScrollTransaction('home-back-restore', { kind: 'scroll', scrollYFallback: homeScrollY });
    rootScrollToY(homeScrollY, { epoch: transaction.epoch, source: 'home-back-restore' });
    finishRootScrollTransaction(transaction.epoch, { persist: false });
  }
}

function hydrateNavigationSnapshot(snapshot) {
  if (snapshot?.type !== 'collection') return;
  hydrateRuntimeViewState(snapshot.collectionId, {
    mode: snapshot.mode,
    section: snapshot.viewKind,
    calendarMonth: snapshot.calendarMonth || '',
  });
}

function prepareBackFrame(frame) {
  if (!frame?.snapshot) return null;
  const snapshot = frame.snapshot;
  currentCollectionId = frame.collectionId || snapshot.collectionId || '';
  currentViewKind = frame.viewKind || snapshot.viewKind || 'word';
  activeSection = currentViewKind;
  pendingPageSnapshot = snapshot;
  pendingJumpEntryId = '';
  pendingJumpReason = 'back';
  // Suppress the ordinary post-render snapshot restore. Back restoration is
  // completed inside the View Transition update callback before the new visual
  // state is captured.
  suppressPostRenderSnapshotRestore = true;
  hydrateNavigationSnapshot(snapshot);
  renderApp();
  const position = snapshot.position || { kind: 'scroll', scrollYFallback: Math.max(0, Number(snapshot.scrollY || 0)) };
  const transaction = beginRootScrollTransaction('back-restore', position);
  prepareSemanticPositionGeometry(position, { reason: 'back-restore-capture' });
  restoreSemanticPosition(position, transaction.epoch, { tolerance: .5, source: 'back-restore-capture' });
  prepareSemanticPositionGeometry(position, { reason: 'back-restore-final' });
  restoreSemanticPosition(position, transaction.epoch, { tolerance: .5, source: 'back-restore-final' });
  finishRootScrollTransaction(transaction.epoch, { persist: false });
  pendingPageSnapshot = null;
  suppressPostRenderSnapshotRestore = false;
  return snapshot;
}

async function navigateBack() {
  if (bufferedStateCommitInProgress || appNavigationDepth <= 0) return;
  persistCurrentHistorySnapshot();
  navigationTraversalInProgress = true;
  const leaving = navigationStack.pop() || null;
  appNavigationDepth = navigationStack.length;
  try {
    if (!appNavigationDepth) {
      await runPresentationTransition('pop', () => {
        discardFrameRuntimeState(leaving);
        renderCommittedRoot({ restoreScroll: true });
      });
      return;
    }
    const targetFrame = currentNavigationFrame();
    let restoredSnapshot = null;
    await runPresentationTransition('pop', () => {
      discardFrameRuntimeState(leaving);
      restoredSnapshot = prepareBackFrame(targetFrame);
    });
    if (restoredSnapshot) persistHydratedViewState(restoredSnapshot);
  } finally {
    navigationTraversalInProgress = false;
    persistCurrentHistorySnapshot();
  }
}

async function resetNavigationToHome() {
  while (bufferedStateCommitInProgress) await nextPresentationFrame();
  if (!currentCollectionId && !appNavigationDepth) {
    homeGlobalMode = 'structured';
    homeScrollY = 0;
    renderApp();
    return;
  }
  persistCurrentHistorySnapshot();
  navigationTraversalInProgress = true;
  try {
    const removed = navigationStack.splice(0, navigationStack.length);
    appNavigationDepth = 0;
    await runRootBufferedCommit(() => {
      for (const frame of removed) discardFrameRuntimeState(frame);
      renderCommittedRoot({ resetScroll: true });
    });
  } finally {
    navigationTraversalInProgress = false;
  }
}

function goHome() {
  resetNavigationToHome().catch(displayError);
}

async function navigateCollection(collectionId, entryId = '', reason = 'jump', requestedView = '') {
  if (bufferedStateCommitInProgress) return;
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const entry = entryId ? state.entryById.get(entryId) : null;
  if (!collection) return;
  const domain = collection.domainId ? state.domainById.get(collection.domainId) : null;
  let nextView = viewKindForCollection(collection, entry, requestedView);

  let needsHomeModePersistence = false;
  if (reason === 'home') {
    if (collection.type === 'normal' && domain?.contentMode !== 'nonStructured') {
      const visible = getVisibleEntries(collection.id);
      nextView = visible.some((item) => item.kind === 'word') ? 'word' : 'phrase';
    }
    if (getViewMode(collection.id) !== 'alphabet') {
      hydrateRuntimeViewState(collection.id, { mode: 'alphabet', section: nextView });
      needsHomeModePersistence = true;
    }
  }

  persistCurrentHistorySnapshot();
  if (!currentCollectionId) homeScrollY = window.scrollY;
  closeQueryMenu();
  closeRelationTargetMenu();
  prepareTargetExpansion(collection, entry, nextView, reason);

  if (currentCollectionId === collectionId) {
    const viewChanged = nextView !== currentViewKind;
    if (!viewChanged) {
      if (entryId) await jumpToEntry(entryId, { collectionId, reason });
      return;
    }
    collapseTransactionRevision += 1;
    const previousView = currentViewKind;
    expandedLettersFor(collection.id, previousView).clear();
    clearExpandedRelationsForView(collection.id, previousView);
    expandedLettersFor(collection.id, nextView).clear();
    clearExpandedRelationsForView(collection.id, nextView);
    prepareTargetExpansion(collection, entry, nextView, reason);
    const targetMode = getViewMode(collection.id);
    const fallbackTarget = transientViewSwitchTarget(nextView);
    const targetPosition = entryId
      ? { kind: 'entry', entryId, offsetFromContentTop: 0, scrollYFallback: window.scrollY }
      : fallbackTarget.position;
    const targetStampMonth = entry ? getStudyStamp(entry, collection.id)?.reviewDateKey?.slice(0, 7) || '' : '';
    const freshMonth = targetMode === 'date'
      ? (targetStampMonth || fallbackTarget.calendarMonth || initialCalendarMonthForView(collection.id, nextView))
      : '';
    if (targetMode === 'date') hydrateRuntimeViewState(collection.id, { mode: targetMode, section: nextView, calendarMonth: freshMonth });
    currentViewKind = nextView;
    activeSection = nextView;
    pendingPageSnapshot = null;
    pendingJumpEntryId = '';
    pendingJumpReason = 'jump';
    const frame = currentNavigationFrame();
    if (frame) {
      frame.collectionId = collectionId;
      frame.viewKind = nextView;
    }
    navigationTraversalInProgress = true;
    try {
      await runBufferedCollectionCommit(() => renderApp(), {
        position: targetPosition,
        source: `view-target-${previousView}-to-${nextView}`,
        outMs: 38,
        inMs: 54,
      });
    } finally {
      navigationTraversalInProgress = false;
    }
    if (targetMode === 'date' && freshMonth) {
      presentationMutationInProgress += 1;
      try { await setCalendarMonth(collection.id, nextView, freshMonth); }
      finally { presentationMutationInProgress = Math.max(0, presentationMutationInProgress - 1); }
    }
    if (entryId) await jumpToEntry(entryId, { collectionId, reason });
    persistCurrentHistorySnapshot();
    if (needsHomeModePersistence) persistHydratedViewState(currentSnapshot());
    return;
  }

  const token = newNavigationToken('page');
  const frame = {
    token,
    collectionId,
    viewKind: nextView,
    snapshot: targetSnapshot(collection, nextView),
    virtualLayoutCache: new Map(),
    virtualLayoutWidth: 0,
  };
  // A fresh recursive target is initialized from its target presentation, never
  // from a hidden previous view/date snapshot. Only Back hydrates an old frame.
  hydrateNavigationSnapshot(frame.snapshot);

  navigationTraversalInProgress = true;
  try {
    await runPresentationTransition('push', () => {
      currentCollectionId = collectionId;
      currentViewKind = nextView;
      activeSection = nextView;
      pendingJumpEntryId = '';
      pendingJumpReason = 'jump';
      pendingPageSnapshot = null;
      navigationStack.push(frame);
      appNavigationDepth = navigationStack.length;
      renderApp();
      resetRootScrollForPreparedPage('page-push-top');
    });
  } finally {
    navigationTraversalInProgress = false;
  }

  if (entryId) await jumpToEntry(entryId, { collectionId, reason });
  if (needsHomeModePersistence) persistHydratedViewState(frame.snapshot);
  persistCurrentHistorySnapshot();
}

function projectionCollectionForEntry(entryId) {
  const state = getState();
  const entry = state.entryById.get(entryId);
  if (!entry) return '';
  if (entry.kind === 'phrase') return systemPhraseCollectionId(entry.domainId);
  if (entry.kind === 'content') return systemDomainContentCollectionId(entry.domainId);
  return systemDomainWordsCollectionId(entry.domainId);
}

function positionDomainId(collection, entry = null) {
  return positionScopeDomainId(collection, entry);
}

function isGlobalCollection(collectionOrId) {
  const id = typeof collectionOrId === 'string' ? collectionOrId : collectionOrId?.id;
  return [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(id);
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
  const domain = state.domainById.get(collection.domainId);
  if (domain?.contentMode === 'nonStructured') return entries.filter((entry) => entry.kind === 'content');
  const kind = ['word', 'phrase'].includes(viewKind) ? viewKind : (['word', 'phrase'].includes(currentViewKind) ? currentViewKind : 'word');
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
  const collection = state.collectionById.get(collectionId);
  const entries = getVisibleEntries(collectionId);
  if (collection?.type === 'system-global-content' || collection?.type === 'system-domain-content') return `${entries.length.toLocaleString()} 内容`;
  if (isGlobalCollection(collectionId)) {
    const count = state.projectionUniqueCounts.get(collectionId) || 0;
    if (collectionId === SYSTEM_GLOBAL_WORDS_ID) return `${count.toLocaleString()} 词`;
    if (collectionId === SYSTEM_GLOBAL_PHRASES_ID) return `${count.toLocaleString()} 短语`;
    return `${count.toLocaleString()} 内容`;
  }
  let words = 0, phrases = 0, contents = 0;
  for (const entry of entries) {
    if (entry.kind === 'phrase') phrases += 1;
    else if (entry.kind === 'content') contents += 1;
    else words += 1;
  }
  return contents ? `${contents.toLocaleString()} 内容` : `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`;
}

function collectionCard(collection) {
  if (!collection) return null;
  const state = getState();
  const entries = getVisibleEntries(collection.id);
  const label = displayCollectionLabel(collection);
  let words = 0, phrases = 0, contents = 0;
  for (const entry of entries) {
    if (entry.kind === 'phrase') phrases += 1;
    else if (entry.kind === 'content') contents += 1;
    else words += 1;
  }
  const count = collection.type === 'normal'
    ? (contents ? `${contents.toLocaleString()} 内容` : `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`)
    : (isGlobalCollection(collection.id) ? (state.projectionUniqueCounts.get(collection.id) || 0) : entries.length).toLocaleString();
  const globalSystem = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collection.id);
  const domainSystem = !globalSystem && (
    collection.id === systemDomainWordsCollectionId(collection.domainId)
    || collection.id === systemPhraseCollectionId(collection.domainId)
    || collection.id === systemDomainContentCollectionId(collection.domainId)
    || collection.type === 'system-phrases' || collection.type === 'system-domain-content'
  );
  const classes = ['collection-card', collection.type === 'normal' ? 'composite-card' : '', globalSystem || domainSystem ? 'system-card' : '', globalSystem ? 'global-system-card' : '', domainSystem ? 'domain-system-card' : ''].filter(Boolean).join(' ');
  return el('button', {
    type: 'button', className: classes,
    on: { click: () => { navigateCollection(collection.id, '', 'home').catch(displayError); } },
  }, [
    el('div', { className: 'collection-card-title' }, [el('h3', { text: collection.name }), el('span', { className: 'arrow' }, [svgIcon('enter')])]),
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
  return el('button', { type: 'button', className: 'search-result', on: { click: () => Promise.resolve(onSelect(entry, collectionId)).catch(displayError) } }, [
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
  openDialog({ title: '管理词库', body: mount, variant: 'management', showCancel: false, onRestore: refresh });
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
    ['新增词汇', summary.addedWords], ['新增短语', summary.addedPhrases], ['新增内容', summary.addedContent],
    ['更新释义', summary.updatedGlosses], ['新增归属', summary.addedMemberships],
    ['移除词汇', summary.removedWords], ['移除短语', summary.removedPhrases], ['移除内容', summary.removedContent],
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

async function switchHomeGlobalMode(sourceButton = null) {
  const scope = elements['home-view']?.querySelector('.global-scope');
  const grid = scope?.querySelector('.global-grid');
  if (!scope || !grid || sourceButton?.dataset.buffering === 'true') return;
  if (sourceButton) { sourceButton.dataset.buffering = 'true'; sourceButton.disabled = true; }
  try {
    await animateSurfaceOpacity(grid, 1, 0, prefersReducedMotion() ? 0 : 34, 'cubic-bezier(.4,0,1,1)');
    homeGlobalMode = homeGlobalMode === 'structured' ? 'nonStructured' : 'structured';
    const state = getState();
    const cards = homeGlobalMode === 'structured'
      ? [collectionCard(state.collectionById.get(SYSTEM_GLOBAL_WORDS_ID)), collectionCard(state.collectionById.get(SYSTEM_GLOBAL_PHRASES_ID))]
      : [collectionCard(state.collectionById.get(SYSTEM_GLOBAL_CONTENT_ID))];
    scope.dataset.mode = homeGlobalMode;
    grid.replaceChildren(...cards.filter(Boolean));
    const buttonNode = sourceButton?.isConnected ? sourceButton : scope.querySelector('.global-mode-toggle');
    if (buttonNode) {
      const label = homeGlobalMode === 'structured' ? '切换到非结构全局表' : '切换到结构化全局表';
      buttonNode.title = label;
      buttonNode.setAttribute('aria-label', label);
    }
    await nextPresentationFrame();
    await animateSurfaceOpacity(grid, 0, 1, prefersReducedMotion() ? 0 : 52, 'cubic-bezier(.2,.72,.2,1)');
    grid.style.removeProperty('opacity');
  } finally {
    if (sourceButton?.isConnected) { sourceButton.disabled = false; delete sourceButton.dataset.buffering; }
  }
}

function renderHome(token = renderRevision) {
  const state = getState();
  currentCollectionId = '';
  elements.app.classList.remove('is-collection', 'has-pin', 'has-review');
  elements.app.classList.add('is-home');
  elements['collection-view'].classList.remove('system-collection-view', 'global-system-view', 'domain-system-view', 'has-letter-nav');
  elements['home-view'].classList.remove('hidden');
  elements['collection-view'].classList.add('hidden');
  elements['back-button'].classList.add('hidden');
  elements['home-button'].classList.add('hidden');
  elements['search-button'].classList.remove('hidden');
  elements['bottom-toolbar'].classList.add('hidden');
  setContextDockVisible(elements['pin-bar'], 'has-pin', false, { clearAfterHide: true });
  elements['back-to-top']?.classList.add('hidden');
  elements['page-title'].textContent = 'Vocabulary Index';
  elements['page-subtitle'].textContent = APP_VERSION;
  renderLargeTitle({ eyebrow: 'VOCABULARY INDEX', title: '词汇索引', subtitle: `${(state.projectionUniqueCounts.get(SYSTEM_GLOBAL_WORDS_ID) || 0).toLocaleString()} 个全局词汇` });
  elements['settings-button'].replaceChildren(svgIcon('more'));
  elements['settings-button'].setAttribute('aria-label', '设置');

  const homeActions = [button('管理', 'secondary-button compact-button', openLibraryManager)];
  const toggleGlobal = el('button', {
    type: 'button',
    className: 'secondary-button compact-button global-mode-toggle',
    title: homeGlobalMode === 'structured' ? '切换到非结构全局表' : '切换到结构化全局表',
    'aria-label': homeGlobalMode === 'structured' ? '切换到非结构全局表' : '切换到结构化全局表',
    on: { click: (event) => { switchHomeGlobalMode(event.currentTarget).catch(displayError); } },
  }, [svgIcon('switchParallel')]);
  const globalCards = homeGlobalMode === 'structured'
    ? [collectionCard(state.collectionById.get(SYSTEM_GLOBAL_WORDS_ID)), collectionCard(state.collectionById.get(SYSTEM_GLOBAL_PHRASES_ID))]
    : [collectionCard(state.collectionById.get(SYSTEM_GLOBAL_CONTENT_ID))];
  const sections = [el('section', { className: 'index-scope global-scope', dataset: { mode: homeGlobalMode } }, [
    el('header', { className: 'scope-heading' }, [
      el('h3', { text: '全局' }),
      el('div', { className: 'scope-actions' }, [toggleGlobal, ...homeActions]),
    ]),
    el('div', { className: 'collection-grid global-grid' }, globalCards.filter(Boolean)),
  ])];
  for (const domain of [...state.domains].sort((a, b) => a.order - b.order)) {
    const normalCollections = state.collections
      .filter((item) => item.domainId === domain.id && item.type === 'normal' && !item.hidden)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const systemCollections = domain.contentMode === 'nonStructured'
      ? [state.collectionById.get(systemDomainContentCollectionId(domain.id))]
      : [state.collectionById.get(systemDomainWordsCollectionId(domain.id)), state.collectionById.get(systemPhraseCollectionId(domain.id))];
    const collections = [...systemCollections, ...normalCollections].filter(Boolean);
    const grid = collections.length ? el('div', { className: 'collection-grid' }, collections.map(collectionCard).filter(Boolean)) : el('div', { className: 'empty-state', text: '暂无内容' });
    sections.push(el('section', { className: 'index-scope domain-scope', dataset: { domainId: domain.id, contentMode: domain.contentMode || 'structured' } }, [
      el('header', { className: 'scope-heading' }, [el('h3', { text: domain.name }), domain.relationExcluded ? el('span', { className: 'scope-state-note', text: '关联已关闭' }) : null]),
      grid,
    ]));
  }
  elements['home-view'].replaceChildren(...sections);
  renderHomeAnnotationBanner();
  if (restoreHomeScrollPending) {
    restoreHomeScrollPending = false;
    const transaction = beginRootScrollTransaction('home-restore', { kind: 'scroll', scrollYFallback: homeScrollY });
    const epoch = transaction.epoch;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== renderRevision || !scrollCoordinator.owns(epoch)) return;
      rootScrollToY(homeScrollY, { epoch, source: 'home-restore' });
      finishRootScrollTransaction(epoch, { persist: false });
    }));
  }
}

function renderCollection(token = renderRevision) {
  const state = getState();
  const collection = state.collectionById.get(currentCollectionId);
  if (!collection) { goHome(); return; }
  const domain = state.domainById.get(collection.domainId);
  const allEntries = getVisibleEntries(collection.id);
  const snapshotView = pendingPageSnapshot?.collectionId === collection.id ? pendingPageSnapshot.viewKind : '';
  currentViewKind = viewKindForCollection(collection, null, snapshotView || currentViewKind);
  activeSection = currentViewKind;
  applySnapshotBeforeRender(pendingPageSnapshot, collection, currentViewKind);
  if (pendingJumpEntryId) prepareTargetExpansion(collection, state.entryById.get(pendingJumpEntryId), currentViewKind, pendingJumpReason);
  const entries = collection.type === 'normal' ? entriesForCollectionView(collection.id, currentViewKind) : allEntries;
  const globalSystemView = [SYSTEM_GLOBAL_WORDS_ID, SYSTEM_GLOBAL_PHRASES_ID, SYSTEM_GLOBAL_CONTENT_ID].includes(collection.id);
  const domainSystemView = !globalSystemView && (
    collection.id === systemDomainWordsCollectionId(collection.domainId)
    || collection.id === systemPhraseCollectionId(collection.domainId)
    || collection.id === systemDomainContentCollectionId(collection.domainId)
    || collection.type === 'system-phrases' || collection.type === 'system-domain-content'
  );
  elements['collection-view'].classList.toggle('system-collection-view', globalSystemView || domainSystemView);
  elements['collection-view'].classList.toggle('global-system-view', globalSystemView);
  elements['collection-view'].classList.toggle('domain-system-view', domainSystemView);
  elements['collection-view'].dataset.viewKind = currentViewKind;
  elements.app.classList.add('is-collection');
  elements.app.classList.remove('is-home');
  elements['home-view'].classList.add('hidden');
  elements['collection-view'].classList.remove('hidden');
  elements['back-button'].classList.remove('hidden');
  elements['home-button'].classList.toggle('hidden', appNavigationDepth < 2);
  elements['home-annotation-banner'].classList.add('hidden');
  elements['search-button'].classList.add('hidden');
  elements['bottom-toolbar'].classList.remove('hidden');
  elements['page-title'].textContent = collection.name;
  let words = 0, phrases = 0, contents = 0;
  for (const entry of allEntries) {
    if (entry.kind === 'phrase') phrases += 1;
    else if (entry.kind === 'content') contents += 1;
    else words += 1;
  }
  const countText = collection.type === 'normal'
    ? (contents ? `${contents.toLocaleString()} 内容` : `${words.toLocaleString()} 词 · ${phrases.toLocaleString()} 短语`)
    : (globalSystemView ? (state.projectionUniqueCounts.get(collection.id) || 0) : allEntries.length).toLocaleString();
  const viewLabel = collection.type === 'normal'
    ? (currentViewKind === 'phrase' ? '短语视图' : currentViewKind === 'content' ? '内容视图' : '词汇视图') : '';
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
  const suppressSnapshotRestore = suppressPostRenderSnapshotRestore;
  if (jumpEntryId) queueMicrotask(() => {
    if (token !== renderRevision) return;
    jumpToEntry(jumpEntryId, { collectionId: collection.id, reason: jumpReason }).catch(displayError);
  });
  else if (restoreSnapshot && !suppressSnapshotRestore) restoreSnapshotAfterRender(restoreSnapshot, token);
  else if (!restoreSnapshot && jumpReason === 'home') {
    const transaction = beginRootScrollTransaction('collection-fresh-top', { kind: 'top', scrollYFallback: 0 });
    const epoch = transaction.epoch;
    requestAnimationFrame(() => {
      if (token !== renderRevision || !scrollCoordinator.owns(epoch)) return;
      rootScrollToY(0, { epoch, source: 'collection-fresh-top' });
      finishRootScrollTransaction(epoch, { persist: true });
    });
  }
  pendingPageSnapshot = null;
  suppressPostRenderSnapshotRestore = false;
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
  return getViewMode(collection.id);
}

function browseAnchorEntryId(collection, section = currentViewKind) {
  const mode = getViewMode(collection.id);
  return getLastPosition(positionDomainId(collection), collection.id, { mode, section }) || '';
}


function longpressGuardActive() { return Date.now() < longpressGuardUntil || document.documentElement.classList.contains('longpress-active'); }
function beginLongpressGuard() {
  clearTimeout(longpressGuardTimer);
  longpressGuardUntil = Number.POSITIVE_INFINITY;
  document.documentElement.classList.add('longpress-active', 'longpress-guard');
  window.getSelection?.()?.removeAllRanges();
}
function endLongpressGuardWithGrace(milliseconds = 350) {
  clearTimeout(longpressGuardTimer);
  document.documentElement.classList.remove('longpress-active');
  longpressGuardUntil = Date.now() + milliseconds;
  document.documentElement.classList.add('longpress-guard');
  window.getSelection?.()?.removeAllRanges();
  longpressGuardTimer = window.setTimeout(() => {
    longpressGuardUntil = 0;
    document.documentElement.classList.remove('longpress-guard');
    window.getSelection?.()?.removeAllRanges();
  }, milliseconds);
}
function cancelLongpressGuard() {
  clearTimeout(longpressGuardTimer);
  longpressGuardUntil = 0;
  document.documentElement.classList.remove('longpress-active', 'longpress-guard');
}
for (const type of ['selectstart', 'contextmenu']) {
  document.addEventListener(type, (event) => { if (longpressGuardActive()) event.preventDefault(); }, { capture: true });
}
document.addEventListener('click', (event) => {
  if (!longpressGuardActive()) return;
  const editable = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]');
  if (!editable) { event.preventDefault(); event.stopPropagation(); }
}, { capture: true });

function cancelBrowseAnchorPress({ suppressClick = false, grace = false } = {}) {
  const press = browseAnchorPress;
  if (!press) return;
  browseAnchorPress = null;
  clearTimeout(press.timer);
  press.button?.classList.remove('saving-anchor');
  if (press.button?.hasPointerCapture?.(press.pointerId)) {
    try { press.button.releasePointerCapture(press.pointerId); } catch {}
  }
  if (suppressClick) browseAnchorSuppressClickUntil = Date.now() + (grace ? 350 : 120);
  if (press.fired && grace) endLongpressGuardWithGrace(350);
  else if (press.fired) cancelLongpressGuard();
}

async function saveBrowseAnchor(collection, section, buttonNode) {
  const mode = getViewMode(collection.id);
  const entryId = firstVisibleEntryId() || '';
  const entry = entryId ? getState().entryById.get(entryId) : null;
  if (!entry || sectionForEntry(entry) !== section) {
    return { saved: false, message: '当前位置没有可保存的词条' };
  }
  const saved = await setLastPosition(positionDomainId(collection, entry), collection.id, entry.id, { mode, section });
  if (!saved) {
    return { saved: false, message: '当前位置已失效，未保存浏览锚点' };
  }
  navigator.vibrate?.(10);
  buttonNode?.classList.add('has-anchor');
  buttonNode?.classList.remove('no-anchor');
  buttonNode?.setAttribute('aria-label', '浏览锚点：短按跳转，长按覆盖当前位置');
  buttonNode.title = '短按跳转到浏览锚点；长按覆盖为当前位置';
  return { saved: true, message: '已保存当前位置' };
}

function bindBrowseAnchorButton(buttonNode, collection, section) {
  const updateState = () => {
    const hasAnchor = Boolean(browseAnchorEntryId(collection, section));
    buttonNode.disabled = false;
    buttonNode.classList.toggle('has-anchor', hasAnchor);
    buttonNode.classList.toggle('no-anchor', !hasAnchor);
    buttonNode.title = hasAnchor ? '短按跳转到浏览锚点；长按覆盖为当前位置' : '长按保存当前位置；短按查看说明';
    buttonNode.setAttribute('aria-label', hasAnchor ? '浏览锚点：短按跳转，长按覆盖当前位置' : '浏览锚点：长按保存当前位置');
  };
  updateState();
  buttonNode.onpointerdown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelBrowseAnchorPress();
    browseAnchorPress = {
      button: buttonNode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fired: false,
      savePromise: null,
      timer: window.setTimeout(() => {
        const press = browseAnchorPress;
        if (!press || press.button !== buttonNode) return;
        press.fired = true;
        beginLongpressGuard();
        browseAnchorSuppressClickUntil = Date.now() + 350;
        buttonNode.classList.add('saving-anchor');
        press.savePromise = saveBrowseAnchor(collection, section, buttonNode)
          .then((result) => ({ result, error: null }))
          .catch((error) => ({ result: null, error }))
          .finally(() => buttonNode.classList.remove('saving-anchor'));
      }, 520),
    };
    try { buttonNode.setPointerCapture(event.pointerId); } catch {}
  };
  buttonNode.onpointermove = (event) => {
    const press = browseAnchorPress;
    if (!press || press.button !== buttonNode || press.pointerId !== event.pointerId) return;
    // Movement can cancel only before the 520 ms threshold. Once the long-press
    // has fired, the gesture keeps ownership until pointerup/cancel and then
    // enters the invisible grace window; this prevents iOS from inheriting the
    // tail of the gesture as a native text-selection long press.
    if (!press.fired && Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 10) {
      cancelBrowseAnchorPress({ suppressClick: true });
    }
  };
  buttonNode.onpointerup = (event) => {
    const press = browseAnchorPress;
    if (!press || press.button !== buttonNode || press.pointerId !== event.pointerId) return;
    const fired = press.fired;
    const savePromise = press.savePromise;
    cancelBrowseAnchorPress({ suppressClick: fired, grace: fired });
    window.getSelection?.()?.removeAllRanges();
    if (fired && savePromise) savePromise.then(({ result, error }) => {
      window.getSelection?.()?.removeAllRanges();
      if (error) displayError(error);
      else if (result?.message) showToast(result.message, result.saved ? '' : 'error');
    });
  };
  buttonNode.onpointercancel = () => {
    const press = browseAnchorPress?.button === buttonNode ? browseAnchorPress : null;
    const savePromise = press?.savePromise || null;
    cancelBrowseAnchorPress({ suppressClick: true, grace: Boolean(press?.fired) });
    if (savePromise) savePromise.then(({ error }) => { if (error) displayError(error); });
  };
  buttonNode.onlostpointercapture = () => {
    if (browseAnchorPress?.button === buttonNode) cancelBrowseAnchorPress({ suppressClick: browseAnchorPress.fired, grace: browseAnchorPress.fired });
  };
  buttonNode.oncontextmenu = (event) => event.preventDefault();
  buttonNode.onclick = (event) => {
    if (Date.now() < browseAnchorSuppressClickUntil) {
      event.preventDefault();
      return;
    }
    const target = browseAnchorEntryId(collection, section);
    if (target) jumpToEntry(target, { collectionId: collection.id, reason: 'last' });
    else showToast('长按此按钮保存当前位置');
  };
}

function renderBottomToolbar(collection, section = currentViewKind) {
  const mode = currentMode(collection, section);
  const lastButton = elements['bottom-last-position'];
  lastButton.replaceChildren(svgIcon('target'));
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
  const domain = collection.domainId ? getState().domainById.get(collection.domainId) : null;
  const canSwitch = collection.type === 'normal' && domain?.contentMode !== 'nonStructured';
  const nextKind = section === 'word' ? 'phrase' : 'word';
  switchButton.replaceChildren(svgIcon(section === 'content' ? 'phrase' : (nextKind === 'phrase' ? 'phrase' : 'word')));
  switchButton.disabled = !canSwitch;
  switchButton.title = canSwitch ? `切换到${nextKind === 'phrase' ? '短语' : '词汇'}视图` : (section === 'content' ? '非结构内容不按词汇或短语分页' : '系统总表已按内容类型固定');
  switchButton.setAttribute('aria-label', switchButton.title);
  switchButton.onclick = canSwitch ? () => switchCollectionView(collection, nextKind).catch(displayError) : null;

  elements['bottom-search'].replaceChildren(svgIcon('search'));
  elements['bottom-search'].onclick = openSearchDialog;
  updateBackToTopVisibility();
}

async function switchCollectionView(collection, nextKind) {
  if (bufferedStateCommitInProgress) return;
  if (collection.type !== 'normal' || !['word', 'phrase'].includes(nextKind) || nextKind === currentViewKind) return;
  const target = transientViewSwitchTarget(nextKind);
  collapseTransactionRevision += 1;
  const previousKind = currentViewKind;
  expandedLettersFor(collection.id, previousKind).clear();
  clearExpandedRelationsForView(collection.id, previousKind);
  expandedLettersFor(collection.id, nextKind).clear();
  clearExpandedRelationsForView(collection.id, nextKind);
  currentViewKind = nextKind;
  activeSection = nextKind;
  pendingPageSnapshot = null;
  pendingJumpEntryId = '';
  pendingJumpReason = 'jump';
  suppressScrollPersistence(700);
  const mode = getViewMode(collection.id);
  const freshMonth = mode === 'date'
    ? (target.calendarMonth || initialCalendarMonthForView(collection.id, nextKind))
    : '';
  if (mode === 'date') hydrateRuntimeViewState(collection.id, { mode, section: nextKind, calendarMonth: freshMonth });
  const frame = currentNavigationFrame();
  if (frame) frame.viewKind = nextKind;

  navigationTraversalInProgress = true;
  try {
    await runBufferedCollectionCommit(() => renderApp(), {
      position: target.position,
      source: `view-switch-${previousKind}-to-${nextKind}`,
      outMs: 38,
      inMs: 54,
    });
  } finally {
    navigationTraversalInProgress = false;
  }
  if (mode === 'date' && freshMonth) {
    presentationMutationInProgress += 1;
    try { await setCalendarMonth(collection.id, nextKind, freshMonth); }
    finally { presentationMutationInProgress = Math.max(0, presentationMutationInProgress - 1); }
  }
  persistCurrentHistorySnapshot();
}

function sectionForEntry(entry) {
  return entry?.kind === 'phrase' ? 'phrase' : entry?.kind === 'content' ? 'content' : 'word';
}

function isCompositeCollection(collection) {
  return collection?.type === 'normal';
}

function isPhraseCollection(collection) {
  return collection?.type === 'system-phrases' || collection?.type === 'system-global-phrases';
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

function setContextDockVisible(node, appClass, visible, { clearAfterHide = false } = {}) {
  if (!node) return;
  const pending = dockHideTimers.get(node);
  if (pending) {
    clearTimeout(pending);
    dockHideTimers.delete(node);
  }
  node.classList.remove('hidden');
  if (visible) {
    node.inert = false;
    node.setAttribute('aria-hidden', 'false');
    elements.app?.classList.add(appClass);
    requestAnimationFrame(() => node.classList.add('dock-visible'));
    updateOverlayLayout();
    return;
  }
  node.classList.remove('dock-visible');
  node.inert = true;
  node.setAttribute('aria-hidden', 'true');
  const timer = window.setTimeout(() => {
    dockHideTimers.delete(node);
    if (!node.classList.contains('dock-visible')) {
      elements.app?.classList.remove(appClass);
      if (clearAfterHide) node.replaceChildren();
      updateOverlayLayout();
    }
  }, DOCK_EXIT_MS);
  dockHideTimers.set(node, timer);
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
    setContextDockVisible(elements['pin-bar'], 'has-pin', false, { clearAfterHide: !pins.length });
    if (!pins.length) pinIndex = 0;
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
  elements['pin-bar'].replaceChildren(
    iconButton('chevron', 'pin-nav-button pin-prev', '上一个 PIN', () => jumpPinned(collection.id, -1)),
    el('button', { type: 'button', className: 'pin-current', 'aria-label': '重新定位当前 PIN', on: { click: () => entry && jumpToEntry(entry.id, { reason: 'pin' }) } }, [
      el('span', { className: 'pin-kicker', text: `PIN ${pinIndex + 1}/${pins.length}` }),
      el('strong', { text: [entry?.text || 'PIN 已失效', pinDomainLabel].filter(Boolean).join(' · ') }),
    ]),
    iconButton('chevron', 'pin-nav-button pin-next', '下一个 PIN', () => jumpPinned(collection.id, 1)),
  );
  setContextDockVisible(elements['pin-bar'], 'has-pin', true);
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

function initialCalendarMonthForView(collectionId, section) {
  const months = entriesForCollectionView(collectionId, section)
    .map((entry) => getStudyStamp(entry, collectionId)?.reviewDateKey?.slice(0, 7) || '')
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));
  return months[0] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
}

function switchAnchorOffset(position) {
  return Number.isFinite(Number(position?.offsetFromContentTop)) ? Number(position.offsetFromContentTop) : 0;
}

function readingDateKeyForPosition(position, section = currentViewKind) {
  if (position?.kind === 'entry' && position.entryId) {
    const entry = getState().entryById.get(position.entryId);
    if (entry) return getStudyStamp(entry, currentCollectionId)?.reviewDateKey || 'unmarked';
  }
  if (position?.kind === 'section' && position.sectionId) {
    const node = document.getElementById(position.sectionId);
    if (node?.dataset?.date) return node.dataset.date;
    if (node?.classList?.contains('date-unmarked-section')) return 'unmarked';
  }
  const bounds = readingViewportBounds();
  const probe = document.elementFromPoint(Math.max(24, window.innerWidth * .22), Math.min(bounds.bottom - 2, bounds.top + 8));
  const sectionNode = probe?.closest?.(`.date-day-section[data-section="${section}"], .date-unmarked-section[data-section="${section}"]`);
  if (sectionNode instanceof HTMLElement && sectionNode.dataset.date) return sectionNode.dataset.date;
  if (sectionNode?.classList?.contains('date-unmarked-section')) return 'unmarked';
  return '';
}

function nearestAlphabetGroup(entries, preferredLetter = '') {
  if (!entries.length) return '';
  const available = [...new Set(entries.map(letterForEntry))];
  if (available.includes(preferredLetter)) return preferredLetter;
  const preferredOrdinal = alphabetOrdinal(preferredLetter);
  if (preferredOrdinal < 0) return available[0] || '';
  return available.sort((a, b) => {
    const da = Math.abs(alphabetOrdinal(a) - preferredOrdinal);
    const db = Math.abs(alphabetOrdinal(b) - preferredOrdinal);
    return da - db || alphabetOrdinal(a) - alphabetOrdinal(b);
  })[0] || '';
}

function nearestDateGroup(entries, preferredDate = '') {
  if (!entries.length) return '';
  const keys = [...new Set(entries.map((entry) => getStudyStamp(entry, currentCollectionId)?.reviewDateKey || 'unmarked'))];
  if (keys.includes(preferredDate)) return preferredDate;
  if (preferredDate === 'unmarked' && keys.includes('unmarked')) return 'unmarked';
  const preferredTime = /^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ? Date.parse(`${preferredDate}T00:00:00`) : Number.NaN;
  const dated = keys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  if (Number.isFinite(preferredTime) && dated.length) {
    return dated.sort((a, b) => Math.abs(Date.parse(`${a}T00:00:00`) - preferredTime) - Math.abs(Date.parse(`${b}T00:00:00`) - preferredTime) || b.localeCompare(a))[0];
  }
  return dated.sort((a, b) => b.localeCompare(a))[0] || (keys.includes('unmarked') ? 'unmarked' : keys[0] || '');
}

function entryAnchorForGroup(entries, key, mode, position) {
  const candidates = entries.filter((entry) => mode === 'alphabet'
    ? letterForEntry(entry) === key
    : (getStudyStamp(entry, currentCollectionId)?.reviewDateKey || 'unmarked') === key)
    .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  const entry = candidates[0] || entries[0] || null;
  if (!entry) return { kind: 'top', scrollYFallback: 0 };
  return {
    kind: 'entry', entryId: entry.id,
    offsetFromContentTop: switchAnchorOffset(position),
    scrollYFallback: Math.max(0, Number(position?.scrollYFallback || window.scrollY || 0)),
  };
}

function transientModeSwitchAnchor(section = currentViewKind) {
  const position = captureSemanticPosition();
  if (['top', 'bottom'].includes(position?.kind)) return position;
  if (position?.kind === 'entry' && position.entryId) return position;
  const entries = entriesForCollectionView(currentCollectionId, section);
  const mode = getViewMode(currentCollectionId);
  if (mode === 'alphabet') {
    const letter = activeAlphabetMetricAtReadingBoundary(section)?.letter || nearestAlphabetGroup(entries, 'A');
    return entryAnchorForGroup(entries, letter, 'alphabet', position);
  }
  const dateKey = readingDateKeyForPosition(position, section) || nearestDateGroup(entries, '');
  return entryAnchorForGroup(entries, dateKey, 'date', position);
}

function transientViewSwitchTarget(nextKind) {
  const position = captureSemanticPosition();
  if (['top', 'bottom'].includes(position?.kind)) return { position, calendarMonth: '' };
  const entries = entriesForCollectionView(currentCollectionId, nextKind);
  if (!entries.length) return { position: { kind: 'top', scrollYFallback: 0 }, calendarMonth: '' };
  const mode = getViewMode(currentCollectionId);
  if (mode === 'alphabet') {
    let preferredLetter = '';
    if (position?.kind === 'entry' && position.entryId) {
      const source = getState().entryById.get(position.entryId);
      if (source) preferredLetter = letterForEntry(source);
    }
    preferredLetter ||= activeAlphabetMetricAtReadingBoundary(currentViewKind)?.letter || '';
    const key = nearestAlphabetGroup(entries, preferredLetter);
    return { position: entryAnchorForGroup(entries, key, 'alphabet', position), calendarMonth: '' };
  }
  const preferredDate = readingDateKeyForPosition(position, currentViewKind);
  const key = nearestDateGroup(entries, preferredDate);
  return {
    position: entryAnchorForGroup(entries, key, 'date', position),
    calendarMonth: /^\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(0, 7) : '',
  };
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
  if (bufferedStateCommitInProgress) return;
  const currentModeValue = getViewMode(collection.id);
  const nextMode = currentModeValue === 'date' ? 'alphabet' : 'date';
  const anchor = transientModeSwitchAnchor(section);
  collapseTransactionRevision += 1;
  expandedLettersFor(collection.id, section).clear();
  clearExpandedRelationsForView(collection.id, section);
  pendingPageSnapshot = null;
  pendingJumpEntryId = '';
  pendingJumpReason = 'jump';
  suppressScrollPersistence(800);

  let nextMonth = '';
  if (nextMode === 'date') {
    const anchorEntry = anchor?.kind === 'entry' ? getState().entryById.get(anchor.entryId) : null;
    nextMonth = getStudyStamp(anchorEntry, collection.id)?.reviewDateKey?.slice(0, 7)
      || initialCalendarMonthForView(collection.id, section);
  }

  hydrateRuntimeViewState(collection.id, { mode: nextMode, section, calendarMonth: nextMonth });
  navigationTraversalInProgress = true;
  try {
    await runBufferedCollectionCommit(() => renderApp(), {
      position: anchor,
      source: `mode-switch-${currentModeValue}-to-${nextMode}`,
      outMs: 44,
      inMs: 62,
    });
  } finally {
    navigationTraversalInProgress = false;
  }

  presentationMutationInProgress += 1;
  try {
    if (nextMode === 'date' && nextMonth) await setCalendarMonth(collection.id, section, nextMonth);
    await setViewMode(collection.id, nextMode);
  } finally {
    presentationMutationInProgress = Math.max(0, presentationMutationInProgress - 1);
  }
  persistCurrentHistorySnapshot();
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
      setDateSectionOpen(section, dateKey, true, { persist: false });
      const target = document.getElementById(dateAnchorId(section, dateKey));
      if (!target) return;
      activeSection = section;
      suppressScrollPersistence(500);
      positionHeadingBelowChrome(target);
    }, { disabled: !enabled, title: enabled ? `跳到 ${dateKey}` : '该日没有记录' }));
  }
  const calendar = el('section', { className: 'study-calendar', dataset: { section, month: monthKey }, 'aria-label': `${year} 年 ${month} 月学习日期` }, [
    el('header', { className: 'calendar-header' }, [
      iconButton('chevrons', 'calendar-prev-year', '上一年', async () => {
        const next = monthShift(monthKey, -12);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      iconButton('chevron', 'calendar-prev', '上个月', async () => {
        const next = monthShift(monthKey, -1);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      el('strong', { text: `${year} 年 ${month} 月` }),
      iconButton('chevron', 'calendar-next', '下个月', async () => {
        const next = monthShift(monthKey, 1);
        await setCalendarMonth(collection.id, section, next);
        calendar.replaceWith(calendarForSection(collection, section, dates));
      }),
      iconButton('chevrons', 'calendar-next-year', '下一年', async () => {
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

async function jumpToAlphabetLetter(section, letter, sectionContext) {
  const target = sectionContext?.sectionByKey.get(letter);
  if (!target) return false;
  activeSection = section;
  releaseLetterTrackManualLock(section, { follow: false });
  setLetterSectionOpen(section, letter, true, { persist: false });
  updateOverlayLayout({ immediate: true });
  refreshAlphabetSectionMetrics();
  const position = {
    kind: 'section',
    sectionId: target.id,
    offsetFromContentTop: 0,
    scrollYFallback: window.scrollY,
  };
  const ok = await animateRootToSemanticPosition(position, {
    owner: 'letter-jump',
    source: `letter-jump-${letter}`,
    targetSemantic: alphabetOrdinal(letter),
  });
  if (ok) {
    updateActiveLetter(section, letter, { ensureVisible: true, force: true });
    scheduleAlphabetSectionMetricsRefresh();
  }
  return ok;
}

function navigationControls(collection, section, sectionContext, mode) {
  const track = [];
  if (mode === 'alphabet') {
    elements['collection-view'].classList.add('has-letter-nav');
    for (const letter of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']) {
      const enabled = sectionContext.grouped.has(letter);
      const control = button(letter, enabled ? '' : 'empty', () => {
        if (!enabled) return;
        jumpToAlphabetLetter(section, letter, sectionContext).catch(displayError);
      }, { disabled: !enabled });
      control.dataset.letter = letter;
      control.dataset.section = section;
      track.push(control);
    }
  }
  return { fixed: [], track };
}

function populateNavigationBar(nav, controls) {
  const track = el('div', { className: 'letter-nav-track' }, controls.track);
  const trackState = {
    programmaticUntil: 0,
    pointerActive: false,
    manualLocked: false,
    manualLockScrollY: 0,
    cameraFrame: 0,
    cameraTarget: 0,
    cameraLastAt: 0,
    activeLetter: '',
    activeSection: '',
  };
  letterTrackStates.set(track, trackState);
  const lockManualPosition = () => {
    if (trackState.cameraFrame) cancelAnimationFrame(trackState.cameraFrame);
    trackState.cameraFrame = 0;
    trackState.manualLocked = true;
    trackState.manualLockScrollY = window.scrollY;
  };
  track.addEventListener('pointerdown', () => {
    trackState.pointerActive = true;
    lockManualPosition();
  }, { passive: true });
  track.addEventListener('pointerup', () => {
    trackState.pointerActive = false;
  }, { passive: true });
  track.addEventListener('pointercancel', () => {
    trackState.pointerActive = false;
  }, { passive: true });
  track.addEventListener('scroll', () => {
    if (Date.now() < trackState.programmaticUntil || trackState.pointerActive) return;
    lockManualPosition();
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
  return { section, entries, grouped, dateGroups: new Map(), sectionByKey: new Map(), root: null, dates };
}

function currentVirtualLayoutCache() {
  const frame = currentNavigationFrame();
  if (!frame) return null;
  if (!(frame.virtualLayoutCache instanceof Map)) frame.virtualLayoutCache = new Map();
  const width = Math.round(elements['entry-list']?.clientWidth || elements['collection-view']?.clientWidth || window.innerWidth || 0);
  if (!frame.virtualLayoutWidth) frame.virtualLayoutWidth = width;
  else if (width && Math.abs(Number(frame.virtualLayoutWidth || 0) - width) > 2) {
    frame.virtualLayoutCache.clear();
    frame.virtualLayoutWidth = width;
  }
  return frame.virtualLayoutCache;
}

function resetEntryChunking() {
  entryChunkObserver?.disconnect();
  entryChunkObserver = null;
  entryChunkResizeObserver?.disconnect();
  entryChunkResizeObserver = null;
  if (virtualMaterializeFrame) cancelAnimationFrame(virtualMaterializeFrame);
  virtualMaterializeFrame = 0;
  queuedVirtualChunks.clear();
  pendingVirtualAnchor = null;
  entryChunkByEntryId.clear();
}

function measureEntryChunk(chunk) {
  const data = entryChunkData.get(chunk);
  if (!data || data.renderToken !== renderRevision || chunk.dataset.rendered !== 'true' || !chunk.isConnected) return 0;
  const height = chunk.getBoundingClientRect().height;
  if (!Number.isFinite(height) || height <= 0) return 0;
  data.measuredBlockSize = height;
  data.layoutCache?.set(data.chunkKey, height);
  chunk.dataset.measuredHeight = height.toFixed(2);
  return height;
}

function ensureEntryChunkResizeObserver() {
  if (entryChunkResizeObserver || !('ResizeObserver' in window)) return entryChunkResizeObserver;
  entryChunkResizeObserver = new ResizeObserver((records) => {
    for (const record of records) {
      const chunk = record.target;
      if (!(chunk instanceof HTMLElement)) continue;
      measureEntryChunk(chunk);
    }
  });
  return entryChunkResizeObserver;
}

function materializeEntryChunk(chunk, { reason = 'materialize' } = {}) {
  const data = entryChunkData.get(chunk);
  if (!data || data.renderToken !== renderRevision || chunk.dataset.rendered === 'true') return false;
  chunk.dataset.rendered = 'true';
  const rows = data.items.map(({ entry, groupIndex }) => renderEntryRow(entry, data.collection, data.domain, {
    groupIndex,
    globalIndex: data.globalIndexById.get(entry.id) || groupIndex,
  }));
  chunk.replaceChildren(...rows);
  chunk.style.minHeight = '';
  entryChunkObserver?.unobserve(chunk);
  ensureEntryChunkResizeObserver()?.observe(chunk);
  appendScrollTrace('materialize', {
    epoch: scrollCoordinator.current()?.epoch || 0,
    owner: scrollCoordinator.current()?.owner || '',
    reason,
    chunkKey: data.chunkKey,
    scrollY: window.scrollY,
  });
  requestAnimationFrame(() => {
    if (data.renderToken !== renderRevision || chunk.dataset.rendered !== 'true') return;
    measureEntryChunk(chunk);
  });
  return true;
}

function flushQueuedVirtualChunksNow({ reason = 'observer-flush' } = {}) {
  if (virtualMaterializeFrame) cancelAnimationFrame(virtualMaterializeFrame);
  virtualMaterializeFrame = 0;
  const chunks = [...queuedVirtualChunks].filter((chunk) => chunk?.isConnected && chunk.dataset.rendered !== 'true');
  queuedVirtualChunks.clear();
  if (!chunks.length) return false;

  let transaction = null;
  if (!scrollCoordinator.isActive() && !rootUserScrollActive) {
    pendingVirtualAnchor = captureSemanticPosition();
    transaction = beginRootScrollTransaction('virtual-materialize', pendingVirtualAnchor);
  }

  let changed = false;
  for (const chunk of chunks) changed = materializeEntryChunk(chunk, { reason }) || changed;
  if (transaction && changed) {
    const epoch = transaction.epoch;
    requestAnimationFrame(async () => {
      if (!scrollCoordinator.owns(epoch)) return;
      await settleSemanticPosition(epoch, pendingVirtualAnchor, { maxFrames: 4, tolerance: 1, source: 'virtual-materialize' });
      pendingVirtualAnchor = null;
      finishRootScrollTransaction(epoch, { persist: false });
    });
  } else if (transaction) {
    pendingVirtualAnchor = null;
    finishRootScrollTransaction(transaction.epoch, { persist: false });
  }
  return changed;
}

function scheduleVirtualMaterializeFlush() {
  if (virtualMaterializeFrame) return;
  virtualMaterializeFrame = requestAnimationFrame(() => flushQueuedVirtualChunksNow());
}

function ensureEntryChunkObserver() {
  if (entryChunkObserver || !('IntersectionObserver' in window)) return entryChunkObserver;
  entryChunkObserver = new IntersectionObserver((records) => {
    for (const record of records) {
      if (record.isIntersecting && record.target instanceof HTMLElement && record.target.dataset.rendered !== 'true') queuedVirtualChunks.add(record.target);
    }
    if (queuedVirtualChunks.size) scheduleVirtualMaterializeFlush();
  }, { rootMargin: '960px 0px 960px' });
  return entryChunkObserver;
}

function materializeChunksNearViewport({ reason = 'near-viewport' } = {}) {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
  let changed = false;
  for (const chunk of elements['entry-list'].querySelectorAll('.entry-chunk[data-rendered="false"]')) {
    const rect = chunk.getBoundingClientRect();
    if (rect.bottom < viewportTop - 960 || rect.top > viewportBottom + 960) continue;
    queuedVirtualChunks.delete(chunk);
    changed = materializeEntryChunk(chunk, { reason }) || changed;
  }
  return changed;
}

function renderEntryChunks(entries, collection, domain, globalIndexById, {
  startIndex = 1,
  renderFirst = true,
  groupIndexById = null,
  virtualGroupKey = 'group',
} = {}) {
  const fragment = document.createDocumentFragment();
  const layoutCache = currentVirtualLayoutCache();
  const mode = getViewMode(collection.id);
  for (let offset = 0; offset < entries.length; offset += ENTRY_CHUNK_SIZE) {
    const slice = entries.slice(offset, offset + ENTRY_CHUNK_SIZE);
    const chunkIndex = Math.floor(offset / ENTRY_CHUNK_SIZE);
    const chunkKey = `${collection.id}\u0000${currentViewKind}\u0000${mode}\u0000${virtualGroupKey}\u0000${chunkIndex}`;
    const chunk = el('div', { className: 'entry-chunk', dataset: { rendered: 'false', chunkIndex: String(chunkIndex) } });
    const items = slice.map((entry, index) => ({ entry, groupIndex: groupIndexById?.get(entry.id) || startIndex + offset + index }));
    entryChunkData.set(chunk, { items, collection, domain, globalIndexById, renderToken: renderRevision, chunkKey, layoutCache, measuredBlockSize: 0 });
    for (const { entry } of items) entryChunkByEntryId.set(entry.id, chunk);
    const estimatedHeight = slice.reduce((total, entry) => {
      const gloss = displayGlossForEntry(entry, collection, domain);
      const kind = entryLayoutKind(entry, gloss);
      const hasMeta = Boolean(gloss || sourceDomainLabelForEntry(entry, collection));
      const rowHeight = ['phrase-extreme', 'content-extreme', 'phrase-two-line', 'content-two-line'].includes(kind)
        ? (hasMeta ? 64 : 58)
        : hasMeta ? 54 : ENTRY_ROW_ESTIMATE;
      const relationHeight = expandedRelations.has(relationExpansionKey(collection.id, entry.id))
        ? Math.max(0, relationItemsForEntry(entry).length * 42 + 8)
        : 0;
      return total + rowHeight + relationHeight;
    }, 0);
    const cachedHeight = Number(layoutCache?.get(chunkKey) || 0);
    chunk.style.minHeight = `${cachedHeight > 0 ? cachedHeight : estimatedHeight}px`;
    fragment.append(chunk);
    if (renderFirst && offset === 0) materializeEntryChunk(chunk, { reason: 'first-chunk' });
    else {
      const observer = ensureEntryChunkObserver();
      if (observer) observer.observe(chunk);
      else materializeEntryChunk(chunk, { reason: 'no-observer' });
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

function sourceDomainLabelForEntry(entry, collection) {
  const state = getState();
  const conflictKey = `${entry.kind}\u0000${entry.normalizedText}`;
  return isGlobalCollection(collection) && state.globalConflictKeys.has(conflictKey)
    ? (state.domainById.get(entry.domainId)?.name || entry.domainId)
    : '';
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
    const flowAnchor = el('span', { className: 'section-flow-anchor', 'aria-hidden': 'true' });
    const heading = button('', 'letter-heading', (event) => toggleLetterSectionWithAnchor(section, letter, event.currentTarget));
    heading.setAttribute('aria-expanded', expandedLetters.has(letter) ? 'true' : 'false');
    heading.append(
      el('span', { className: 'letter-title', text: letter }),
      el('span', { className: 'letter-count', text: uniqueEntryCountForDisplay(sectionContext.grouped.get(letter), collection).toLocaleString() }),
      el('span', { className: 'letter-indicator' }, [svgIcon('chevron')]),
    );
    sectionNode.append(flowAnchor, heading);
    if (expandedLetters.has(letter)) {
      const body = el('div', { className: 'letter-body' });
      const groupEntries = sectionContext.grouped.get(letter);
      body.append(renderEntryChunks(groupEntries, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(groupEntries, collection), virtualGroupKey: `alphabet:${section}:${letter}` }));
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
  const expandedGroups = expandedLettersFor(collection.id, section);
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
    const expansionKey = dateExpansionKey(dateKey);
    const open = expandedGroups.has(expansionKey);
    const heading = button('', 'date-day-title', (event) => toggleDateSectionWithAnchor(section, dateKey, event.currentTarget));
    heading.setAttribute('aria-expanded', open ? 'true' : 'false');
    heading.append(
      el('span', { className: 'date-group-title', text: `${Number(day)} 日` }),
      el('span', { className: 'date-group-count', text: uniqueEntryCountForDisplay(entries, collection).toLocaleString() }),
      el('span', { className: `date-group-indicator${open ? ' open' : ''}` }, [svgIcon('chevron')]),
    );
    const flowAnchor = el('span', { className: 'section-flow-anchor', 'aria-hidden': 'true' });
    const daySection = el('section', { className: 'date-day-section', id: dateAnchorId(section, dateKey), dataset: { date: dateKey, section } }, [flowAnchor, heading]);
    if (open) {
      const dayBody = el('div', { className: 'letter-body date-day-body' });
      dayBody.append(renderEntryChunks(entries, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(entries, collection), virtualGroupKey: `date:${section}:${dateKey}` }));
      daySection.append(dayBody);
    }
    root.append(daySection);
    sectionContext.dateGroups.set(dateKey, entries);
    sectionContext.sectionByKey.set(dateKey, daySection);
  }
  unmarked.sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en'));
  if (unmarked.length) {
    const expansionKey = dateExpansionKey('unmarked');
    const open = expandedGroups.has(expansionKey);
    const heading = button('', 'date-unmarked-heading', (event) => toggleDateSectionWithAnchor(section, 'unmarked', event.currentTarget));
    heading.setAttribute('aria-expanded', open ? 'true' : 'false');
    heading.append(
      el('span', { className: 'date-group-title', text: '未标注' }),
      el('span', { className: 'date-group-count', text: uniqueEntryCountForDisplay(unmarked, collection).toLocaleString() }),
      el('span', { className: `date-group-indicator${open ? ' open' : ''}` }, [svgIcon('chevron')]),
    );
    const flowAnchor = el('span', { className: 'section-flow-anchor', 'aria-hidden': 'true' });
    const unmarkedSection = el('section', { className: 'date-unmarked-section', id: `unmarked-${section}`, dataset: { section } }, [flowAnchor, heading]);
    if (open) {
      const unmarkedBody = el('div', { className: 'letter-body unmarked-body' });
      unmarkedBody.append(renderEntryChunks(unmarked, collection, domain, globalIndexById, { groupIndexById: groupedNumberIndex(unmarked, collection), virtualGroupKey: `date:${section}:unmarked` }));
      unmarkedSection.append(unmarkedBody);
    }
    root.append(unmarkedSection);
    sectionContext.dateGroups.set('unmarked', unmarked);
    sectionContext.sectionByKey.set('unmarked', unmarkedSection);
  }
  if (!dates.length && !unmarked.length) root.append(el('div', { className: 'empty-state compact-empty', text: section === 'word' ? '暂无词汇' : '暂无短语' }));
  sectionContext.root = root;
  return root;
}

function renderEntryList(collection, domain, entries, section = currentViewKind) {
  resetEntryChunking();
  alphabetSectionMetrics = [];
  collectionRenderContext = null;
  const mode = getViewMode(collection.id);
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
    elements['letter-nav'].setAttribute('aria-label', `${section === 'word' ? '词汇' : section === 'phrase' ? '短语' : '内容'}字母索引`);
    populateNavigationBar(elements['letter-nav'], navigationControls(collection, section, sectionContext, mode));
  } else {
    elements['letter-nav'].classList.add('hidden');
    elements['letter-nav'].replaceChildren();
  }

  const output = [];
  if (mode === 'date') output.push(calendarForSection(collection, section, sectionContext.dates));
  output.push(mode === 'date' ? renderDateContent(context, sectionContext) : renderAlphabetContent(context, sectionContext));
  elements['entry-list'].replaceChildren(...output);
  alphabetResizeObserver?.disconnect();
  if (mode === 'alphabet') ensureAlphabetResizeObserver()?.observe(elements['entry-list']);
  updateBackToTopVisibility();
  // Seal one ChromeGeometry snapshot before the first live Collection frame.
  // Sticky CSS and active-letter tracking therefore see the same ContentTop.
  updateOverlayLayout({ immediate: true });
  if (mode === 'alphabet') refreshAlphabetSectionMetrics();
}

function releaseChunksInBody(body) {
  if (!body) return;
  for (const chunk of body.querySelectorAll('.entry-chunk')) {
    entryChunkObserver?.unobserve(chunk);
    entryChunkResizeObserver?.unobserve(chunk);
    queuedVirtualChunks.delete(chunk);
    const data = entryChunkData.get(chunk);
    for (const item of data?.items || []) {
      if (entryChunkByEntryId.get(item.entry.id) === chunk) entryChunkByEntryId.delete(item.entry.id);
    }
  }
}

function setDateSectionOpen(section, dateKey, open, { persist = true } = {}) {
  const context = collectionRenderContext;
  if (!context || context.collection.id !== currentCollectionId || context.mode !== 'date') return false;
  const sectionContext = context.sections.get(section);
  const sectionNode = sectionContext?.sectionByKey.get(dateKey);
  const entries = sectionContext?.dateGroups.get(dateKey);
  if (!sectionNode || !entries) return false;
  const expandedGroups = expandedLettersFor(currentCollectionId, section);
  const expansionKey = dateExpansionKey(dateKey);
  const heading = sectionNode.querySelector('.date-day-title, .date-unmarked-heading');
  const indicator = sectionNode.querySelector('.date-group-indicator');
  let body = sectionNode.querySelector('.date-day-body, .unmarked-body');
  if (open) {
    expandedGroups.add(expansionKey);
    if (!body) {
      body = el('div', { className: `letter-body ${dateKey === 'unmarked' ? 'unmarked-body' : 'date-day-body'}` });
      body.append(renderEntryChunks(entries, context.collection, context.domain, context.globalIndexById, {
        groupIndexById: groupedNumberIndex(entries, context.collection),
        virtualGroupKey: `date:${section}:${dateKey}`,
      }));
      sectionNode.append(body);
    }
  } else {
    expandedGroups.delete(expansionKey);
    if (body) {
      releaseChunksInBody(body);
      body.remove();
    }
  }
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  indicator?.classList.toggle('open', open);
  if (persist) persistCurrentHistorySnapshot();
  return true;
}

function waitForRootScrollSettle(targetY, timeoutMs = 260) {
  const root = document.scrollingElement || document.documentElement;
  const settled = () => Math.abs(window.scrollY - targetY) <= .5
    || Math.abs(root.scrollTop - targetY) <= .5;
  if (settled()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    let timer = 0;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('scrollend', onScrollEnd);
      resolve();
    };
    const onScrollEnd = () => finish();
    if ('onscrollend' in window) window.addEventListener('scrollend', onScrollEnd, { once: true });
    else requestAnimationFrame(() => requestAnimationFrame(finish));
    timer = window.setTimeout(finish, timeoutMs);
  });
}

function stickyCollapseGeometry(sectionNode, heading) {
  const flowAnchor = sectionNode?.querySelector(':scope > .section-flow-anchor');
  const body = sectionNode?.querySelector(':scope > .letter-body, :scope > .date-day-body, :scope > .unmarked-body');
  if (!flowAnchor || !heading || !body) return null;
  const headingRect = heading.getBoundingClientRect();
  const flowRect = flowAnchor.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  if (![headingRect.top, flowRect.top, bodyRect.height].every(Number.isFinite)) return null;
  const scroller = document.scrollingElement || document.documentElement;
  return computeStickyCollapseTarget({
    currentY: Math.max(0, Number(window.scrollY || scroller.scrollTop || 0)),
    flowTop: flowRect.top,
    visualTop: headingRect.top,
    bodyHeight: bodyRect.height,
    scrollHeight: Number(scroller.scrollHeight || 0),
    clientHeight: Number(scroller.clientHeight || window.innerHeight || 0),
  });
}

async function runStickyCollapseTransaction({ sectionNode, heading, collapse, transaction, scrollEpoch, previousOverflowAnchor }) {
  const root = document.documentElement;
  try {
    const geometry = stickyCollapseGeometry(sectionNode, heading);
    if (!geometry || transaction !== collapseTransactionRevision || !heading.isConnected || !scrollCoordinator.owns(scrollEpoch)) return;
    const commitCollapse = () => {
      if (transaction !== collapseTransactionRevision || !heading.isConnected || !scrollCoordinator.owns(scrollEpoch)) return;
      collapse();
    };

    // No physical scroll means no compositor coupling is needed at all.
    if (Math.abs(geometry.delta) <= .5) {
      commitCollapse();
      return;
    }

    // On engines with View Transitions, use the API only for its rendering
    // suppression contract: scroll while the old full layout still exists,
    // wait for that programmatic root scroll to settle, then remove the body.
    // This avoids the iOS/WebKit failure shape "layout shrink + scrollTo in the
    // same compositor commit" without introducing a visual animation.
    if (typeof document.startViewTransition === 'function') {
      root.classList.add('sticky-collapse-transition');
      const transition = document.startViewTransition(async () => {
        if (transaction !== collapseTransactionRevision || !heading.isConnected || !scrollCoordinator.owns(scrollEpoch)) return;
        rootScrollToY(geometry.targetY, { epoch: scrollEpoch, source: 'sticky-collapse' });
        await waitForRootScrollSettle(geometry.targetY);
        commitCollapse();
      });
      await transition.updateCallbackDone;
      await transition.finished.catch(() => {});
      root.classList.remove('sticky-collapse-transition');
      return;
    }

    // Compatibility fallback for engines without View Transitions: split the
    // two writes into ordered phases rather than recreating the 4.4.0
    // synchronous mutation+scroll trigger.
    rootScrollToY(geometry.targetY, { epoch: scrollEpoch, source: 'sticky-collapse-fallback' });
    await waitForRootScrollSettle(geometry.targetY);
    commitCollapse();
  } finally {
    if (transaction === collapseTransactionRevision) {
      root.style.overflowAnchor = previousOverflowAnchor;
      if (scrollCoordinator.owns(scrollEpoch)) finishRootScrollTransaction(scrollEpoch, { persist: true });
      else persistCurrentHistorySnapshot();
      syncActiveAlphabetHeading();
    }
    root.classList.remove('sticky-collapse-transition');
  }
}

function collapseNativeStickySection({ sectionNode, heading, collapse }) {
  if (!sectionNode || !heading || typeof collapse !== 'function') return false;
  const root = document.documentElement;
  const previousOverflowAnchor = root.style.overflowAnchor;
  const transaction = ++collapseTransactionRevision;
  const scrollTransaction = beginRootScrollTransaction('sticky-collapse', null);
  root.style.overflowAnchor = 'none';
  runStickyCollapseTransaction({ sectionNode, heading, collapse, transaction, scrollEpoch: scrollTransaction.epoch, previousOverflowAnchor }).catch((error) => {
    root.style.overflowAnchor = previousOverflowAnchor;
    root.classList.remove('sticky-collapse-transition');
    if (scrollCoordinator.owns(scrollTransaction.epoch)) finishRootScrollTransaction(scrollTransaction.epoch, { persist: false });
    displayError(error);
  });
  return true;
}

function toggleDateSectionWithAnchor(section, dateKey, heading) {
  const context = collectionRenderContext;
  if (!context || context.mode !== 'date') return;
  const expansionKey = dateExpansionKey(dateKey);
  const open = !expandedLettersFor(currentCollectionId, section).has(expansionKey);
  if (open) {
    collapseTransactionRevision += 1;
    setDateSectionOpen(section, dateKey, true);
    return;
  }
  const sectionNode = context.sections.get(section)?.sectionByKey.get(dateKey);
  collapseNativeStickySection({
    sectionNode,
    heading,
    collapse: () => setDateSectionOpen(section, dateKey, false, { persist: false }),
  });
}

function setLetterSectionOpen(section, letter, open, { persist = true } = {}) {
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
      body.append(renderEntryChunks(entries, context.collection, context.domain, context.globalIndexById, { groupIndexById: groupedNumberIndex(entries, context.collection), virtualGroupKey: `alphabet:${section}:${letter}` }));
      sectionNode.append(body);
    }
  } else {
    expandedLetters.delete(letter);
    if (body) {
      releaseChunksInBody(body);
      body.remove();
    }
  }
  heading?.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (indicator) indicator.classList.toggle('open', open);
  scheduleAlphabetSectionMetricsRefresh();
  if (persist) persistCurrentHistorySnapshot();
  return true;
}

function toggleLetterSectionWithAnchor(section, letter, heading) {
  const context = collectionRenderContext;
  if (!context || context.mode !== 'alphabet') return;
  const open = !expandedLettersFor(currentCollectionId, section).has(letter);
  if (open) {
    collapseTransactionRevision += 1;
    setLetterSectionOpen(section, letter, true);
    return;
  }
  const sectionNode = context.sections.get(section)?.sectionByKey.get(letter);
  collapseNativeStickySection({
    sectionNode,
    heading,
    collapse: () => setLetterSectionOpen(section, letter, false, { persist: false }),
  });
}

function letterTrackState(track) {
  let state = letterTrackStates.get(track);
  if (!state) {
    state = {
      programmaticUntil: 0,
      pointerActive: false,
      manualLocked: false,
      manualLockScrollY: 0,
      cameraFrame: 0,
      cameraTarget: 0,
      cameraLastAt: 0,
      activeLetter: '',
      activeSection: '',
    };
    letterTrackStates.set(track, state);
  }
  return state;
}

function alphabetAxisForSection(section = currentViewKind) {
  const metrics = alphabetSectionMetrics.filter((item) => item.section === section && alphabetOrdinal(item.letter) >= 0);
  const points = metrics.map((item) => ({ semantic: alphabetOrdinal(item.letter), physical: item.top, key: item.letter }));
  if (points.length) {
    const last = points.at(-1);
    const terminalPhysical = rootScrollMetrics().maxScroll + topChromeBottom();
    if (terminalPhysical > last.physical + 1) {
      points.push({ semantic: last.semantic + 1, physical: terminalPhysical, key: '__end__' });
    }
  }
  return createSemanticAxis(points);
}

function readingChromeBottom() {
  return cachedChromeBottom > 0 ? cachedChromeBottom : topChromeBottom();
}

function semanticLetterPositionForReadingBoundary(section = currentViewKind) {
  const axis = alphabetAxisForSection(section);
  const boundary = window.scrollY + readingChromeBottom() + 1;
  return semanticAtPhysical(axis, boundary);
}

function scheduleLetterRailCamera(track, targetLeft) {
  const state = letterTrackState(track);
  if (state.manualLocked || state.pointerActive || !track.isConnected) return;
  const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
  state.cameraTarget = Math.max(0, Math.min(maxLeft, Number(targetLeft || 0)));
  if (prefersReducedMotion()) {
    if (state.cameraFrame) cancelAnimationFrame(state.cameraFrame);
    state.cameraFrame = 0;
    state.programmaticUntil = Date.now() + 40;
    track.scrollLeft = state.cameraTarget;
    return;
  }
  if (state.cameraFrame) return;
  state.cameraLastAt = performance.now();
  const step = (now) => {
    state.cameraFrame = 0;
    if (!track.isConnected || state.manualLocked || state.pointerActive) return;
    const dt = Math.max(1, now - (state.cameraLastAt || now));
    state.cameraLastAt = now;
    const next = exponentialApproach(track.scrollLeft, state.cameraTarget, dt, 68);
    state.programmaticUntil = Date.now() + 90;
    track.scrollLeft = Math.abs(next - state.cameraTarget) < .3 ? state.cameraTarget : next;
    if (Math.abs(track.scrollLeft - state.cameraTarget) > .35) state.cameraFrame = requestAnimationFrame(step);
  };
  state.cameraFrame = requestAnimationFrame(step);
}

function renderLetterRailSemanticPosition(section, _semantic, { activeLetter = '', forceCamera = false } = {}) {
  const track = elements['letter-nav']?.querySelector('.letter-nav-track');
  if (!track || !activeLetter) return;
  const state = letterTrackState(track);
  const activeChanged = state.activeLetter !== activeLetter || state.activeSection !== section;

  if (activeChanged) {
    const previous = state.activeLetter
      ? track.querySelector(`[data-section="${state.activeSection}"][data-letter="${state.activeLetter}"]`)
      : null;
    const next = track.querySelector(`[data-section="${section}"][data-letter="${activeLetter}"]`);
    if (previous && previous !== next) {
      previous.classList.remove('active');
      previous.setAttribute('aria-current', 'false');
    }
    if (next) {
      next.classList.add('active');
      next.setAttribute('aria-current', 'true');
    }
    state.activeLetter = activeLetter;
    state.activeSection = section;
  }

  if (state.manualLocked && !forceCamera) return;
  if (forceCamera) state.manualLocked = false;
  if (!activeChanged && !forceCamera) return;

  const activeButton = track.querySelector(`[data-section="${section}"][data-letter="${activeLetter}"]`);
  if (!activeButton) return;
  const cellCenter = activeButton.offsetLeft + activeButton.offsetWidth / 2;
  const cameraTarget = cameraTargetForActiveCell({
    cellCenter,
    viewportWidth: track.clientWidth,
    scrollWidth: track.scrollWidth,
    currentScrollLeft: track.scrollLeft,
    safeStartRatio: .38,
    safeEndRatio: .62,
    hysteresisPx: 3,
  });
  if (Math.abs(cameraTarget - track.scrollLeft) > .5) scheduleLetterRailCamera(track, cameraTarget);
}

function releaseLetterTrackManualLock(section = '', { follow = true } = {}) {
  for (const track of elements['collection-view'].querySelectorAll('.letter-nav-track')) {
    if (section && !track.querySelector(`[data-section="${section}"]`)) continue;
    const state = letterTrackState(track);
    if (!state.manualLocked && !state.pointerActive) continue;
    state.manualLocked = false;
    state.manualLockScrollY = window.scrollY;
    if (follow) {
      const semantic = semanticLetterPositionForReadingBoundary(section || currentViewKind);
      const activeMetric = activeAlphabetMetricAtReadingBoundary(section || currentViewKind);
      renderLetterRailSemanticPosition(section || currentViewKind, semantic, {
        activeLetter: activeMetric?.letter || '',
        forceCamera: true,
      });
    }
  }
}

function releaseLetterTrackManualLockOnPageMotion() {
  for (const track of elements['collection-view'].querySelectorAll('.letter-nav-track')) {
    const state = letterTrackState(track);
    if (!state.manualLocked || state.pointerActive) continue;
    if (Math.abs(window.scrollY - state.manualLockScrollY) <= .5) continue;
    state.manualLocked = false;
    const section = track.querySelector('[data-section]')?.dataset.section || currentViewKind;
    const semantic = semanticLetterPositionForReadingBoundary(section);
    const activeMetric = activeAlphabetMetricAtReadingBoundary(section);
    renderLetterRailSemanticPosition(section, semantic, { activeLetter: activeMetric?.letter || '', forceCamera: true });
  }
}

function updateActiveLetter(section, letter = '', { ensureVisible = false, force = false } = {}) {
  const semantic = alphabetOrdinal(letter);
  if (semantic < 0) return;
  renderLetterRailSemanticPosition(section, semantic, { activeLetter: letter, forceCamera: Boolean(ensureVisible && force) });
}

function activeAlphabetMetricAtReadingBoundary(section = currentViewKind) {
  const metrics = alphabetSectionMetrics.filter((item) => item.section === section);
  if (!metrics.length) return null;
  const boundary = window.scrollY + readingChromeBottom() + 1;
  let low = 0;
  let high = metrics.length - 1;
  let activeIndex = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (metrics[mid].top <= boundary) { activeIndex = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return metrics[Math.max(0, activeIndex)] || metrics[0] || null;
}

function ensureAlphabetResizeObserver() {
  if (alphabetResizeObserver || !('ResizeObserver' in window)) return alphabetResizeObserver;
  alphabetResizeObserver = new ResizeObserver(() => scheduleAlphabetSectionMetricsRefresh());
  return alphabetResizeObserver;
}

function scheduleAlphabetSectionMetricsRefresh() {
  const revision = ++alphabetMetricsRevision;
  requestAnimationFrame(() => {
    if (revision !== alphabetMetricsRevision) return;
    refreshAlphabetSectionMetrics();
  });
}

function refreshAlphabetSectionMetrics() {
  const context = collectionRenderContext;
  if (!currentCollectionId || !context || context.mode !== 'alphabet') {
    alphabetSectionMetrics = [];
    return;
  }
  const scrollY = window.scrollY;
  alphabetSectionMetrics = [...elements['entry-list'].querySelectorAll('.letter-section[data-letter][data-section]')]
    .map((node) => {
      const heading = node.querySelector('.letter-heading');
      const flowAnchor = node.querySelector(':scope > .section-flow-anchor');
      const rect = (flowAnchor || node).getBoundingClientRect();
      return {
        node,
        heading,
        top: rect.top + scrollY,
        section: node.dataset.section || currentViewKind,
        letter: node.dataset.letter || '',
        ordinal: alphabetOrdinal(node.dataset.letter || ''),
      };
    })
    .filter((item) => item.ordinal >= 0)
    .sort((a, b) => a.top - b.top);
  syncActiveAlphabetHeading();
}

function syncActiveAlphabetHeading() {
  if (scrollCoordinator.isActive()) return;
  const context = collectionRenderContext;
  if (!currentCollectionId || !context || context.mode !== 'alphabet' || !alphabetSectionMetrics.length) return;
  const section = currentViewKind;
  const active = activeAlphabetMetricAtReadingBoundary(section);
  const semantic = semanticLetterPositionForReadingBoundary(section);
  if (!active || !Number.isFinite(semantic)) return;
  activeSection = active.section;
  renderLetterRailSemanticPosition(active.section, semantic, { activeLetter: active.letter });
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

function normalDestinationsForEntries(entries) {
  const state = getState();
  const destinations = [];
  const seenEntries = new Set();
  for (const entry of entries.filter(Boolean)) {
    if (seenEntries.has(entry.id)) continue;
    seenEntries.add(entry.id);
    const membership = (state.membershipsByEntry.get(entry.id) || [])
      .map((item) => ({ item, collection: state.collectionById.get(item.collectionId) }))
      .filter(({ collection }) => collection?.type === 'normal' && !collection.hidden && state.visibleEntryIdsByCollection.get(collection.id)?.has(entry.id))
      .sort((a, b) => Number(a.collection.order || 0) - Number(b.collection.order || 0) || a.collection.name.localeCompare(b.collection.name))[0];
    if (!membership) continue;
    const kindLabel = entry.kind === 'phrase' ? '短语' : entry.kind === 'content' ? '内容' : '词汇';
    destinations.push({ entry, collectionId: membership.collection.id, label: `${membership.collection.name} · ${kindLabel}`, domainId: membership.collection.domainId });
  }
  return destinations.sort((a, b) => {
    const domainA = Number(state.domainById.get(a.domainId)?.order || 0);
    const domainB = Number(state.domainById.get(b.domainId)?.order || 0);
    if (domainA !== domainB) return domainA - domainB;
    const collectionA = state.collectionById.get(a.collectionId);
    const collectionB = state.collectionById.get(b.collectionId);
    return Number(collectionA?.order || 0) - Number(collectionB?.order || 0)
      || String(collectionA?.name || '').localeCompare(String(collectionB?.name || ''))
      || a.entry.id.localeCompare(b.entry.id);
  });
}

function hasRelationsForEntry(entry) {
  return getRelatedEntries(entry.id).length > 0;
}

function relationItemsForEntry(entry) {
  const byIdentity = new Map();
  for (const target of getRelatedEntries(entry.id)) {
    const key = `${target.kind}\u0000${target.normalizedText}`;
    const item = byIdentity.get(key) || { text: target.text, normalizedText: target.normalizedText, kind: target.kind, targetEntries: [] };
    if (!item.targetEntries.some((candidate) => candidate.id === target.id)) item.targetEntries.push(target);
    byIdentity.set(key, item);
  }
  return [...byIdentity.values()].map((item) => ({ ...item, destinations: normalDestinationsForEntries(item.targetEntries) }))
    .sort((a, b) => a.normalizedText.localeCompare(b.normalizedText, 'en') || a.kind.localeCompare(b.kind));
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
  closeRelationTargetMenu({ immediate: true });
  closeActionDialog();
  navigateCollection(destination.collectionId, destination.entry.id, 'relation', destination.entry.kind);
}

function relationNavigationMode(sourceEntry, destinations) {
  if (destinations.length > 1) return 'multi';
  if (destinations.length !== 1) return 'none';
  const state = getState();
  const targetDomain = state.domainById.get(destinations[0].domainId);
  if (targetDomain?.contentMode === 'nonStructured') return 'nonstruct';
  if (destinations[0].domainId === sourceEntry.domainId) return 'intra';
  return 'external';
}

function showPopoverSurface(node) {
  const pending = popoverHideTimers.get(node);
  if (pending) {
    clearTimeout(pending);
    popoverHideTimers.delete(node);
  }
  node.classList.remove('hidden', 'popover-closing');
}

function hidePopoverSurface(node, { immediate = false, onHidden = null } = {}) {
  const pending = popoverHideTimers.get(node);
  if (pending) clearTimeout(pending);
  popoverHideTimers.delete(node);
  const finish = () => {
    if (!node.classList.contains('popover-closing') && !immediate) return;
    node.classList.add('hidden');
    node.classList.remove('popover-closing');
    onHidden?.();
  };
  if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.classList.add('popover-closing');
    finish();
    return;
  }
  node.classList.add('popover-closing');
  const timer = window.setTimeout(() => {
    popoverHideTimers.delete(node);
    finish();
  }, POPOVER_EXIT_MS);
  popoverHideTimers.set(node, timer);
}

function closeRelationTargetMenu({ restoreFocus = false, immediate = false } = {}) {
  if (!activeRelationTargetMenu) return;
  const source = activeRelationTargetMenu.source;
  activeRelationTargetMenu = null;
  hidePopoverSurface(elements['relation-target-menu'], {
    immediate,
    onHidden: () => elements['relation-target-menu'].replaceChildren(),
  });
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
  const viewportRight = viewportLeft + viewportWidth;
  const bounds = readingViewportBounds();
  const viewportBottom = bounds.bottom;
  const chromeBottom = bounds.top;
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
  showPopoverSurface(elements['relation-target-menu']);
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
  const domain = state.domainById.get(sourceEntry?.domainId);
  if (!domain?.glossEnabled) return '';
  const candidates = item.targetEntries || [];
  return candidates.find((candidate) => candidate.domainId === sourceEntry.domainId && candidate.glossHant)?.glossHant
    || candidates.find((candidate) => candidate.glossHant)?.glossHant || '';
}

function renderRelationPanel(entry, items = null) {
  const relationItems = items || relationItemsForEntry(entry);
  if (!relationItems.length || !expandedRelations.has(relationExpansionKey(currentCollectionId, entry.id))) return null;
  return el('div', { className: 'relation-panel' }, relationItems.map((item) => {
    const gloss = displayGlossForRelationItem(item, entry);
    const navigationMode = relationNavigationMode(entry, item.destinations || []);
    const navigationLabel = navigationMode === 'multi'
      ? `选择 ${item.text} 的跳转目标`
      : navigationMode === 'nonstruct'
        ? `跳到非结构独立域中的 ${item.text}`
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

async function toggleEntryRelations(entryId) {
  closeQueryMenu();
  const context = collectionRenderContext;
  const entry = getState().entryById.get(entryId);
  let current = document.getElementById(`entry-${entryId}`);
  if (!context || !entry || !current || current.dataset.relationTransitioning === 'true') return;
  const key = relationExpansionKey(currentCollectionId, entryId);
  const opening = !expandedRelations.has(key);
  current.dataset.relationTransitioning = 'true';

  if (!opening && !prefersReducedMotion()) {
    const panel = current.querySelector('.relation-panel');
    const icon = current.querySelector('.entry-relations .ui-icon');
    const animations = [];
    if (panel?.animate) animations.push(panel.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 72, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards',
    }).finished.catch(() => {}));
    if (icon?.animate) animations.push(icon.animate([
      { transform: 'rotate(90deg)' }, { transform: 'rotate(0deg)' },
    ], { duration: 82, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.catch(() => {}));
    if (animations.length) await Promise.all(animations);
  }

  current = document.getElementById(`entry-${entryId}`);
  if (!current) return;
  const position = captureSemanticPosition();
  const transaction = beginRootScrollTransaction('row-mutation', position);
  const epoch = transaction.epoch;
  if (opening) expandedRelations.add(key);
  else expandedRelations.delete(key);
  const next = renderEntryRow(entry, context.collection, context.domain, indexesForRenderedEntry(context, entry));
  current.replaceWith(next);

  if (opening && !prefersReducedMotion()) {
    const panel = next.querySelector('.relation-panel');
    const icon = next.querySelector('.entry-relations .ui-icon');
    panel?.animate?.([
      { opacity: 0, transform: 'translateY(-3px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 118, easing: 'cubic-bezier(.2,.72,.2,1)' });
    icon?.animate?.([
      { transform: 'rotate(0deg)' }, { transform: 'rotate(90deg)' },
    ], { duration: 108, easing: 'cubic-bezier(.2,.72,.2,1)' });
  }

  requestAnimationFrame(async () => {
    if (!scrollCoordinator.owns(epoch)) return;
    const chunk = next.closest('.entry-chunk');
    if (chunk) measureEntryChunk(chunk);
    restoreSemanticPosition(position, epoch, { source: 'row-mutation' });
    await settleSemanticPosition(epoch, position, { maxFrames: 4, tolerance: 1, source: 'row-mutation' });
    if (scrollCoordinator.owns(epoch)) finishRootScrollTransaction(epoch, { persist: true });
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
  // The PIN button was already updated optimistically. Re-rendering the whole
  // Entry row here destroys DOM identity and creates an avoidable iOS repaint.
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
  const mode = getViewMode(collection.id);
  const preserveDateViewport = mode === 'date';
  const root = document.documentElement;
  const previousOverflowAnchor = preserveDateViewport ? root.style.overflowAnchor : '';
  const position = preserveDateViewport ? captureSemanticPosition() : null;
  const transaction = preserveDateViewport ? beginRootScrollTransaction('study-date-refresh', position) : null;
  if (preserveDateViewport) root.style.overflowAnchor = 'none';
  sourceButton?.classList.add('updating');
  try {
    const stamp = await refreshStudyDate(entry.id, collection.id);
    if (mode === 'alphabet') {
      const context = collectionRenderContext;
      const row = document.getElementById(`entry-${entry.id}`);
      if (context && row) {
        const next = renderEntryRow(entry, collection, context.domain, indexesForRenderedEntry(context, entry));
        row.replaceWith(next);
        const chunk = next.closest('.entry-chunk');
        if (chunk) requestAnimationFrame(() => measureEntryChunk(chunk));
      }
      showToast(`学习日期已刷新：${formatStudyDate(stamp.reviewDateKey)}`);
      return;
    }
    if (transaction) {
      await nextPresentationFrame();
      if (scrollCoordinator.owns(transaction.epoch)) {
        restoreSemanticPosition(position, transaction.epoch, { source: 'study-date-refresh' });
        await settleSemanticPosition(transaction.epoch, position, { maxFrames: 6, tolerance: 1, source: 'study-date-refresh' });
        if (scrollCoordinator.owns(transaction.epoch)) finishRootScrollTransaction(transaction.epoch, { persist: true });
      }
    }
    showToast(`学习日期已刷新：${formatStudyDate(stamp.reviewDateKey)}`);
  } catch (error) {
    if (transaction && scrollCoordinator.owns(transaction.epoch)) finishRootScrollTransaction(transaction.epoch, { persist: false });
    throw error;
  } finally {
    if (preserveDateViewport) root.style.overflowAnchor = previousOverflowAnchor;
    sourceButton?.classList.remove('updating');
  }
}

function providerQueryIsCurrent(sequence) {
  return activeProviderQuery?.sequence === sequence && dialogStack.some((frame) => frame.kind === 'action');
}

function providerResultBody(provider, entry, statusText = '查询中…') {
  return [
    el('div', { className: 'provider-result-card' }, [
      el('p', { className: 'provider-result-provider', text: provider }),
      el('h3', { className: 'provider-result-word', text: entry.text }),
      el('p', { className: 'provider-result-status', text: statusText }),
      el('div', { className: 'provider-result-content' }),
    ]),
  ];
}

async function startProviderQuery(provider, entry, collection) {
  if (activeProviderQuery) {
    activeProviderQuery.controller.abort();
    if (dialogStack.at(-1)?.kind === 'action') closeDialog();
  }
  const controller = new AbortController();
  const sequence = ++providerQuerySequence;
  activeProviderQuery = { provider, entryId: entry.id, sequence, controller };
  const body = providerResultBody(provider, entry);
  const queryFrame = openActionDialog({ title: `${provider} 查询`, body });
  const card = queryFrame?.body.querySelector('.provider-result-card');
  const status = card?.querySelector('.provider-result-status');
  const content = card?.querySelector('.provider-result-content');
  try {
    if (provider === 'Groq') {
      const context = createEntryContext(getState(), entry, collection.id, { appVersion: APP_VERSION, section: sectionForEntry(entry) });
      const result = await queryVocabularyEntry(context, { signal: controller.signal });
      if (!providerQueryIsCurrent(sequence)) return;
      status.textContent = '完成';
      content.replaceChildren(
        result.summary ? el('p', { text: result.summary }) : null,
        result.usage ? el('p', { className: 'help-text', text: result.usage }) : null,
        result.warning ? el('div', { className: 'warning-box', text: result.warning }) : null,
      );
    } else if (provider === 'Collins') {
      const result = await queryCollins(entry.text, { signal: controller.signal });
      if (!providerQueryIsCurrent(sequence)) return;
      status.textContent = result.dictionaryName || '完成';
      content.replaceChildren(el('p', { className: 'provider-dictionary-text', text: result.text }));
    }
  } catch (error) {
    if (controller.signal.aborted || !providerQueryIsCurrent(sequence)) return;
    status.textContent = '未完成';
    content.replaceChildren(el('div', { className: 'warning-box', text: error?.message || String(error) }));
    if (provider === 'Collins') {
      content.append(button('在 Collins 网站打开', 'secondary-button', () => { window.location.assign(buildCollinsExternalUrl(entry.text)); }));
    }
  }
}

function openOxfordLookup(entry) {
  window.location.assign(buildOxfordLookupUrl(entry.text));
}

function openChatGPTEntryQuery(entry, collection) {
  const state = getState();
  const context = createEntryContext(state, entry, collection.id, {
    appVersion: APP_VERSION,
    viewMode: getViewMode(collection.id),
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
  const textUnits = estimatedTextUnits(entry.text);
  const glossUnits = estimatedTextUnits(gloss);
  if (entry.kind === 'content') {
    if (textUnits <= 18 && glossUnits <= 20) return 'content-normal';
    if (textUnits <= 36 && glossUnits <= 30) return 'content-two-line';
    return 'content-extreme';
  }
  if (entry.kind !== 'phrase') return 'word-normal';
  if (textUnits <= 13.5 && glossUnits <= 18) return 'phrase-normal';
  if (textUnits <= 28 && glossUnits <= 24) return 'phrase-two-line';
  return 'phrase-extreme';
}

function handleEntryPrimaryAction(entry, collection, annotationRecord) {
  if (annotationRecord) startAnnotationReview(collection.id, annotationRecord.sourceEntryId);
  else copyEntry(entry, collection);
}

function createTextViewport(entry, collection, gloss, annotationRecord, layoutKind) {
  const isScrollable = entry.kind === 'word' || layoutKind === 'phrase-extreme' || layoutKind === 'content-extreme';
  let pointerStart = null;
  let suppressClick = false;
  const viewport = el('div', {
    className: `entry-text-viewport${isScrollable ? ' horizontally-scrollable' : ''}${gloss ? ' has-gloss' : ' no-gloss'}`,
    role: 'button', tabindex: 0,
    'aria-label': annotationRecord ? `处理 ${entry.text} 的待核查标注` : `复制 ${entry.text}`,
  });
  const lexemeStack = el('div', { className: 'entry-lexeme-stack' }, [
    el('span', { className: 'entry-text', text: entry.text, title: entry.text }),
    gloss ? el('span', { className: 'entry-gloss', text: gloss, title: gloss }) : null,
  ]);
  const content = el('div', { className: 'entry-text-content' }, [lexemeStack]);
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

function closeQueryMenu({ restoreFocus = false, immediate = false } = {}) {
  if (!activeQueryMenu) return;
  const source = activeQueryMenu.source;
  activeQueryMenu.source?.setAttribute('aria-expanded', 'false');
  activeQueryMenu = null;
  hidePopoverSurface(elements['query-menu'], {
    immediate,
    onHidden: () => {
      elements['query-menu'].classList.remove('below');
      elements['query-menu'].replaceChildren();
    },
  });
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
  const viewportRight = viewportLeft + viewportWidth;
  const bounds = readingViewportBounds();
  const viewportBottom = bounds.bottom;
  const chromeBottom = bounds.top;
  const gap = 13;
  let top = sourceRect.top - menuRect.height - gap;
  let below = false;
  if (top < chromeBottom + 8) {
    top = sourceRect.bottom + gap;
    below = true;
  }
  top = Math.max(chromeBottom + 8, Math.min(top, viewportBottom - menuRect.height - 8));
  const cssInset = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--query-menu-edge-inset')) || 12;
  const sideInset = Math.max(10, cssInset);
  // Match the proven relation-target popover language: hang the menu from the
  // source action's right edge, then nudge it slightly farther left.
  const idealLeft = sourceRect.right - menuRect.width - 10;
  const left = Math.min(
    Math.max(viewportLeft + sideInset, idealLeft),
    viewportRight - menuRect.width - sideInset,
  );
  const arrowX = Math.min(menuRect.width - 16, Math.max(16, sourceRect.left + sourceRect.width / 2 - left));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.setProperty('--query-arrow-x', `${Math.round(arrowX)}px`);
  menu.classList.toggle('below', below);
}

function openQueryMenu(entry, collection, source) {
  if (activeQueryMenu?.entryId === entry.id && activeQueryMenu.source === source) { closeQueryMenu(); return; }
  closeQueryMenu();
  activeQueryMenu = { entryId: entry.id, source };
  source.setAttribute('aria-expanded', 'true');
  const oxford = iconButton('dictionary', 'query-menu-option oxford-option', `在牛津英汉辞书中查询 ${entry.text}`, () => {
    closeQueryMenu();
    try { openOxfordLookup(entry); } catch (error) { displayError(error); }
  });
  const collins = iconButton('collins', 'query-menu-option collins-option', `用 Collins 查询 ${entry.text}`, () => {
    closeQueryMenu(); startProviderQuery('Collins', entry, collection).catch(displayError);
  });
  const groq = iconButton('groq', 'query-menu-option groq-option', `用 Groq 核查 ${entry.text}`, () => {
    closeQueryMenu(); startProviderQuery('Groq', entry, collection).catch(displayError);
  });
  const chatgpt = iconButton('aiChat', 'query-menu-option chatgpt-option', `交给 ChatGPT 新建查询：${entry.text}`, () => {
    closeQueryMenu();
    try { openChatGPTEntryQuery(entry, collection); } catch (error) { displayError(error); }
  });
  const providerOptions = [[oxford, 'Oxford'], [collins, 'Collins'], [groq, 'Groq'], [chatgpt, 'ChatGPT']];
  for (const [option, label] of providerOptions) {
    option.setAttribute('role', 'menuitem');
    option.append(el('span', { className: 'query-provider-label', text: label }));
  }
  elements['query-menu'].replaceChildren(...providerOptions.map(([option]) => option));
  showPopoverSurface(elements['query-menu']);
  requestAnimationFrame(() => { positionQueryMenu(); oxford.focus({ preventScroll: true }); });
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
  const sourceDomainLabel = sourceDomainLabelForEntry(entry, collection);
  const studyStamp = getStudyStamp(entry, collection.id);
  const layoutKind = entryLayoutKind(entry, gloss);
  const row = el('article', {
    className: `entry-row ${layoutKind}${indexText ? ' has-index' : ' no-index'}${gloss ? ' has-gloss' : ' no-gloss'}${expanded ? ' relations-open' : ''}${annotation ? ' annotated' : ''}${hasRelations ? ' has-relations' : ''}${sourceDomainLabel ? ' has-source-domain' : ''}`,
    id: `entry-${entry.id}`,
    dataset: { entryId: entry.id, section: sectionForEntry(entry), layout: layoutKind },
  });
  const actions = entryActionButtons(entry, collection, pinned, studyStamp);
  const actionItems = [];
  if (hasRelations) {
    const relationButton = iconButton('disclosure', `entry-relations${expanded ? ' active' : ''}`, expanded ? '收起关联' : '展开关联', () => toggleEntryRelations(entry.id).catch(displayError));
    relationButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    actionItems.push(relationButton);
  } else {
    actionItems.push(el('span', { className: 'entry-action-placeholder relation-placeholder', 'aria-hidden': 'true' }));
  }
  actionItems.push(actions.refresh, actions.pin, actions.query, actions.more);
  const textViewport = createTextViewport(entry, collection, gloss, annotationRecord, layoutKind);
  const actionMainChildren = [];
  if (studyStamp) actionMainChildren.push(el('span', {
    className: 'entry-study-date marked',
    text: formatStudyDate(studyStamp.reviewDateKey),
    'aria-label': `最近学习日期 ${studyStamp.reviewDateKey}`,
  }));
  actionMainChildren.push(el('div', { className: 'entry-actions', 'aria-label': `${entry.text} 操作` }, actionItems));
  const controlStack = el('div', { className: `entry-control-stack${sourceDomainLabel ? ' has-source' : ''}` }, [
    el('div', { className: 'entry-control-main' }, actionMainChildren),
    sourceDomainLabel ? el('span', { className: 'entry-source-domain', text: sourceDomainLabel, title: `来源：${sourceDomainLabel}` }) : null,
  ]);
  const lineChildren = [
    indexText ? el('span', { className: 'entry-index-inline', text: indexText, 'aria-hidden': 'true' }) : null,
    textViewport,
    controlStack,
  ];
  const primary = el('div', {
    className: `entry-line${gloss ? ' has-left-meta' : ''}${sourceDomainLabel ? ' has-right-meta' : ''}`,
  }, lineChildren);
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

function ensureEntryRendered(entryId, { persist = false } = {}) {
  let row = document.getElementById(`entry-${entryId}`);
  if (row) return row;
  const context = collectionRenderContext;
  const entry = getState().entryById.get(entryId);
  if (!context || !entry || context.collection.id !== currentCollectionId) return null;
  const section = sectionForEntry(entry);
  if (context.mode === 'alphabet') {
    const letter = letterForEntry(entry);
    setLetterSectionOpen(section, letter, true, { persist });
  } else {
    const dateKey = getStudyStamp(entry, context.collection.id)?.reviewDateKey || 'unmarked';
    setDateSectionOpen(section, dateKey, true, { persist });
  }
  const chunk = entryChunkByEntryId.get(entryId);
  if (chunk) materializeEntryChunk(chunk, { reason: 'ensure-entry' });
  row = document.getElementById(`entry-${entryId}`);
  return row;
}

function semanticSectionPositionFromNode(sectionNode, bounds) {
  const flowAnchor = sectionNode?.querySelector(':scope > .section-flow-anchor');
  if (!flowAnchor || !sectionNode.id) return null;
  const rect = flowAnchor.getBoundingClientRect();
  return {
    kind: 'section',
    sectionId: sectionNode.id,
    offsetFromContentTop: rect.top - bounds.top,
    scrollYFallback: window.scrollY,
  };
}

function captureSemanticPosition() {
  if (!currentCollectionId || !collectionRenderContext) return { kind: 'top', scrollYFallback: Math.max(0, window.scrollY) };
  const { maxScroll } = rootScrollMetrics();
  const currentY = Math.max(0, window.scrollY);
  const bottomGap = Math.max(0, maxScroll - currentY);
  if (bottomGap <= 1.5) {
    // Bottom is itself the semantic identity; do not walk thousands of rendered
    // rows merely to attach a decorative last-entry id to the snapshot.
    return { kind: 'bottom', bottomGap: 0, scrollYFallback: currentY };
  }
  if (currentY <= 1.5) return { kind: 'top', scrollYFallback: 0 };

  const bounds = readingViewportBounds();
  // Hot-path capture must stay independent of total rendered-row count. Probe
  // the reading viewport first; only use a DOM scan as a defensive fallback for
  // unusual hit-testing states (e.g. an overlay edge or a placeholder gap).
  const x = Math.min(Math.max(24, window.innerWidth * 0.22), Math.max(24, window.innerWidth - 24));
  const probeOffsets = [2, 18, 42, 74, 110];
  for (const offset of probeOffsets) {
    const y = Math.min(bounds.bottom - 2, bounds.top + offset);
    const node = document.elementFromPoint(x, y);
    const row = /** @type {HTMLElement | null} */ (node?.closest?.('.entry-row[data-entry-id]') || null);
    if (!row?.dataset.entryId) continue;
    const rect = row.getBoundingClientRect();
    return {
      kind: 'entry',
      entryId: row.dataset.entryId,
      offsetFromContentTop: rect.top - bounds.top,
      scrollYFallback: currentY,
    };
  }

  const renderedRows = /** @type {NodeListOf<HTMLElement>} */ (elements['entry-list'].querySelectorAll('.entry-row[data-entry-id]'));
  for (const row of renderedRows) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom <= bounds.top + .5 || rect.top >= bounds.bottom - .5) continue;
    return {
      kind: 'entry',
      entryId: row.dataset.entryId || '',
      offsetFromContentTop: rect.top - bounds.top,
      scrollYFallback: currentY,
    };
  }

  const sections = [...elements['entry-list'].querySelectorAll('.letter-section, .date-day-section, .date-unmarked-section')];
  const visibleSection = sections.find((sectionNode) => {
    const rect = sectionNode.getBoundingClientRect();
    return rect.bottom > bounds.top + .5 && rect.top < bounds.bottom - .5;
  });
  const sectionPosition = semanticSectionPositionFromNode(visibleSection, bounds);
  return sectionPosition || { kind: 'scroll', scrollYFallback: currentY };
}

function semanticPositionNode(position, { ensure = true } = {}) {
  if (!position) return null;
  if (position.kind === 'entry' && position.entryId) {
    return ensure ? ensureEntryRendered(position.entryId, { persist: false }) : document.getElementById(`entry-${position.entryId}`);
  }
  if (position.kind === 'section' && position.sectionId) {
    const sectionNode = document.getElementById(position.sectionId);
    return sectionNode?.querySelector(':scope > .section-flow-anchor') || null;
  }
  return null;
}

function semanticDesiredScrollY(position) {
  if (!position) return Number.NaN;
  const metrics = rootScrollMetrics();
  if (position.kind === 'top') return 0;
  if (position.kind === 'bottom') return clampRootScrollTarget(metrics.maxScroll - Math.max(0, Number(position.bottomGap || 0)), metrics.scrollHeight, metrics.clientHeight);
  if (position.kind === 'scroll') return clampRootScrollTarget(Math.max(0, Number(position.scrollYFallback || 0)), metrics.scrollHeight, metrics.clientHeight);
  const node = semanticPositionNode(position, { ensure: false });
  if (!node?.isConnected) return Number.NaN;
  const bounds = readingViewportBounds();
  const desiredTop = bounds.top + Number(position.offsetFromContentTop || 0);
  const rawTarget = window.scrollY + semanticAnchorError(node.getBoundingClientRect().top, desiredTop);
  return clampRootScrollTarget(rawTarget, metrics.scrollHeight, metrics.clientHeight);
}

function semanticPositionErrorValue(position) {
  const targetY = semanticDesiredScrollY(position);
  if (!Number.isFinite(targetY)) return Number.POSITIVE_INFINITY;
  return window.scrollY - targetY;
}

function semanticPositionSample(position) {
  if (!position) return Number.NaN;
  if (position.kind === 'top' || position.kind === 'scroll') return window.scrollY;
  if (position.kind === 'bottom') return rootScrollMetrics().maxScroll - window.scrollY;
  const node = semanticPositionNode(position, { ensure: false });
  return node?.isConnected ? node.getBoundingClientRect().top : Number.NaN;
}

function materializeChunksAroundScrollY(targetY, { reason = 'target-prewarm', margin = 960 } = {}) {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const start = Math.max(0, Number(targetY || 0) - margin);
  const end = Math.max(start, Number(targetY || 0) + viewportHeight + margin);
  let changed = false;
  for (const chunk of elements['entry-list'].querySelectorAll('.entry-chunk[data-rendered="false"]')) {
    const rect = chunk.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const bottom = rect.bottom + window.scrollY;
    if (bottom < start || top > end) continue;
    queuedVirtualChunks.delete(chunk);
    changed = materializeEntryChunk(chunk, { reason }) || changed;
    if (chunk.dataset.rendered === 'true') measureEntryChunk(chunk);
  }
  return changed;
}

function prepareSemanticPositionGeometry(position, { reason = 'semantic-prewarm', passes = 3 } = {}) {
  if (!position) return Number.NaN;
  updateOverlayLayout({ immediate: true });
  if (position.kind === 'entry') semanticPositionNode(position, { ensure: true });
  let targetY = semanticDesiredScrollY(position);
  for (let pass = 0; pass < passes; pass += 1) {
    if (!Number.isFinite(targetY)) targetY = Math.max(0, Number(position.scrollYFallback || 0));
    const changed = materializeChunksAroundScrollY(targetY, { reason: `${reason}-${pass + 1}` });
    if (collectionRenderContext?.mode === 'alphabet') refreshAlphabetSectionMetrics();
    if (position.kind === 'entry') semanticPositionNode(position, { ensure: true });
    const nextY = semanticDesiredScrollY(position);
    if (Number.isFinite(nextY)) targetY = nextY;
    if (!changed) break;
  }
  return targetY;
}

function activeAlphabetMetricForSemantic(section, semantic) {
  const metrics = alphabetSectionMetrics.filter((item) => item.section === section).sort((a, b) => a.ordinal - b.ordinal);
  if (!metrics.length || !Number.isFinite(semantic)) return null;
  let active = metrics[0];
  for (const metric of metrics) {
    if (metric.ordinal <= semantic + 1e-6) active = metric;
    else break;
  }
  return active;
}

function semanticScrollYForPosition(section, semantic) {
  const axis = alphabetAxisForSection(section);
  const physical = physicalAtSemantic(axis, semantic);
  if (!Number.isFinite(physical)) return Number.NaN;
  const metrics = rootScrollMetrics();
  return clampRootScrollTarget(physical - topChromeBottom(), metrics.scrollHeight, metrics.clientHeight);
}

async function animateRootToSemanticPosition(position, {
  owner = 'semantic-scroll', source = 'semantic-scroll', targetSemantic = Number.NaN, semanticAlphabet = true,
} = {}) {
  const transaction = beginRootScrollTransaction(owner, position);
  const epoch = transaction.epoch;
  releaseLetterTrackManualLock(currentViewKind, { follow: false });
  try {
    let targetY = prepareSemanticPositionGeometry(position, { reason: `${source}-prewarm` });
    if (!Number.isFinite(targetY)) targetY = Math.max(0, Number(position?.scrollYFallback || 0));
    const startY = window.scrollY;
    const alphabetMotion = semanticAlphabet && collectionRenderContext?.mode === 'alphabet' && currentCollectionId && alphabetSectionMetrics.length;
    if (prefersReducedMotion()) {
      targetY = prepareSemanticPositionGeometry(position, { reason: `${source}-reduced`, passes: 2 });
      restoreSemanticPosition(position, epoch, { tolerance: .5, source: `${source}-reduced` });
      if (collectionRenderContext?.mode === 'alphabet') {
        refreshAlphabetSectionMetrics();
        const active = Number.isFinite(targetSemantic)
          ? activeAlphabetMetricForSemantic(currentViewKind, targetSemantic)
          : activeAlphabetMetricAtReadingBoundary(currentViewKind);
        const semantic = Number.isFinite(targetSemantic) ? targetSemantic : semanticLetterPositionForReadingBoundary(currentViewKind);
        renderLetterRailSemanticPosition(currentViewKind, semantic, { activeLetter: active?.letter || '', forceCamera: true });
      }
      finishRootScrollTransaction(epoch, { persist: true });
      return true;
    }
    const startAt = performance.now();

    if (alphabetMotion) {
      refreshAlphabetSectionMetrics();
      const section = currentViewKind;
      let axis = alphabetAxisForSection(section);
      const startBoundary = startY + topChromeBottom();
      const startSemantic = semanticAtPhysical(axis, startBoundary);
      if (!Number.isFinite(targetSemantic)) targetSemantic = semanticAtPhysical(axis, targetY + topChromeBottom());
      if (!Number.isFinite(startSemantic) || !Number.isFinite(targetSemantic)) {
        targetSemantic = Number.NaN;
      } else {
        const logicalDistance = Math.abs(targetSemantic - startSemantic);
        const duration = semanticScrollDuration(logicalDistance, targetY - startY);
        if (duration > 0) {
          while (true) {
            await nextPresentationFrame();
            if (!scrollCoordinator.owns(epoch)) return false;
            const now = performance.now();
            const raw = Math.min(1, Math.max(0, (now - startAt) / duration));
            const eased = MOTION_EASE.scroll(raw);
            const semantic = startSemantic + (targetSemantic - startSemantic) * eased;
            materializeChunksNearViewport({ reason: `${source}-corridor` });
            if (queuedVirtualChunks.size) flushQueuedVirtualChunksNow({ reason: `${source}-corridor-flush` });
            refreshAlphabetSectionMetrics();
            axis = alphabetAxisForSection(section);
            const liveY = semanticScrollYForPosition(section, semantic);
            if (Number.isFinite(liveY)) rootScrollToY(liveY, { epoch, source });
            const active = activeAlphabetMetricForSemantic(section, semantic);
            renderLetterRailSemanticPosition(section, semantic, { activeLetter: active?.letter || '', forceCamera: true });
            if (raw >= 1) break;
          }
        }
      }
    }

    if (!Number.isFinite(targetSemantic)) {
      const duration = physicalScrollDuration(targetY - startY);
      if (duration > 0) {
        while (true) {
          await nextPresentationFrame();
          if (!scrollCoordinator.owns(epoch)) return false;
          const now = performance.now();
          const raw = Math.min(1, Math.max(0, (now - startAt) / duration));
          const eased = MOTION_EASE.scroll(raw);
          materializeChunksNearViewport({ reason: `${source}-physical-corridor` });
          if (queuedVirtualChunks.size) flushQueuedVirtualChunksNow({ reason: `${source}-physical-flush` });
          const liveTarget = semanticDesiredScrollY(position);
          if (Number.isFinite(liveTarget)) targetY = liveTarget;
          const nextY = startY + (targetY - startY) * eased;
          rootScrollToY(nextY, { epoch, source });
          if (collectionRenderContext?.mode === 'alphabet') {
            refreshAlphabetSectionMetrics();
            const semantic = semanticLetterPositionForReadingBoundary(currentViewKind);
            const active = activeAlphabetMetricAtReadingBoundary(currentViewKind);
            renderLetterRailSemanticPosition(currentViewKind, semantic, { activeLetter: active?.letter || '', forceCamera: true });
          }
          if (raw >= 1) break;
        }
      }
    }

    if (!scrollCoordinator.owns(epoch)) return false;
    targetY = prepareSemanticPositionGeometry(position, { reason: `${source}-final`, passes: 2 });
    restoreSemanticPosition(position, epoch, { tolerance: .5, source: `${source}-final` });
    if (collectionRenderContext?.mode === 'alphabet') {
      refreshAlphabetSectionMetrics();
      const semantic = Number.isFinite(targetSemantic) ? targetSemantic : semanticLetterPositionForReadingBoundary(currentViewKind);
      const active = Number.isFinite(targetSemantic)
        ? activeAlphabetMetricForSemantic(currentViewKind, targetSemantic)
        : activeAlphabetMetricAtReadingBoundary(currentViewKind);
      renderLetterRailSemanticPosition(currentViewKind, semantic, { activeLetter: active?.letter || '', forceCamera: true });
    }
    finishRootScrollTransaction(epoch, { persist: true });
    return true;
  } catch (error) {
    if (scrollCoordinator.owns(epoch)) finishRootScrollTransaction(epoch, { persist: false });
    throw error;
  }
}

function restoreSemanticPosition(position, epoch, { tolerance = 1, source = 'semantic-restore' } = {}) {
  if (!position || (epoch && !scrollCoordinator.owns(epoch))) return false;
  if (position.kind === 'entry') semanticPositionNode(position, { ensure: true });
  let targetY = semanticDesiredScrollY(position);
  if (!Number.isFinite(targetY)) targetY = Math.max(0, Number(position.scrollYFallback || 0));
  if (Math.abs(window.scrollY - targetY) <= tolerance) return false;
  return rootScrollToY(targetY, { epoch, source });
}

async function settleSemanticPosition(epoch, position, { maxFrames = 8, tolerance = 1, source = 'semantic-settle' } = {}) {
  const samples = [];
  for (let frame = 0; frame < maxFrames; frame += 1) {
    await nextPresentationFrame();
    if (!scrollCoordinator.owns(epoch)) return false;
    updateOverlayLayout({ immediate: true });
    flushQueuedVirtualChunksNow({ reason: `${source}-flush` });
    materializeChunksNearViewport({ reason: `${source}-nearby` });
    if (position?.kind === 'entry') semanticPositionNode(position, { ensure: true });
    const error = semanticPositionErrorValue(position);
    if (Number.isFinite(error) && Math.abs(error) > tolerance) restoreSemanticPosition(position, epoch, { tolerance, source });
    samples.push(semanticPositionSample(position));
    const stable = geometryIsStable(samples, .5);
    const finalError = semanticPositionErrorValue(position);
    const virtualIdle = !queuedVirtualChunks.size && !virtualMaterializeFrame;
    appendScrollTrace('verify', { epoch, source, frame, error: finalError, stable, virtualIdle, scrollY: window.scrollY });
    if (stable && virtualIdle && Number.isFinite(finalError) && Math.abs(finalError) <= tolerance) return true;
  }
  restoreSemanticPosition(position, epoch, { tolerance, source: `${source}-final` });
  return Number.isFinite(semanticPositionErrorValue(position)) && Math.abs(semanticPositionErrorValue(position)) <= Math.max(2, tolerance);
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
  const top = topChromeBottom();
  const bottomRects = [...document.querySelectorAll('.bottom-toolbar, .pin-bar, .review-bar')]
    .filter((candidate) => candidate && !candidate.classList.contains('hidden'))
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => rect.height > 0 && rect.bottom > viewportBottom - 140);
  let bottom = viewportBottom - 8;
  for (const rect of bottomRects) bottom = Math.min(bottom, rect.top - 8);
  return { top: Math.max(viewportTop, Math.floor(top + .01)), bottom: Math.max(top + 80, bottom) };
}

function positionHeadingBelowChrome(target) {
  if (!target) return false;
  const sectionNode = target.matches?.('.letter-section, .date-day-section, .date-unmarked-section')
    ? target
    : target.closest?.('.letter-section, .date-day-section, .date-unmarked-section');
  const position = sectionNode?.id
    ? { kind: 'section', sectionId: sectionNode.id, offsetFromContentTop: 0, scrollYFallback: window.scrollY }
    : { kind: 'scroll', scrollYFallback: Math.max(0, window.scrollY + target.getBoundingClientRect().top - readingViewportBounds().top) };
  animateRootToSemanticPosition(position, {
    owner: 'section-jump',
    source: 'section-jump',
    semanticAlphabet: collectionRenderContext?.mode === 'alphabet',
  }).catch(displayError);
  return true;
}

function positionElementAtReadingAnchor(target, { epoch = 0, source = 'entry-jump' } = {}) {
  const rect = target.getBoundingClientRect();
  const bounds = readingViewportBounds();
  if (rect.top >= bounds.top && rect.bottom <= bounds.bottom) return false;
  const anchor = bounds.top + (bounds.bottom - bounds.top) * 0.38;
  const targetY = Math.max(0, window.scrollY + rect.top - anchor + rect.height / 2);
  rootScrollToY(targetY, { epoch, source });
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
async function jumpToEntry(entryId, { behavior = 'auto', collectionId = currentCollectionId, reason = 'jump' } = {}) {
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
    await navigateCollection(targetCollectionId, entryId, reason, targetViewKind);
    return true;
  }
  const token = ++navigationRevision;
  activeSection = sectionForEntry(entry);
  syncPinIndexForEntry(currentCollectionId, entryId);
  pendingJumpEntryId = '';
  pendingJumpReason = 'jump';
  const collection = state.collectionById.get(currentCollectionId);
  if (collection) renderPinBar(collection);
  const row = ensureEntryRendered(entryId, { persist: false });
  if (!row) return false;
  updateOverlayLayout({ immediate: true });
  const bounds = readingViewportBounds();
  const rect = row.getBoundingClientRect();
  const anchor = bounds.top + (bounds.bottom - bounds.top) * 0.38;
  const position = {
    kind: 'entry',
    entryId,
    offsetFromContentTop: anchor - rect.height / 2 - bounds.top,
    scrollYFallback: window.scrollY,
  };
  try {
    const ok = await animateRootToSemanticPosition(position, {
      owner: 'entry-jump',
      source: `entry-jump-${reason}`,
      semanticAlphabet: collectionRenderContext?.mode === 'alphabet',
    });
    if (!ok || token !== navigationRevision) return false;
    const liveRow = document.getElementById(`entry-${entryId}`);
    if (liveRow) markJumpTarget(liveRow, reason);
    return true;
  } catch (error) {
    displayError(error);
    return false;
  }
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
  if (scrollCoordinator.isActive() || navigationTraversalInProgress || rootUserScrollActive) return;
  if (!currentCollectionId || Date.now() < suppressScrollPersistenceUntil) return;
  clearTimeout(scrollPersistenceTimer);
  scrollPersistenceTimer = setTimeout(() => {
    scrollPersistenceTimer = 0;
    if (!currentCollectionId || Date.now() < suppressScrollPersistenceUntil) return;
    persistCurrentHistorySnapshot();
  }, 320);
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
  cancelBrowseAnchorPress({ suppressClick: true });
  navigationRevision += 1;
  animateRootToSemanticPosition({ kind: 'top', scrollYFallback: 0 }, {
    owner: 'return-top',
    source: 'return-top',
    semanticAlphabet: false,
  }).catch(displayError);
}

function openAddDomainDialog() {
  const name = el('input', { required: true, maxlength: 40, placeholder: '例如：计算机科学' });
  const gloss = el('input', { type: 'checkbox' });
  const mode = el('select', {}, [
    el('option', { value: 'structured', text: '结构化（词汇 / 短语）' }),
    el('option', { value: 'nonStructured', text: '非结构（内容）' }),
  ]);
  openDialog({
    title: '新建独立域',
    description: '内容模式创建后不可切换；如需改变请新建独立域并迁移内容。',
    body: [field('独立域名称', name), field('内容模式', mode), el('label', { className: 'inline-field' }, [el('span', { text: '启用繁体中文释义' }), gloss])],
    onSubmit: async () => { await addDomain(name.value, { glossEnabled: gloss.checked, contentMode: mode.value }); },
  });
}

function openDomainMenu(domainId) {
  const state = getState();
  const domain = state.domainById.get(domainId);
  const name = el('input', { value: domain.name, maxlength: 40, required: true });
  const gloss = el('input', { type: 'checkbox', checked: domain.glossEnabled });
  const relationExcluded = el('input', { type: 'checkbox', checked: Boolean(domain.relationExcluded) });
  const body = [
    field('独立域名称', name),
    field('内容模式', el('input', { value: domain.contentMode === 'nonStructured' ? '非结构（内容）' : '结构化（词汇 / 短语）', readOnly: true })),
    el('label', { className: 'inline-field' }, [el('span', { text: '显示并编辑繁体释义' }), gloss]),
    el('label', { className: 'inline-field' }, [el('span', { text: '不参与关联' }), relationExcluded]),
    el('p', { className: 'help-text', text: '“不参与关联”只在显示与查询上下文中逻辑隐藏关系；底层双向关系仍完整维护，关闭后立即恢复。' }),
  ];
  if (domain.id !== 'domain_general_english') body.push(button('删除整个独立域', 'danger-button', () => confirmDeleteDomain(domain.id)));
  openDialog({
    title: '管理独立域', body,
    onSubmit: async () => {
      if (name.value.trim() !== domain.name) await renameDomain(domain.id, name.value);
      if (gloss.checked !== domain.glossEnabled) await setDomainGlossEnabled(domain.id, gloss.checked);
      if (relationExcluded.checked !== Boolean(domain.relationExcluded)) await setDomainRelationExcluded(domain.id, relationExcluded.checked);
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
  if (!collection || collection.type !== 'normal') {
    showToast('系统总表仅用于投影浏览，请在普通词表中新增内容', 'error');
    return;
  }
  const domain = state.domainById.get(collection.domainId);
  const isContent = domain?.contentMode === 'nonStructured';
  const text = el('input', {
    required: true,
    maxlength: 240,
    placeholder: isContent ? '例如：It is important to ...' : '例如：thread 或 thread pool',
  });
  const gloss = el('input', { maxlength: 160, placeholder: '可输入简体或繁体' });
  const contentType = isContent ? el('input', { maxlength: 48, value: collection.label || collection.name || 'general', placeholder: '例如：sentence-pattern' }) : null;
  const body = [field(isContent ? '内容' : '词汇或短语', text)];
  if (contentType) body.push(field('内容类型', contentType));
  if (domain?.glossEnabled) body.push(field('繁体释义', gloss));
  openDialog({
    title: isContent ? '新增内容' : '新增词汇或短语',
    body,
    onSubmit: async () => {
      const entry = await addEntry(collectionId, text.value, { gloss: gloss.value, contentType: contentType?.value || '' });
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
  const body = [field(entry.kind === 'phrase' ? '短语' : entry.kind === 'content' ? '内容' : '词汇', text)];
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
  const domain = collection.domainId ? state.domainById.get(collection.domainId) : null;
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
  const actions = [];
  if (collection.type === 'normal') {
    const contentLabel = domain?.contentMode === 'nonStructured' ? '新增内容' : '新增词汇或短语';
    actions.push(el('div', { className: 'action-group' }, [
      el('p', { className: 'action-group-title', text: '新增' }),
      el('div', { className: 'action-list' }, [
        button(contentLabel, '', () => openAddEntryDialog(collection.id)),
        domain?.contentMode === 'nonStructured' ? null : button('AI 新增', '', () => openAiAddDialog(collection.id)),
      ]),
    ]));
  }
  actions.push(el('div', { className: 'action-group' }, [
    el('p', { className: 'action-group-title', text: 'AI' }),
    el('div', { className: 'action-list' }, [
      button('AI 核查', '', () => openAiCheckDialog(collection.id), { disabled: Boolean(activeTask) || !entries.length }),
      annotationCount ? button(`待核查 ${annotationCount}`, '', () => { closeActionDialog(); startAnnotationReview(collection.id, '', currentViewKind); }) : null,
    ].filter(Boolean)),
  ]));
  actions.push(el('div', { className: 'action-group' }, [
    el('p', { className: 'action-group-title', text: '数据' }),
    el('div', { className: 'action-list' }, [
      collection.type === 'normal' ? button('导入', '', () => openImportDialog(collection.id)) : null,
      button('导出 CSV', '', () => { exportCollectionCsv(collection.id); closeActionDialog(); }),
      button('撤销', '', async () => { closeActionDialog(); await performUndo(); }),
      button('重做', '', async () => { closeActionDialog(); await performRedo(); }),
    ].filter(Boolean)),
  ]));
  actions.push(el('div', { className: 'action-group' }, [
    el('p', { className: 'action-group-title', text: '管理' }),
    el('div', { className: 'action-list' }, [
      collection.type === 'normal' ? button('当前词表', '', () => openCollectionMenu(collection.id)) : null,
      button('应用设置与备份', '', () => openSettingsDialog()),
    ].filter(Boolean)),
  ]));
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
      description: `删除 “${entry.text}” 及其全部来源、PIN、标注、学习日期和关系组件。`,
      body: el('div', { className: 'warning-box', text: '确认后执行。该操作仍可通过撤销恢复。' }),
      submitText: '彻底删除',
      onSubmit: async () => { await deleteEntry(entryId); },
    }), { title: '删除内容前是否下载备份？' }));
}

async function openAiAddDialog(collectionId) {
  const state = getState();
  const collection = state.collectionById.get(collectionId);
  const domain = state.domainById.get(collection?.domainId);
  if (!collection || collection.type !== 'normal') { showToast('系统总表只提供投影，不接受新增'); return; }
  if (domain?.contentMode === 'nonStructured') { showToast('非结构内容请使用手动新增；AI 新增暂不生成内容框架'); return; }
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
  /** @type {((value?: unknown) => void) | null} */
  let resolveCompletion = null;
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
    if (resolveCompletion) resolveCompletion();
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
    setContextDockVisible(elements['annotation-review-bar'], 'has-review', false, { clearAfterHide: true });
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
    // Rendering is never allowed to create navigation. User-driven review
    // commands perform any required Collection PUSH before this renderer runs.
    setContextDockVisible(elements['annotation-review-bar'], 'has-review', false, { clearAfterHide: false });
    return;
  }
  setContextDockVisible(elements['pin-bar'], 'has-pin', false);
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
  setContextDockVisible(elements['annotation-review-bar'], 'has-review', true);
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
  setContextDockVisible(elements['annotation-review-bar'], 'has-review', false, { clearAfterHide: true });
  if (currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    if (collection) renderPinBar(collection);
  }
}


function openSearchDialog() {
  const state = getState();
  const input = el('input', { type: 'search', placeholder: '搜索', autocomplete: 'off', spellcheck: false, inputMode: 'search' });
  const scope = el('select');
  scope.append(el('option', { value: 'all', text: '全部内容' }));
  scope.append(el('option', { value: 'global:words', text: '全局词汇' }));
  scope.append(el('option', { value: 'global:phrases', text: '全局短语' }));
  scope.append(el('option', { value: 'global:content', text: '全局非结构总表' }));
  const domains = [...state.domains].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  for (const domain of domains) {
    scope.append(el('option', { value: `domain:${domain.id}`, text: `${domain.name} · 全部` }));
    const group = el('optgroup', { label: domain.name });
    if (domain.contentMode === 'nonStructured') {
      group.append(el('option', { value: `domain-content:${domain.id}`, text: '内容总表' }));
    } else {
      group.append(el('option', { value: `domain-words:${domain.id}`, text: '词汇总表' }));
      group.append(el('option', { value: `domain-phrases:${domain.id}`, text: '短语总表' }));
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
  else if (current.id === SYSTEM_GLOBAL_PHRASES_ID) scope.value = 'global:phrases';
  else if (current.id === SYSTEM_GLOBAL_CONTENT_ID) scope.value = 'global:content';
  else if (current.type === 'system-domain-content') scope.value = `domain-content:${current.domainId}`;
  else if (current.type === 'system-phrases') scope.value = `domain-phrases:${current.domainId}`;
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
    else if (value === 'global:phrases') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_PHRASES_ID).map((entry)=>entry.id));
    else if (value === 'global:content') allowedIds = new Set(getVisibleEntries(SYSTEM_GLOBAL_CONTENT_ID).map((entry)=>entry.id));
    else if (value.startsWith('domain-words:')) allowedIds = new Set(getVisibleEntries(systemDomainWordsCollectionId(value.slice(13))).map((entry)=>entry.id));
    else if (value.startsWith('domain-phrases:')) allowedIds = new Set(getVisibleEntries(systemPhraseCollectionId(value.slice(15))).map((entry)=>entry.id));
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
}

function openSettingsDialog() {
  const state = getState();
  const key = el('input', { type: 'password', value: getApiKey(), autocomplete: 'off', placeholder: 'gsk_…' });
  const collinsKey = el('input', { type: 'password', value: getCollinsApiKey(), autocomplete: 'off', placeholder: 'Collins API Key' });
  const model = el('select');
  const numberMode = el('select', {}, [
    el('option', { value: 'none', text: '无序号', selected: state.settings.numberMode === 'none' }),
    el('option', { value: 'group', text: '小标题内编号', selected: state.settings.numberMode === 'group' }),
    el('option', { value: 'global', text: '连续编号', selected: !['none', 'group'].includes(state.settings.numberMode) }),
  ]);
  const lowLevelRelations = el('input', { type: 'checkbox', className: 'vix-checkbox', checked: state.settings.closeLowLevelRelations !== false });
  const renderModels = () => {
    const catalog = getModelCatalog();
    model.replaceChildren(el('option', { value: '', text: catalog.length ? '选择模型' : '未刷新' }), ...catalog.map((item) => el('option', { value: item.id, text: `${item.id}${item.active ? '' : '（历史）'}`, selected: item.id === getSelectedModel() })));
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
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Groq' }), field('API Key', key), field('模型', model), refresh]),
    el('section', { className: 'settings-section' }, [el('h3', { text: 'Collins' }), field('API Key', collinsKey)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '关联' }), el('label', { className: 'inline-field checkbox-field' }, [el('span', { text: '关闭低级词汇关联' }), lowLevelRelations])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '显示' }), field('序号', numberMode)]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '词库' }), el('div', { className: 'settings-row' }, [manageButton])]),
    el('section', { className: 'settings-section' }, [el('h3', { text: '数据' }), el('div', { className: 'settings-row' }, [exchangeButton])]),
    el('section', { className: 'settings-section settings-version' }, [el('span', { text: `Vocabulary Index ${APP_VERSION}` })]),
  ];
  openDialog({ title: '设置', body, variant: 'management', submitText: '保存', onSubmit: async () => {
    setApiKey(key.value); setCollinsApiKey(collinsKey.value); if (model.value) selectModel(model.value);
    await setNumberMode(numberMode.value);
    await setLowLevelRelationsClosed(lowLevelRelations.checked);
    showToast('已保存');
  } });
}

function showMigrationNotice() {
  const state = getState();
  if (!state.settings.migrationNoticePending) return;
  openDialog({
    title: '数据模型更新完成',
    description: `当前数据库已使用 Schema 6。`,
    body: [
      el('div', { className: 'warning-box', text: '建议立即导出一份当前版本完整 JSON，并保留升级前备份直到真机验收完成。' }),
      el('p', { className: 'help-text', text: '4.0.x 的内容、投影、关系与个人状态都按具体 Entry 语义运行；旧世代文件不做隐式迁移。' }),
    ],
    submitText: '我已了解',
    onSubmit: acknowledgeMigrationNotice,
  });
}

export function notifyServiceWorkerUpdate(worker) {
  waitingServiceWorker = worker || null;
  elements['update-banner']?.classList.toggle('hidden', !waitingServiceWorker);
  updateOverlayLayout();
}

export function serviceWorkerReloadIsArmed() {
  return serviceWorkerReloadPending;
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


function renderApp() {
  const token = ++renderRevision;
  // Navigation Controller state is authoritative. URL/hash is transport only and
  // must never be allowed to destructively rewrite the logical stack from inside
  // the renderer.
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
  if ((historyRestoreInProgress || presentationMutationInProgress) && ['view-mode', 'calendar-month'].includes(type)) return;
  if (type === 'calendar-month') return;
  if (type === 'mutation' && detail?.kind === 'pin') return;
  if (type === 'mutation' && detail?.kind === 'study-date' && currentCollectionId) {
    const collection = getState().collectionById.get(currentCollectionId);
    if (collection && getViewMode(collection.id) === 'alphabet') return;
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

function handleRootUserTouchStart(event) {
  if (openModalCount) return;
  if (event.touches?.length !== 1) return;
  rootUserTouchReleased = false;
  rootUserTouchMoved = false;
  cancelRootScrollTransaction('user-touch');
}

function handleRootUserTouchMove(event) {
  if (openModalCount) return;
  if (event.touches?.length !== 1) return;
  rootUserTouchMoved = true;
}

function handleRootUserTouchEnd() {
  rootUserTouchReleased = true;
  if (!rootUserTouchMoved) rootUserScrollActive = false;
}

function handleRootScrollEnd() {
  clearTimeout(rootUserScrollReleaseTimer);
  rootUserScrollReleaseTimer = 0;
  if (rootUserTouchReleased) rootUserScrollActive = false;
  if (queuedVirtualChunks.size && !scrollCoordinator.isActive()) flushQueuedVirtualChunksNow({ reason: 'scrollend-flush' });
  persistScrollPosition();
}

function handleWindowScroll() {
  if (!rootUserTouchReleased && !scrollCoordinator.isActive()) rootUserScrollActive = true;
  releaseLetterTrackManualLockOnPageMotion();
  if (browseAnchorPress) cancelBrowseAnchorPress({ suppressClick: true });
  if (activeQueryMenu) closeQueryMenu({ immediate: true });
  if (activeRelationTargetMenu) closeRelationTargetMenu({ immediate: true });
  if (!scrollUiFrame) {
    scrollUiFrame = requestAnimationFrame(() => {
      scrollUiFrame = 0;
      updateLargeTitleState();
      syncActiveAlphabetHeading();
      updateBackToTopVisibility();
    });
  }
  if (!('onscrollend' in window)) {
    clearTimeout(rootUserScrollReleaseTimer);
    rootUserScrollReleaseTimer = setTimeout(() => {
      rootUserScrollReleaseTimer = 0;
      if (rootUserTouchReleased) rootUserScrollActive = false;
      if (queuedVirtualChunks.size && !scrollCoordinator.isActive()) flushQueuedVirtualChunksNow({ reason: 'scroll-fallback-flush' });
      persistScrollPosition();
    }, 140);
  }
}

function initializeNavigationModel() {
  navigationRuntimeId = newNavigationToken('runtime');
  navigationRootToken = newNavigationToken('root');
  navigationStack.length = 0;
  appNavigationDepth = 0;
  currentCollectionId = '';
  currentViewKind = 'word';
  pendingPageSnapshot = null;
  suppressPostRenderSnapshotRestore = false;

  // 4.7 target runtime is one iPhone standalone PWA context. VIX internal
  // navigation never creates browser-history entries; Back/Home are pure VIX
  // operations and process restart intentionally returns to Home.
  history.replaceState(rootNavigationHistoryState(), '', location.pathname + location.search);
}

export async function initializeUI() {
  elements['back-button']?.replaceChildren(svgIcon('back'));
  elements['home-button']?.replaceChildren(svgIcon('home'));
  elements['search-button']?.replaceChildren(svgIcon('search'));
  elements['back-to-top']?.replaceChildren(svgIcon('top'));
  elements['update-later-button']?.replaceChildren(svgIcon('close'));
  elements['back-button'].addEventListener('click', navigateBack);
  elements['home-button'].addEventListener('click', resetNavigationToHome);
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
  window.visualViewport?.addEventListener('resize', () => updateVisualViewportVars());
  window.visualViewport?.addEventListener('scroll', () => updateVisualViewportVars(), { passive: true });
  window.addEventListener('resize', () => { updateVisualViewportVars(); scheduleAlphabetSectionMetricsRefresh(); }, { passive: true });
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
  document.addEventListener('touchstart', handleRootUserTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', handleRootUserTouchMove, { passive: true, capture: true });
  document.addEventListener('touchend', handleRootUserTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', handleRootUserTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchstart', handleModalTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', handleModalTouchMove, { passive: false, capture: true });
  if ('onscrollend' in window) window.addEventListener('scrollend', handleRootScrollEnd, { passive: true });
  subscribe(handleStoreEvent);
  await initializeStore();
  initializeNavigationModel();
  updateVisualViewportVars();
  elements['boot-screen'].classList.add('hidden');
  elements.app.classList.remove('hidden');
  renderApp();
  setTimeout(showMigrationNotice, 60);
}
