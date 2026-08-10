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
  'releaseLetterTrackManualLockOnPageMotion', 'runPresentationTransition',
];
for (const name of criticalFunctions) {
  const declarations = [...ui.matchAll(new RegExp(`\\b(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g'))];
  assert.equal(declarations.length, 1, `${name} 必须且只能定义一次`);
}

// Current-page state only: ordinary view/mode switching creates fresh TOP+collapsed state;
// recursive Back restores the one frame that was actually left.
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'));
assert.ok(ui.includes("calendarMonth: mode === 'date'"));
assert.ok(ui.includes('hydrateNavigationSnapshot'));
assert.ok(ui.includes('persistHydratedViewState'));
assert.ok(ui.includes('prepareBackFrame'));
assert.ok(ui.includes("position: { kind: 'top', scrollYFallback: 0 }"));
assert.ok(!ui.includes('viewStateSnapshots'));
assert.ok(!ui.includes('savedAlphabetState'));
assert.ok(!ui.includes('savedDateState'));

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

// LetterNav: real flow anchors -> semantic axis -> continuous locus/camera.
assert.ok(ui.includes("querySelector(':scope > .section-flow-anchor')"));
assert.ok(ui.includes('createSemanticAxis(points)'));
assert.ok(ui.includes('semanticAtPhysical(axis, boundary)'));
assert.ok(ui.includes('physicalAtSemantic(axis, semantic)'));
assert.ok(ui.includes('letter-nav-locus'));
assert.ok(ui.includes('cameraTargetForLocus'));
assert.ok(ui.includes('exponentialApproach'));
assert.ok(ui.includes('semanticVelocity'));
assert.ok(!ui.includes('leftGuard'));
assert.ok(!ui.includes('rightGuard'));
assert.ok(!ui.includes('reversalWindow'));

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

// Page-level semantic motions are distinct, not one generic fade.
for (const kind of ['push', 'pop', 'home', 'sibling-forward', 'sibling-back', 'reindex-to-date', 'reindex-to-alphabet']) {
  assert.ok(ui.includes(`'${kind}'`) || ui.includes('presentationMotionClass'), `缺少 motion 语义：${kind}`);
}
assert.ok(ui.includes('document.startViewTransition'));
assert.ok(ui.includes('closeSearchDialogForNavigation'));

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
for (const symbol of ['createSemanticAxis', 'semanticAtPhysical', 'physicalAtSemantic', 'semanticScrollDuration', 'physicalScrollDuration', 'cameraTargetForLocus', 'exponentialApproach']) {
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
