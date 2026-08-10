import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'js/v3-ui.js'), 'utf8');

const criticalFunctions = [
  'openDialog', 'renderAlphabetContent', 'renderDateContent',
  'setLetterSectionOpen', 'toggleLetterSectionWithAnchor', 'setDateSectionOpen', 'toggleDateSectionWithAnchor',
  'updateActiveLetter', 'syncActiveAlphabetHeading', 'renderEntryRow', 'switchCollectionView',
  'switchCollectionMode', 'bindBrowseAnchorButton', 'calendarForSection', 'topChromeBottom',
  'relationNavigationMode', 'normalDestinationsForEntries', 'openSearchDialog', 'startProviderQuery',
  'providerQueryIsCurrent', 'beginLongpressGuard', 'endLongpressGuardWithGrace', 'alphabetNavAttached',
  'resetNavigationToHome', 'initializeNavigationModel', 'jumpToAlphabetLetter', 'captureSemanticPosition',
  'handleNavigationApiNavigate', 'handleNavigationEdgeTouchStart', 'collapseNativeStickySection', 'stickyCollapseGeometry',
];
for (const name of criticalFunctions) {
  const declarations = [...ui.matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'))];
  assert.equal(declarations.length, 1, `${name} 必须且只能定义一次`);
}

assert.ok((ui.match(/setLetterSectionOpen\s*\(/g) || []).length >= 4);
assert.ok((ui.match(/setDateSectionOpen\s*\(/g) || []).length >= 4);
assert.ok(ui.includes("toggleLetterSectionWithAnchor(section, letter, event.currentTarget)"));
assert.ok(ui.includes("toggleDateSectionWithAnchor(section, dateKey, event.currentTarget)"));
assert.ok(ui.includes("toggleDateSectionWithAnchor(section, 'unmarked', event.currentTarget)"));

// Fresh navigation and recursive history are separate semantics.
assert.ok(ui.includes("if (reason === 'home')"));
assert.ok(ui.includes("hydrateRuntimeViewState(collection.id, { mode: 'alphabet', section: nextView })"));
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'));
assert.ok(ui.includes("calendarMonth: mode === 'date'"));
assert.ok(ui.includes('restoreSnapshotAfterRender'));
assert.ok(ui.includes('pendingUaScrollRestore'));
assert.ok(ui.includes('hydrateNavigationSnapshot'));
assert.ok(ui.includes('persistHydratedViewState'));

// Longpress is a lifecycle, not a single timeout + click suppression patch.
assert.ok(ui.includes("classList.add('longpress-active', 'longpress-guard')"));
assert.ok(ui.includes('endLongpressGuardWithGrace(350)'));
assert.ok(ui.includes('window.setTimeout(() => {'));
assert.ok(ui.includes('}, 520)'));
assert.ok(ui.includes("for (const type of ['selectstart', 'contextmenu'])"));
assert.ok(ui.includes('if (!press.fired && Math.hypot'));
assert.ok(ui.includes('if (press.fired && grace) endLongpressGuardWithGrace(350)'));
assert.ok(ui.includes('window.getSelection?.()?.removeAllRanges()'));

// Sticky geometry has one measured owner and is propagated to CSS.
assert.ok(ui.includes('function topChromeBottom'));
assert.ok(ui.includes("setProperty('--content-sticky-top'"));
assert.ok(ui.includes('sealedBottom'));
assert.ok(ui.includes('return baseBottom + navHeight'));
assert.ok(!ui.includes('Math.max(bottom, viewportTop + 72)'));
assert.ok(ui.includes('const stickyEngaged = activeIndex >= 0'));
assert.ok(!ui.includes('const liveBoundary = navAttached'));
assert.ok(ui.includes('if (scrollCoordinator.isActive()) return;'));
assert.ok(ui.includes('finalizeRootScrollPresentation'));
assert.ok(!ui.includes("setProperty('--content-sticky-top', '52px')"));
assert.ok(!ui.includes("elements['sticky-letter-heading']"));
assert.ok(ui.includes('trackState.manualLockStickyEngaged = alphabetNavAttached()'));
assert.ok(ui.includes('if (state && !state.manualLocked) state.manualLockStickyEngaged = stickyEngaged'));
assert.ok(!ui.includes("querySelector('.letter-heading.active-sticky')"));

assert.ok(ui.includes("const preserveDateViewport = mode === 'date'"));
assert.ok(ui.includes("beginRootScrollTransaction('study-date-refresh'"));
assert.ok(ui.includes('restoreSemanticPosition(position, transaction.epoch'));
assert.ok(!ui.includes("pendingJumpReason = 'study-date'"));
assert.ok(!ui.includes('syncSystemShellSurface'));
assert.ok(!ui.includes('MODAL_BACKDROP_ALPHA'));
assert.ok(ui.includes('resetNavigationToHome'));
assert.ok(!ui.includes('navigationGeneration'));
assert.ok(ui.includes("const NAVIGATION_MODEL = 'destructive-v3'"));
assert.ok(ui.includes('rootBrowserKey'));
assert.ok(ui.includes('deadBrowserKeys'));
assert.ok(ui.includes('discardNavigationFramesFrom'));
assert.ok(!ui.includes('if (!route.collectionId && (appNavigationDepth > 0 || navigationStack.length > 0))'));
assert.ok(ui.includes('classifyCurrentNavigationKey'));
assert.ok(ui.includes('forbiddenForwardNeighborExists'));
assert.ok(ui.includes("scroll: 'manual'"));
assert.ok(ui.includes('event.scroll()'));
assert.ok(!ui.includes("scroll: useUaScroll ? 'after-transition' : 'manual'"));
assert.ok(!ui.includes('pageSnapshot'));
assert.ok(!ui.includes('showModalStable'));
assert.ok(!ui.includes("body.style.position = 'fixed'"));
assert.ok(ui.includes('switchParallel:'));
assert.ok(ui.includes("[toggleGlobal, ...homeActions]"));

// Browser history identity is explicit and snapshots do not rewrite it.
assert.ok(ui.includes('function rootNavigationHistoryState'));
assert.ok(ui.includes('function pageNavigationHistoryState'));
assert.ok(ui.includes("if (!token) throw new Error('Navigation page identity requires an explicit token')"));
const persistStart = ui.indexOf('function persistCurrentHistorySnapshot');
const persistEnd = ui.indexOf('function applySnapshotBeforeRender', persistStart);
const persistSource = ui.slice(persistStart, persistEnd);
assert.ok(!persistSource.includes('history.replaceState'), 'scroll/snapshot persistence must not rewrite browser identity');
assert.ok(ui.includes('history.pushState(pageNavigationHistoryState(token)'));
assert.ok(ui.includes('globalThis.navigation.traverseTo(targetKey)'));
assert.ok(ui.includes('parentBrowserKey({ rootKey: rootBrowserKey'));
assert.ok(!ui.includes('event.destination?.getState'), 'NavigationDestination.getState must not be mixed with classic history.state');
assert.ok(!ui.includes('navigationEntryStateFromDestination'));
assert.ok(ui.includes("if (navigationApiAvailable()) globalThis.navigation.addEventListener('navigate', handleNavigationApiNavigate)"));
assert.ok(ui.includes("else window.addEventListener('popstate', handleHistoryNavigationFallback)"));
assert.ok(!ui.includes('navigationApiHandledTokens'));
assert.ok(!ui.includes('markNavigationApiHandledToken'));
assert.equal((ui.match(/history\.replaceState\s*\(/g) || []).length, 1, 'runtime may replace the root slot only once during boot');
const navStart = ui.indexOf('async function navigateCollection');
const navEnd = ui.indexOf('\nfunction requestTraverseToKey', navStart);
const navSource = ui.slice(navStart, navEnd);
assert.ok(navSource.indexOf('history.pushState(pageNavigationHistoryState(token)') >= 0);
const firstExecutableAwait = navSource.search(/\n\s*await\s+/);
assert.ok(firstExecutableAwait < 0 || navSource.indexOf('history.pushState(pageNavigationHistoryState(token)') < firstExecutableAwait, 'real PUSH must happen before any await');
assert.ok(!navSource.includes('setTimeout('), 'real PUSH must not wait for a presentation timer');
const searchStart = ui.indexOf('const selectResult = (entry, collectionId) =>');
const searchEnd = ui.indexOf('const showEntries', searchStart);
assert.ok(!ui.slice(searchStart, searchEnd).includes('setTimeout('), 'search navigation must not use timer-delayed PUSH');
assert.ok(ui.slice(searchStart, searchEnd).includes('requestAnimationFrame('), 'cross-Collection search must pass a presentation fence after hard-close');
assert.ok(ui.slice(searchStart, searchEnd).includes('closeSearchDialog({ immediate: true })'));
assert.ok(ui.includes('historyRestoreInProgress = true'));
assert.ok(ui.includes('updateModalViewportGeometry({ immediate: true })'));
const lockStart = ui.indexOf('function lockPageForModal');
const lockEnd = ui.indexOf('function modalScrollableTarget', lockStart);
const lockSource = ui.slice(lockStart, lockEnd);
assert.ok(!lockSource.includes("classList.add('modal-open')"));
assert.ok(!lockSource.includes('document.documentElement.classList'));
assert.ok(!lockSource.includes('document.body.classList'));
assert.ok(!lockSource.includes('style.overflow'));

// Four-state relation classification uses complete canonical target sets.
for (const value of ["'intra'", "'external'", "'nonstruct'", "'multi'"]) assert.ok(ui.includes(`return ${value}`));
assert.ok(ui.includes('normalDestinationsForEntries'));
assert.ok(ui.includes('getRelatedEntries(entry.id)'));

// Non-structured UI keeps the shell and disables only irrelevant view switching.
assert.ok(ui.includes("domain?.contentMode === 'nonStructured'"));
assert.ok(ui.includes("switchButton.disabled = !canSwitch"));
assert.ok(ui.includes("return 'content';"));

// Query session has abort/stale-response ownership.
assert.ok(ui.includes('activeProviderQuery.controller.abort()'));
assert.ok(ui.includes('providerQueryIsCurrent(sequence)'));
assert.ok(ui.includes('controller.signal.aborted'));

// No old page-view snapshot cache may silently turn Home entry into resume.
assert.ok(!ui.includes('viewStateSnapshots'));
assert.ok(!ui.includes("pendingJumpReason = validAnchor ? 'mode-anchor' : 'home'"));

// 4.6 scroll ownership: virtualization reports geometry, only the coordinator adapter writes the root viewport.
assert.ok(ui.includes('createScrollCoordinator()'));
assert.ok(ui.includes("beginRootScrollTransaction('letter-jump'"));
assert.ok(ui.includes("beginRootScrollTransaction('virtual-materialize'"));
assert.ok(ui.includes("rootMargin: '960px 0px 960px'"));
assert.ok(ui.includes('const ENTRY_CHUNK_SIZE = 42'));
assert.ok(ui.includes('virtualLayoutCache: new Map()'));
assert.ok(ui.includes('captureSemanticPosition'));
assert.ok(ui.includes('settleSemanticPosition'));
assert.ok(!ui.includes('function restoreScrollAnchor('));
assert.equal((ui.match(/window\.scrollTo\s*\(/g) || []).length, 2);
assert.equal((ui.match(/window\.scrollBy\s*\(/g) || []).length, 0);

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
const tsc = spawnSync('tsc', [
  '--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ES2022',
  '--moduleResolution', 'Bundler', ...jsFiles, '--skipLibCheck', '--lib', 'ES2022,DOM,DOM.Iterable',
], { cwd: root, encoding: 'utf8' });
if (!tsc.error || tsc.error.code !== 'ENOENT') {
  assert.equal(tsc.status, 0, `TypeScript checkJs 未通过：\n${tsc.stdout}${tsc.stderr}`);
}

console.log('runtime-symbol-tests: OK');
