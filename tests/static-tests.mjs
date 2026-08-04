import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const html = read('index.html');
const ui = read('js/v3-ui.js');
const store = read('js/v3-store.js');
const model = read('js/v3-model.js');
const db = read('js/v3-db.js');
const exchange = read('js/v3-exchange.js');
const integrations = read('js/v3-integrations.js');
const ai = read('js/v3-ai.js');
const app = read('js/v3-app.js');
const upgrade = read('js/v3-upgrade.js');
const sw = read('sw.js');
const cssBase = read('css/v3.css');
const css331 = read('css/v3.3.1.css');
const css340 = read('css/v3.4.0.css');
const cssRelease = read('css/v3.5.2.css');
const css = `${cssBase}\n${css331}\n${css340}\n${cssRelease}`;
const pkg = JSON.parse(read('package.json'));
const seed = JSON.parse(read('data/seed.json'));

// Release identity and complete shell.
assert.equal(pkg.version, '3.5.2');
assert.equal(seed.appVersion, '3.5.2');
assert.ok(html.includes('name="application-version" content="3.5.2"'));
assert.ok(html.includes('<title>Vocabulary Index 3.5.2</title>'));
assert.ok(app.includes("const MODULE_VERSION = '3.5.2'"));
assert.ok(sw.includes('v3.5.2-runtime-stabilization-20260804-1'));
assert.ok(upgrade.includes('vocabulary-index:cache-bridge:3.5.2'));
assert.ok(html.includes('./css/v3.5.2.css'));
assert.ok(sw.includes('./css/v3.5.2.css'));
assert.ok(html.includes('maximum-scale=1') && html.includes('viewport-fit=cover'));
assert.ok(html.includes("script-src 'self'"));
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(html));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');
for (const id of [
  'app', 'home-view', 'collection-view', 'letter-nav', 'entry-list', 'pin-bar',
  'bottom-toolbar', 'bottom-last-position', 'back-to-top', 'bottom-mode',
  'bottom-view-switch', 'bottom-search', 'query-menu', 'relation-target-menu',
]) assert.ok(ids.includes(id), `HTML 缺少 ${id}`);

// iPhone shell, viewport recovery and fixed chrome.
assert.ok(app.includes('recoverStandaloneViewportIfNeeded'));
assert.ok(app.includes("document.addEventListener('visibilitychange'"));
assert.ok(ui.includes("window.visualViewport?.addEventListener('resize'"));
assert.ok(css.includes('-webkit-text-size-adjust: 100%'));
assert.ok(cssRelease.includes('grid-template-areas: "back title actions"'));
assert.ok(cssRelease.includes('left: 50%'));
assert.ok(cssRelease.includes('transform: translateX(-50%)'));

// Modal scroll ownership: body is fixed and touch propagation is bounded.
assert.ok(ui.includes("body.style.position = 'fixed'"));
assert.ok(ui.includes('body.style.top = `-${modalScrollY}px`'));
assert.ok(ui.includes('function handleModalTouchMove'));
assert.ok(ui.includes('event.preventDefault()'));
assert.ok(ui.includes("document.addEventListener('touchmove', handleModalTouchMove, { passive: false"));
assert.ok(cssRelease.includes('overscroll-behavior: contain'));

// Real internal navigation stack and per-page snapshots.
for (const token of [
  'function currentSnapshot()', 'function persistCurrentHistorySnapshot()',
  'function navigateCollection(', 'function navigateBack()', 'function handleHistoryNavigation(',
  "history.pushState({ vix: true, depth }", "window.addEventListener('popstate', handleHistoryNavigation)",
]) assert.ok(ui.includes(token), `缺少返回栈实现：${token}`);
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'));
assert.ok(ui.includes('mode,'));
assert.ok(ui.includes("calendarMonth: mode === 'date'"));
assert.ok(ui.includes('expandedRelations: [...expandedRelations]'));

