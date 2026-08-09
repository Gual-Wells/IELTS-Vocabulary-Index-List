import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'js/v3-ui.js'), 'utf8');

const criticalFunctions = [
  'openDialog', 'showModalStable', 'renderAlphabetContent', 'renderDateContent',
  'setLetterSectionOpen', 'toggleLetterSectionWithAnchor', 'setDateSectionOpen', 'toggleDateSectionWithAnchor',
  'updateActiveLetter', 'syncActiveAlphabetHeading', 'renderEntryRow', 'switchCollectionView',
  'switchCollectionMode', 'bindBrowseAnchorButton', 'calendarForSection', 'topChromeBottom',
  'relationNavigationMode', 'normalDestinationsForEntries', 'openSearchDialog', 'startProviderQuery',
  'providerQueryIsCurrent', 'beginLongpressGuard', 'endLongpressGuardWithGrace', 'alphabetNavAttached',
  'resetNavigationToHome', 'finalizeNavigationResetToHome',
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
assert.ok(ui.includes("await setViewMode(collection.id, 'alphabet', nextView)"));
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'));
assert.ok(ui.includes("calendarMonth: mode === 'date'"));
assert.ok(ui.includes('restoreSnapshotAfterRender'));

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
assert.ok(ui.includes('const stickyEngaged = navAttached && activeIndex >= 0'));
assert.ok(!ui.includes("setProperty('--content-sticky-top', '52px')"));
assert.ok(!ui.includes("elements['sticky-letter-heading']"));
assert.ok(ui.includes('trackState.manualLockStickyEngaged = alphabetNavAttached()'));
assert.ok(ui.includes('if (state && !state.manualLocked) state.manualLockStickyEngaged = stickyEngaged'));
assert.ok(!ui.includes("querySelector('.letter-heading.active-sticky')"));

assert.ok(ui.includes("const preserveDateViewport = mode === 'date'"));
assert.ok(ui.includes('preservedScrollY'));
assert.ok(!ui.includes("pendingJumpReason = 'study-date'"));
assert.ok(!ui.includes('syncSystemShellSurface'));
assert.ok(!ui.includes('MODAL_BACKDROP_ALPHA'));
assert.ok(ui.includes('resetNavigationToHome'));
assert.ok(ui.includes('navigationEpoch'));
assert.ok(ui.includes('switchParallel:'));
assert.ok(ui.includes("[toggleGlobal, ...homeActions]"));

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

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
const tsc = spawnSync('tsc', [
  '--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ES2022',
  '--moduleResolution', 'Bundler', ...jsFiles, '--skipLibCheck', '--lib', 'ES2022,DOM,DOM.Iterable',
], { cwd: root, encoding: 'utf8' });
if (!tsc.error || tsc.error.code !== 'ENOENT') {
  assert.equal(tsc.status, 0, `TypeScript checkJs 未通过：\n${tsc.stdout}${tsc.stderr}`);
}

console.log('runtime-symbol-tests: OK');
