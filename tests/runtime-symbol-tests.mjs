import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'js/v3-ui.js'), 'utf8');
const motion = fs.readFileSync(path.join(root, 'js/v3-motion-runtime.js'), 'utf8');

const criticalFunctions = [
  'openDialog', 'renderAlphabetContent', 'renderDateContent',
  'setLetterSectionOpen', 'toggleLetterSectionWithAnchor', 'setDateSectionOpen', 'toggleDateSectionWithAnchor',
  'updateActiveLetter', 'syncActiveAlphabetHeading', 'renderEntryRow', 'switchCollectionView',
  'switchCollectionMode', 'bindBrowseAnchorButton', 'calendarForSection', 'topChromeBottom',
  'relationNavigationMode', 'normalDestinationsForEntries', 'openSearchDialog', 'startProviderQuery',
  'providerQueryIsCurrent', 'beginLongpressGuard', 'endLongpressGuardWithGrace', 'alphabetNavAttached',
  'resetNavigationToHome', 'initializeNavigationModel', 'jumpToAlphabetLetter', 'captureSemanticPosition',
  'collapseNativeStickySection', 'stickyCollapseGeometry', 'animateRootToSemanticPosition',
  'prepareSemanticPositionGeometry', 'alphabetAxisForSection', 'renderLetterRailSemanticPosition',
  'releaseLetterTrackManualLockOnPageMotion', 'runPresentationTransition', 'runBufferedCollectionCommit', 'runRootBufferedCommit', 'enqueuePresentationIntent', 'readingChromeBottom', 'toggleEntryRelations',
];
for (const name of criticalFunctions) {
  const declarations = [...ui.matchAll(new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g'))];
  assert.equal(declarations.length, 1, `${name} 必须且只能定义一次`);
}

// 4.7.2 restores the 4.6 switch-action contract while retaining 4.7.1 buffered presentation.
// Manual Word/Phrase and Alphabet/Date switches are fresh TOP + collapsed commits;
// transient neighborhood mapping is forbidden on those manual switch paths.
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'));
assert.ok(ui.includes("calendarMonth: mode === 'date'"));
assert.ok(ui.includes('hydrateNavigationSnapshot'));
assert.ok(ui.includes('persistHydratedViewState'));
assert.ok(ui.includes('prepareBackFrame'));
assert.ok(ui.includes('restoreTransientSemanticPosition'));
assert.ok(ui.includes('runBufferedCollectionCommit'));
assert.ok(ui.includes('enqueuePresentationIntent'));
assert.ok(!ui.includes('transientModeSwitchAnchor'));
assert.ok(!ui.includes('transientViewSwitchTarget'));
assert.ok(!ui.includes('switchAnchorOffset'));
assert.ok(!ui.includes('nearestAlphabetGroup'));
assert.ok(!ui.includes('nearestDateGroup'));
assert.ok(!ui.includes('if (bufferedStateCommitInProgress) return;'));
assert.ok(!ui.includes('viewStateSnapshots'));
assert.ok(!ui.includes('savedAlphabetState'));
assert.ok(!ui.includes('savedDateState'));

const viewSwitchStart = ui.indexOf('async function switchCollectionViewNow');
const viewSwitchEnd = ui.indexOf('\nfunction sectionForEntry', viewSwitchStart);
const viewSwitchSource = ui.slice(viewSwitchStart, viewSwitchEnd);
assert.ok(viewSwitchSource.includes("position: { kind: 'top', scrollYFallback: 0 }"));
assert.ok(viewSwitchSource.includes('expandedGroups: []'));
assert.ok(viewSwitchSource.includes("const targetMonth = mode === 'date' ? getCalendarMonth(collection.id, nextKind) : ''"));
assert.ok(!viewSwitchSource.includes('captureSemanticPosition'));

const modeSwitchStart = ui.indexOf('async function switchCollectionModeNow');
const modeSwitchEnd = ui.indexOf('\nfunction monthShift', modeSwitchStart);
const modeSwitchSource = ui.slice(modeSwitchStart, modeSwitchEnd);
assert.ok(modeSwitchSource.includes("const nextMonth = nextMode === 'date' ? initialCalendarMonthForView(collection.id, section) : ''"));
assert.ok(modeSwitchSource.includes("position: { kind: 'top', scrollYFallback: 0 }"));
assert.ok(modeSwitchSource.includes('expandedGroups: []'));
assert.ok(!modeSwitchSource.includes('captureSemanticPosition'));

const sameCollectionStart = ui.indexOf('if (currentCollectionId === collectionId)', ui.indexOf('async function navigateCollectionNow'));
const sameCollectionEnd = ui.indexOf('\n  const token = newNavigationToken', sameCollectionStart);
const sameCollectionSource = ui.slice(sameCollectionStart, sameCollectionEnd);
const afterBufferedTarget = sameCollectionSource.slice(sameCollectionSource.indexOf('await runBufferedCollectionCommit'));
assert.ok(afterBufferedTarget.includes('position: targetPosition'));
assert.ok(!afterBufferedTarget.includes('await jumpToEntry(entryId'), 'same-Collection view target must not perform a second semantic position transaction');

const bufferStart = ui.indexOf('async function runBufferedCollectionCommit');
const bufferEnd = ui.indexOf('\nasync function runRootBufferedCommit', bufferStart);
const bufferSource = ui.slice(bufferStart, bufferEnd);
assert.ok(!bufferSource.includes('toolbar.inert = true'));
assert.ok(bufferSource.includes("elements['bottom-last-position']"));
assert.ok(bufferSource.includes("elements['back-to-top']"));
assert.ok(bufferSource.includes("elements['bottom-search']"));

// 4.7 single-slot PWA navigation: Safari history is not the VIX transport rail.
assert.ok(ui.includes("const NAVIGATION_MODEL = 'single-slot-vix-v1'"));
assert.ok(ui.includes('navigationStack'));
assert.ok(ui.includes('resetNavigationToHome'));
assert.ok(ui.includes('runPresentationTransition'));
assert.equal((ui.match(/history\.replaceState\s*\(/g) || []).length, 1, '仅启动期允许一次 root replaceState');
assert.equal((ui.match(/history\.pushState\s*\(/g) || []).length, 0, '内部页面不得创建 Safari History slot');
assert.equal((ui.match(/\.traverseTo\s*\(/g) || []).length, 0, '内部 Back 不得使用 Navigation API traverseTo');
assert.equal((ui.match(/history\.(?:back|go|forward)\s*\(/g) || []).length, 0, '内部导航不得调用浏览器 traversal');
for (const retired of ['rootBrowserKey', 'deadBrowserKeys', 'browserKey', 'handleNavigationApiNavigate', 'handleHistoryNavigationFallback', 'forbiddenForwardNeighborExists']) {
  assert.ok(!ui.includes(retired), `已退役 Browser History Rail 符号仍在 active UI：${retired}`);
}

// LetterNav: semantic axis remains internal; visible state is one discrete active cell
// and camera movement is safe-zone gated rather than continuous locus chasing.
assert.ok(ui.includes("querySelector(':scope > .section-flow-anchor')"));
assert.ok(ui.includes('createSemanticAxis(points)'));
assert.ok(ui.includes('semanticAtPhysical(axis, boundary)'));
assert.ok(ui.includes('physicalAtSemantic(axis, semantic)'));
assert.ok(!ui.includes('letter-nav-locus'));
assert.ok(!ui.includes('cameraTargetForLocus'));
assert.ok(!ui.includes('semanticVelocity'));
assert.ok(ui.includes('cameraTargetForActiveCell'));
assert.ok(ui.includes('safeStartRatio: .38'));
assert.ok(ui.includes('safeEndRatio: .62'));
assert.ok(ui.includes('activeChanged'));
assert.ok(ui.includes('exponentialApproach'));
assert.ok(!motion.includes('letterRailFocusRatio'));
assert.ok(!motion.includes('cameraTargetForLocus'));
assert.ok(ui.includes('cachedChromeBottom > 0 ? cachedChromeBottom : topChromeBottom()'));

// Manual rail drag is one-way: horizontal drag never moves root; its location persists until page motion.
assert.ok(ui.includes('manualLocked: false'));
assert.ok(ui.includes('manualLockScrollY'));
assert.ok(ui.includes('releaseLetterTrackManualLockOnPageMotion'));
assert.ok(ui.includes('if (Math.abs(window.scrollY - state.manualLockScrollY) <= .5) continue'));
const populateStart = ui.indexOf('function populateNavigationBar');
const populateEnd = ui.indexOf('\nfunction collapseNativeStickySection', populateStart);
const populate = ui.slice(populateStart, populateEnd);
assert.ok(populate.includes('pointerActive = false'));
assert.ok(!populate.includes('releaseLetterTrackManualLock('), 'LetterNav pointerup/cancel 不得自动复原');
assert.ok(populate.includes("track.addEventListener('pointerdown'"));
assert.ok(populate.includes("track.addEventListener('pointerup'"));

// Date calendar is a query/jump control only; no page-scroll -> calendar camera synchronization.
const calendarStart = ui.indexOf('function calendarForSection');
const calendarEnd = ui.indexOf('\nasync function jumpToAlphabetLetter', calendarStart);
const calendarSource = ui.slice(calendarStart, calendarEnd);
assert.ok(calendarSource.includes('positionHeadingBelowChrome(target)'));
assert.ok(!ui.includes('syncActiveCalendar'));
assert.ok(!ui.includes('calendarSemanticPosition'));
assert.ok(!ui.includes('calendarRail'));

// Motion begins after target geometry preparation. Same-page jumps are true root scrolling.
assert.ok(ui.includes('prepareSemanticPositionGeometry(position'));
assert.ok(ui.includes('materializeChunksAroundScrollY'));
assert.ok(ui.includes('semanticScrollDuration(logicalDistance'));
assert.ok(ui.includes('MOTION_EASE.scroll(raw)'));
assert.ok(ui.includes("owner: 'letter-jump'"));
assert.ok(ui.includes("rootMargin: '960px 0px 960px'"));
assert.ok(ui.includes('const ENTRY_CHUNK_SIZE = 42'));
assert.ok(ui.includes('virtualLayoutCache: new Map()'));
assert.ok(!ui.includes('function restoreScrollAnchor('));
assert.equal((ui.match(/window\.scrollTo\s*\(/g) || []).length, 2);
assert.equal((ui.match(/window\.scrollBy\s*\(/g) || []).length, 0);

// Page-level motion is gated by semantics: Push/Pop use View Transition;
// Home and representation/category switches use non-overlapping buffered commits.
assert.ok(ui.includes("runPresentationTransition('push'"));
assert.ok(ui.includes("runPresentationTransition('pop'"));
assert.ok(ui.includes('runRootBufferedCommit'));
assert.ok(ui.includes('runBufferedCollectionCommit'));
assert.ok(!ui.includes("runPresentationTransition('home'"));
assert.ok(!ui.includes("runPresentationTransition('sibling-forward'"));
assert.ok(!ui.includes("runPresentationTransition('reindex-to-date'"));
assert.ok(ui.includes('document.startViewTransition'));
assert.ok(ui.includes('closeSearchDialogForNavigation'));
assert.ok(ui.includes('closeRelationTargetMenu({ immediate: true })'));
assert.ok(ui.includes("panel?.animate?.(["));

// Modal geometry lock remains retained; no root overflow/position mutation is reintroduced.
assert.ok(ui.includes('updateModalViewportGeometry({ immediate: true })'));
const lockStart = ui.indexOf('function lockPageForModal');
const lockEnd = ui.indexOf('function modalScrollableTarget', lockStart);
const lockSource = ui.slice(lockStart, lockEnd);
assert.ok(!lockSource.includes("classList.add('modal-open')"));
assert.ok(!lockSource.includes('style.overflow'));
assert.ok(!ui.includes("body.style.position = 'fixed'"));

// Relation/provider semantics remain intact.
for (const value of ["'intra'", "'external'", "'nonstruct'", "'multi'"]) assert.ok(ui.includes(`return ${value}`));
assert.ok(ui.includes('normalDestinationsForEntries'));
assert.ok(ui.includes('activeProviderQuery.controller.abort()'));
assert.ok(ui.includes('providerQueryIsCurrent(sequence)'));

// DOM-free motion math remains isolated and testable.
for (const symbol of ['createSemanticAxis', 'semanticAtPhysical', 'physicalAtSemantic', 'semanticScrollDuration', 'physicalScrollDuration', 'cameraTargetForActiveCell', 'exponentialApproach']) {
  assert.ok(motion.includes(`function ${symbol}`) || motion.includes(`export function ${symbol}`), `motion primitive missing: ${symbol}`);
}

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
const tsc = spawnSync('tsc', [
  '--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ES2022',
  '--moduleResolution', 'Bundler', ...jsFiles, '--skipLibCheck', '--lib', 'ES2022,DOM,DOM.Iterable',
], { cwd: root, encoding: 'utf8' });
if (!tsc.error || tsc.error.code !== 'ENOENT') {
  assert.equal(tsc.status, 0, `TypeScript checkJs 未通过：\n${tsc.stdout}${tsc.stderr}`);
}

console.log('runtime-symbol-tests: OK');