// Ordinary collections are two independent projections; system views cannot switch.
assert.ok(ui.includes("allEntries.filter((entry) => entry.kind === currentViewKind)"));
assert.ok(ui.includes('function switchCollectionView(collection, nextKind)'));
assert.ok(ui.includes("const canSwitch = collection.type === 'normal'"));
assert.ok(ui.includes("switchButton.disabled = !canSwitch"));
assert.ok(store.includes('export function getViewMode(collectionId, section = \'main\')'));
assert.ok(store.includes('export async function setViewMode(collectionId, mode, section = \'main\')'));
assert.ok(store.includes('const key = `${collectionId}:${section}`'));
assert.ok(store.includes('`lastPosition:${domainId}:${collectionId}:${mode}:${section}`'));
assert.ok(ui.includes('function bindBrowseAnchorButton'));
assert.ok(ui.includes('长按保存当前位置'));
assert.ok(ui.includes('Math.hypot(event.clientX - press.startX'));
assert.ok(ui.includes("const entryId = firstVisibleEntryId() || '';"));
assert.equal((ui.match(/setLastPosition\(/g) || []).length, 1, '浏览锚点只能由长按保存路径写入');
assert.ok(!ui.includes('function modeSwitchAnchorEntryId'));
assert.ok(!ui.includes("pendingJumpReason = validAnchor ? 'mode-anchor' : 'home'"));
assert.ok(ui.includes("pendingJumpReason = 'home';"));
assert.ok(ui.includes('expandedLettersFor(collection.id, nextKind).clear()'));
assert.ok(ui.includes('expandedLettersFor(collection.id, section).clear()'));
assert.ok(!ui.includes('viewStateSnapshots'));
assert.ok(ui.includes("iconButton('chevrons', 'calendar-prev-year'"));
assert.ok(ui.includes("iconButton('chevrons', 'calendar-next-year'"));
assert.ok(ui.includes('function setDateSectionOpen'));
assert.ok(ui.includes('function toggleDateSectionWithAnchor'));
assert.ok(ui.includes('date-group-indicator${open'));
assert.ok(ui.includes("dateExpansionKey('unmarked')"));
assert.ok(ui.includes("showModalStable(elements['search-dialog'])"));
assert.ok(ui.includes('window.getSelection?.()?.removeAllRanges()'));
assert.ok(cssRelease.includes('-webkit-touch-callout: none !important'));
assert.ok(cssRelease.includes('grid-template-columns: 38px 34px minmax(0, 1fr) 34px 38px !important'));


// Bottom toolbar has one stable owner; top search is removed from collection pages.
assert.ok(cssRelease.includes('.bottom-toolbar'));
assert.ok(cssRelease.includes('grid-template-columns: repeat(5'));
assert.ok(cssRelease.includes('height: var(--bottom-toolbar-height)'));
assert.ok(!cssRelease.includes('height: calc(var(--bottom-toolbar-height) + env(safe-area-inset-bottom))'));
assert.ok(cssRelease.includes('.bottom-toolbar > button:disabled .ui-icon { opacity: .3; }'));
assert.ok(cssRelease.includes('.bottom-toolbar > button:disabled { color: var(--muted); opacity: 1; }'));
assert.ok(ui.includes("elements['search-button'].classList.add('hidden')"));
assert.ok(ui.includes("elements['bottom-search'].onclick = openSearchDialog"));
assert.ok(ui.includes("elements['bottom-view-switch']"));

// Alphabet track contains letters only and follows immediately, without smooth chase.
assert.ok(ui.includes("className: 'letter-nav-track'"));
assert.ok(ui.includes('return { fixed: [], track }'));
assert.ok(!ui.includes("behavior: 'smooth'"), '运行时不得再使用平滑滚动追赶');
assert.ok(ui.includes("if (letter === 'A') { moveLetterTrack(track, 0, -1)"));
assert.ok(ui.includes("if (letter === '#') { moveLetterTrack(track, track.scrollWidth - track.clientWidth, 1)"));
assert.ok(ui.includes('const leftGuard = trackRect.left + itemWidth * 1.15'));
assert.ok(ui.includes('const rightGuard = trackRect.right - itemWidth * 1.15'));
assert.ok(!ui.includes('scheduleLetterTrackSync(205)'));
assert.ok(ui.includes('manualLocked: false'));
assert.ok(ui.includes('allowManualRelease: Boolean(activeChanged || stickyBoundaryNewlyEngaged)'));
assert.ok(!ui.includes('movedSinceManualLock'), '字母轨道在页面顶部或底部都不能仅因边界滚动回弹而解除手动锁定');
assert.ok(ui.includes('manualLockStickyEngaged'), '人工锁必须记录手势发生时标题是否已经 sticky');
assert.ok(ui.includes('stickyBoundaryNewlyEngaged'), '只有标题从未 sticky 进入真实 sticky 边界时才允许同字母接管');
assert.ok(ui.includes('function releaseLetterTrackManualLock'));
assert.ok(cssRelease.includes('scroll-behavior: auto !important'));
assert.ok(cssRelease.includes('.letter-heading'));
assert.ok(cssRelease.includes('position: sticky !important'));
assert.ok(cssRelease.includes('backdrop-filter: none !important'));

// Entry layout: inline number, source on shell border, no index badge/side rail.
assert.ok(ui.includes("className: 'entry-index-inline'"));
assert.ok(ui.includes("className: 'entry-lexeme-stack'"));
assert.ok(ui.includes("className: `entry-control-stack${sourceDomainLabel ? ' has-source' : ''}`"));
assert.ok(ui.includes("className: 'entry-control-main'"));
assert.ok(ui.includes("className: 'entry-source-domain'"));
assert.ok(!ui.includes('entry-gloss-placeholder'));
assert.ok(!ui.includes("className: 'entry-index-badge'"));
assert.ok(!ui.includes("className: 'entry-relation-rail'"));
assert.ok(!ui.includes("className: `entry-relation-tab"));
assert.ok(ui.includes("const relationButton = iconButton('disclosure'"));
assert.ok(ui.includes("className: 'entry-action-placeholder relation-placeholder'"));
assert.ok(ui.indexOf("const relationButton = iconButton('disclosure'") < ui.indexOf('actionItems.push(actions.refresh, actions.pin, actions.query, actions.more)'));
assert.ok(ui.includes('if (studyStamp) actionMainChildren.push'));
assert.ok(cssRelease.includes('.entry-study-date:not(.marked) { display: none'));
assert.ok(cssRelease.includes('grid-template-areas: "text controls"'));
assert.ok(cssRelease.includes('grid-template-areas: "index text controls"'));
assert.ok(cssRelease.includes('grid-area: controls'));
assert.ok(cssRelease.includes('position: static !important'));
assert.ok(cssRelease.includes('.entry-index-badge,\n.entry-relation-rail,\n.entry-relation-tab { display: none'));
assert.ok(cssRelease.includes('.entry-source-domain'));
assert.ok(cssRelease.includes('border-radius: 0 !important'));

// Long content remains accessible; phrase clamps are explicitly disabled.
assert.ok(ui.includes("className: `entry-text-viewport${isScrollable ? ' horizontally-scrollable' : ''}"));
assert.ok(cssRelease.includes('.entry-text-viewport.horizontally-scrollable'));
assert.ok(cssRelease.includes('overflow-x: auto !important'));
assert.ok(cssRelease.includes('-webkit-line-clamp: unset !important'));
assert.ok(cssRelease.includes('text-overflow: clip !important'));

// Query main entry is retained; only the two popup options are specialized.
assert.ok(ui.includes("query: '<circle cx=\"9.3\""));
assert.ok(ui.includes("iconButton('dictionary', 'query-menu-option oxford-option'"));
assert.ok(ui.includes("iconButton('aiChat', 'query-menu-option chatgpt-option'"));
assert.ok(cssRelease.includes('grid-template-columns: repeat(2, 42px)'));
assert.ok(integrations.includes("export const CHATGPT_SHORTCUT_NAME = 'AI查询'"));

// PIN/review are opaque rectangular bottom docks and never title overlays.
assert.ok(cssRelease.includes('bottom: var(--bottom-toolbar-height) !important'));
assert.ok(cssRelease.includes('.pin-bar::before { display: none'));
assert.ok(cssRelease.includes('PIN is an integrated bottom dock'));
assert.ok(cssRelease.includes('background: var(--surface) !important'));
assert.ok(cssRelease.includes('border-radius: 0 !important'));
assert.ok(!cssRelease.includes('backdrop-filter: blur'));

// Search and dialogs use aligned, equal-width controls.
assert.ok(cssRelease.includes('.search-controls input'));
assert.ok(cssRelease.includes('width: 100% !important'));
assert.ok(cssRelease.includes('grid-template-columns: minmax(0, 1fr) !important'));
assert.ok(cssRelease.includes('width: 100vw !important'));
assert.ok(cssRelease.includes('height: 100lvh !important'));
assert.ok(cssRelease.includes('--sticky-base-top'));
assert.ok(cssRelease.includes('.collection-view.has-letter-nav .letter-heading { border-top: 0 !important; }'));
assert.ok(cssRelease.includes('grid-template-columns: 44px minmax(0, 1fr) 44px !important'));
assert.ok(cssRelease.includes('position: fixed !important;'));
assert.ok(cssRelease.includes('width: min(520px, calc(var(--visual-width, 100vw) - 28px)) !important'));
assert.ok(cssRelease.includes('left: var(--visual-center-x, 50vw) !important'));
assert.ok(cssRelease.includes('transform: translate(-50%, -50%) !important'));
assert.ok(cssRelease.includes('.entry-lexeme-stack > .entry-text'));
assert.ok(cssRelease.includes('grid-column: 1 !important;'));

assert.ok(ui.includes("target.closest('.dialog-body')"));

// Projection semantics: concrete cross-domain entries, unique counts, priority ownership.
assert.ok(model.includes('export function buildProjection'));
assert.ok(model.includes('globalWords.push(entry)'));
assert.ok(model.includes('globalPhrases.push(entry)'));
assert.ok(model.includes('export function uniqueProjectionCount'));
assert.ok(model.includes('if (candidates[0]) projection.get(candidates[0].collection.id)?.push(entry)'));
assert.ok(model.includes('a.collection.order - b.collection.order'));
assert.ok(store.includes("mutate('调整词表优先级'"));
assert.ok(store.includes("previousCollection?.type === 'normal'"));
assert.ok(store.includes('left.type === \'normal\' ? 0 : 1'));
assert.ok(store.includes('A missing concrete Entry must never migrate to a cross-domain homograph'));

// Entry state remains concrete and schema stays at 5.
assert.ok(model.includes('export const SCHEMA_VERSION = 5'));
assert.ok(db.includes('export const DB_VERSION = 4'));
assert.ok(db.includes('const BUILTIN_SEED_REVISION = 3'));
assert.ok(store.includes('return `entry:${entry.id}`'));
assert.ok(store.includes('globalConflictKeys'));
assert.ok(ui.includes('entry-source-domain'));

// Search is scope-first and current ordinary view can restrict its IDs.
assert.ok(store.includes('export function search(query, options = {})'));
assert.ok(store.includes('const entryIds = options.entryIds instanceof Set'));
assert.ok(ui.includes('search(query, { limit: 80, entryIds: allowed })'));
assert.ok(ui.includes('entriesForCollectionView(collectionId, currentViewKind)'));

// Three-state relation navigation and flat target menu.
assert.ok(ui.includes('function relationNavigationMode'));
for (const icon of ['intra', 'external', 'multi']) assert.ok(ui.includes(`${icon}:`));
assert.ok(ui.includes("button(label, 'relation-target-option'"));
assert.ok(ui.includes('const domainA = Number(state.domainById.get(a.domainId)?.order || 0)'));
assert.ok(ui.includes('if (domainA !== domainB) return domainA - domainB'));

// AI uses true abort, current view scope, manual-change protection and one aggregate history item.
assert.ok(ai.includes('this.abortController.abort()'));
assert.ok(ai.includes('signal: controller.signal'));
assert.ok(ui.includes('manualAnnotationEntryIds'));
assert.ok(ui.includes("detail?.kind !== 'batch'"));
assert.ok(ui.includes('recordAiAnnotationChanges([...task.aiChanges.values()]'));
assert.ok(store.includes('export async function recordAiAnnotationChanges'));
assert.ok(store.includes('if (!jsonEqual(current, after)'));
assert.ok(store.includes('recordHistoryOnly(changes'));

// Import waits for the database transaction and rejects stale plans.
assert.ok(ui.includes('if (getState().revision !== finalPlan.baseRevision)'));
assert.ok(ui.includes('await restoreBackup(finalPlan.nextBackup)'));
assert.ok(!ui.includes('restoreBackup(finalPlan.nextBackup)\n        .then'));
assert.ok(exchange.includes('ambiguous-bare-entry-key'));
assert.ok(exchange.includes('skippedMemberships'));

// PWA precache entries are unique and present.
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length);
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (clean) assert.ok(exists(clean), `预缓存资源不存在：${clean}`);
}
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.ok(manifest.name.includes('3.5.2'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.background_color, '#fafafa');
assert.equal(manifest.theme_color, '#fafafa');

// Lifecycle and release documents are part of every full-source package.
for (const file of [
  'PROJECT_HISTORY.md', 'CHANGE_REPORT_3.5.2.md', 'AUDIT_REPORT_3.5.2.md',
  'TEST_REPORT_3.5.2.md', 'MIGRATION_3.5.2.md', 'UX_SPEC_3.5.2.md',
  'PRODUCT_MANUAL_3.5.2.md', 'PREUPDATE_ROADMAP_2026-08-04.md',
]) assert.ok(exists(file), `缺少生命周期/交付文档：${file}`);

// All relative ES module dependencies exist.
for (const name of fs.readdirSync(path.join(root, 'js')).filter((item) => item.endsWith('.js'))) {
  const source = read(`js/${name}`);
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const target = path.resolve(root, 'js', path.dirname(name), match[1]);
    assert.ok(fs.existsSync(target), `${name} 依赖不存在：${match[1]}`);
  }
}

assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
console.log('static-tests: OK');
