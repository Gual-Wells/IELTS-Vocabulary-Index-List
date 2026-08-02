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
const app = read('js/v3-app.js');
const upgrade = read('js/v3-upgrade.js');
const sw = read('sw.js');
const cssBase = read('css/v3.css');
const cssRelease = read('css/v3.3.1.css');
const css = `${cssBase}
${cssRelease}`;
const pkg = JSON.parse(read('package.json'));
const seed = JSON.parse(read('data/seed.json'));

// Version, shell, CSP and iPhone-only viewport contract.
assert.ok(html.includes('name="application-version" content="3.3.1"'));
assert.ok(html.includes('<title>Vocabulary Index 3.3.1</title>'));
assert.ok(html.includes('maximum-scale=1'));
assert.ok(html.includes('user-scalable=no'));
assert.ok(html.includes('viewport-fit=cover'));
assert.ok(html.includes('format-detection'));
assert.ok(html.includes("script-src 'self'"));
assert.ok(html.indexOf('./js/v3-upgrade.js') < html.indexOf('./css/v3.css'));
assert.ok(html.includes('./js/v3-app.js'));
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(html));
assert.ok(app.includes("const MODULE_VERSION = '3.3.1'"));
assert.ok(app.includes("const canonical = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'"));
assert.ok(upgrade.includes('vocabulary-index:cache-bridge:3.3.1'));
assert.ok(sw.includes('v3.3.1-ios-shell-20260802-2'));
assert.ok(upgrade.includes('v3.3.1-ios-shell-20260802-2'));
assert.equal(pkg.version, '3.3.1');
assert.equal(seed.appVersion, '3.3.1');
assert.equal(JSON.parse(read('data/seed-report.json')).builtInSeedRevision, 3);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');
for (const id of [
  'app', 'large-title', 'large-title-heading', 'home-annotation-banner', 'clear-all-annotations',
  'home-view', 'collection-view', 'letter-nav', 'entry-list', 'back-to-top', 'query-menu', 'hidden-file-input',
]) assert.ok(ids.includes(id), `HTML 缺少 ${id}`);
assert.ok(!html.includes('detail-dialog'));
assert.ok(!html.includes('mobile-action-bar'));

// iPhone standalone shell, safe area and fixed dynamic chrome.
assert.ok(app.includes("'(display-mode: standalone)'"));
assert.ok(app.includes('recoverStandaloneViewportIfNeeded'));
assert.ok(app.includes("document.addEventListener('visibilitychange'"));
assert.ok(css.includes('-webkit-text-size-adjust: 100%'));
assert.ok(css.includes('.standalone-pwa') || app.includes("classList.toggle('standalone-pwa'"));
assert.ok(css.includes('.topbar {'));
assert.ok(css.includes('position: fixed'));
assert.ok(css.includes('padding: var(--safe-top)'));
assert.ok(css.includes('.large-title'));
assert.ok(ui.includes('function renderLargeTitle'));
assert.ok(ui.includes("classList.toggle('large-title-collapsed'"));
assert.ok(ui.includes("window.visualViewport?.addEventListener('resize'"));
assert.ok(ui.includes("window.visualViewport?.addEventListener('scroll'"));
assert.ok(ui.includes('viewport?.offsetTop'));
assert.ok(ui.includes('viewport?.offsetLeft'));
assert.ok(css.includes('--visual-top'));
assert.ok(css.includes('.keyboard-visible .search-dialog .dialog-card'));

// Modal system keeps form focus dormant and avoids the old fixed-body scroll lock.
assert.ok(ui.includes("elements['dialog-close']?.focus"));
assert.ok(ui.includes("elements['action-close']?.focus"));
assert.ok(!ui.includes("document.body.style.position = 'fixed'"));
assert.ok(!ui.includes("document.body.style.top = `-${scrollY}px`"));
assert.ok(css.includes('.app-dialog'));
assert.ok(css.includes('.sheet-dialog'));
assert.ok(css.includes('.confirm-dialog'));
assert.ok(css.includes('.search-dialog'));
assert.ok(css.includes('width: min(322px, calc(100vw - 48px))'));
assert.ok(css.includes('font-size: 16px !important'));

// Home state and persistent annotation warning overlay.
assert.ok(ui.includes('let homeScrollY = 0'));
assert.ok(ui.includes('restoreHomeScrollPending'));
assert.ok(ui.includes('function renderHomeAnnotationBanner'));
assert.ok(ui.includes('clearAllAnnotationsFromHome'));
assert.ok(store.includes('export async function clearAllAnnotations()'));
assert.ok(css.includes('.home-annotation-banner'));
assert.ok(css.includes('position: fixed'));
assert.ok(!html.match(/home-annotation-banner[\s\S]{0,300}(?:close|取消)/i));

// First-level entries: fixed body geometry, external relation rail and four controls.
assert.ok(ui.includes("className: 'entry-primary-shell'"));
assert.ok(ui.includes("className: 'entry-line'"));
assert.ok(ui.includes("className: 'entry-relation-rail'"));
assert.ok(ui.includes("className: `entry-relation-tab${expanded ? ' active' : ''}`"));
assert.ok(ui.includes("svgIcon('disclosure', 'relation-disclosure')"));
assert.ok(css.includes('--relation-rail-width'));
assert.ok(css.includes('grid-template-columns: minmax(0, 1fr) var(--relation-rail-width)'));
assert.ok(css.includes('.entry-relation-tab'));
assert.ok(css.includes('.entry-relation-tab.active .relation-disclosure'));
assert.ok(ui.includes("const refresh = iconButton('refresh'"));
assert.ok(ui.includes("const query = iconButton('query'"));
assert.ok(ui.includes("const more = iconButton('more'"));
assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'));
assert.ok(css.includes('.entry-index-badge'));

// Word/gloss shared horizontal viewport; phrase-specific bounded and extreme layouts.
assert.ok(ui.includes("layoutKind === 'phrase-extreme'"));
assert.ok(ui.includes("return 'phrase-two-line'"));
assert.ok(ui.includes("return 'phrase-extreme'"));
assert.ok(ui.includes("className: `entry-text-viewport${isScrollable ? ' horizontally-scrollable' : ''}`"));
assert.ok(css.includes('.entry-text-viewport.horizontally-scrollable'));
assert.ok(css.includes('.word-normal .entry-text-content, .phrase-extreme .entry-text-content'));
assert.ok(css.includes('white-space: nowrap'));
assert.ok(css.includes('.phrase-two-line .entry-text'));
assert.ok(css.includes('white-space: normal'));
assert.ok(css.includes('.entry-line-extreme'));
assert.ok(css.includes('min-height: 94px'));
assert.ok(ui.includes("className: 'entry-extreme-functions'"));
assert.ok(ui.includes("--visible-items"));
assert.ok(!css.includes('.entry-text {\n  text-overflow: ellipsis'));

// Annotated entries warn in-place, redirect primary tap to review, and support current/global clear.
assert.ok(ui.includes("annotation ? ' annotated' : ''"));
assert.ok(ui.includes('if (annotationRecord) startAnnotationReview'));
assert.ok(ui.includes("startAnnotationReview(collection.id, annotationRecord.sourceEntryId)"));
assert.ok(ui.includes('async function clearCurrentReviewAnnotations'));
assert.ok(ui.includes("'撤销当前词表全部标注'"));
assert.ok(css.includes('.entry-row.annotated .entry-line'));
assert.ok(css.includes('linear-gradient(90deg'));
assert.ok(ui.includes('function annotationReviewIds'));
assert.ok(ui.includes('function renderReviewBar'));

// Two-icon anchored query menu; transport remains the existing shortcut protocol.
assert.ok(ui.includes('function openQueryMenu'));
assert.ok(ui.includes("iconButton('dictionary', 'query-menu-option oxford-option'"));
assert.ok(ui.includes("iconButton('aiChat', 'query-menu-option chatgpt-option'"));
assert.ok(ui.includes('function openOxfordLookup(entry)'));
assert.ok(ui.includes('function openChatGPTEntryQuery(entry, collection)'));
assert.ok(ui.includes('createEntryContext(state, entry, collection.id'));
assert.ok(css.includes('.query-menu'));
assert.ok(css.includes('.query-menu::after'));
assert.ok(integrations.includes("export const CHATGPT_SHORTCUT_NAME = 'AI查询'"));
assert.ok(integrations.includes('shortcuts://run-shortcut'));
assert.ok(integrations.includes('&input=text&text='));
assert.ok(integrations.includes('hk-com-oupc-oecd-lookup://x-callback-url/s'));

// Split navigation removes the sticky ghost and heading jumps target the chrome bottom.
assert.ok(ui.includes("className: 'letter-nav-fixed'"));
assert.ok(ui.includes("className: 'letter-nav-track'"));
assert.ok(ui.includes('function positionHeadingBelowChrome'));
assert.ok(ui.includes('function positionElementAtReadingAnchor'));
assert.ok(ui.includes('viewport?.offsetTop'));
assert.ok(css.includes('.last-position-button { position: static !important'));
assert.ok(css.includes('.letter-nav-track'));
assert.ok(css.includes('overflow-x: auto'));

// PIN and review overlays never modify document flow; return-to-top remains persistent.
assert.ok(css.includes('.context-bar'));
assert.ok(css.includes('position: fixed'));
assert.ok(css.includes('.app.has-pin, .app.has-review { --context-height: 0px; }'));
assert.ok(html.includes('id="back-to-top"'));
assert.ok(ui.includes('function returnToTop()'));
assert.ok(ui.includes("elements['back-to-top']?.addEventListener('click', returnToTop)"));
assert.ok(ui.includes("navigation-top-button"));
assert.ok(ui.includes("classList.toggle('at-top'"));
assert.ok(cssRelease.includes('.back-to-top { display: none !important; }'));

// Unified icon cache and redesigned relation secondary jump.
assert.ok(ui.includes('const ICONS = {'));
assert.ok(ui.includes('iconTemplateCache'));
for (const icon of ['refresh', 'dictionary', 'aiChat', 'query', 'disclosure', 'jump', 'warning', 'clear']) {
  assert.ok(ui.includes(`${icon}:`), `缺少统一图标 ${icon}`);
}
assert.ok(ui.includes("iconButton(\n        'jump',") || ui.includes("iconButton(\n      'jump',"));
assert.ok(css.includes('.relation-jump'));

// System projections and 3.1 composite collection semantics remain intact.
assert.ok(ui.includes("'system-card'"));
assert.ok(ui.includes("'global-system-card'"));
assert.ok(ui.includes("'domain-system-card'"));
assert.ok(css.includes('.collection-card.global-system-card'));
assert.ok(store.includes("name: '全局词汇总表'"));
assert.ok(store.includes("name: '全局短语总表'"));
assert.ok(store.includes("name: '词汇总表'"));
assert.ok(ui.includes('function isCompositeCollection(collection)'));
assert.ok(ui.includes("sections.set('word', createSectionContext('word'"));
assert.ok(ui.includes("sections.set('phrase', createSectionContext('phrase'"));
assert.ok(store.includes("collection.type === 'normal'"));
assert.ok(exchange.includes("targetCollection?.type === 'normal'"));

// Alphabet/date modes, calendar, explicit study date and independent positions remain.
assert.ok(ui.includes("mode === 'date' ? 'alphabet' : 'calendar'"));
assert.ok(ui.includes('function renderDateContent'));
assert.ok(ui.includes("className: 'date-unmarked-heading', text: '未标注'"));
assert.ok(ui.includes('function calendarForSection'));
assert.ok(store.includes('export function getViewMode(collectionId)'));
assert.ok(store.includes('export async function setViewMode(collectionId, mode)'));
assert.ok(store.includes('`lastPosition:${domainId}:${collectionId}:${mode}:${section}`'));
assert.ok(model.includes('export function createStudyStamp'));
assert.ok(store.includes('export async function refreshStudyDate(entryId, collectionId'));
assert.ok(ui.includes('async function refreshEntryStudyDate'));
assert.ok(!ui.match(/copyText[\s\S]{0,500}refreshStudyDate/), '复制不得刷新学习日期');

// Schema 4, Seed revision 3 and complete data preservation.
assert.ok(model.includes('export const SCHEMA_VERSION = 4'));
assert.ok(db.includes('export const DB_VERSION = 4'));
assert.ok(db.includes('const BUILTIN_SEED_REVISION = 3'));
assert.ok(db.includes('StudyStamps'));
assert.ok(db.includes("const DATA_STORE_KEYS = ['domains', 'collections', 'entries', 'memberships', 'phraseTokens', 'pins', 'annotations', 'studyStamps']"));
assert.ok(db.includes('async function readCurrentSnapshot(db)'));
assert.ok(model.includes('if ([3, SCHEMA_VERSION].includes(Number(input?.schemaVersion))'));

// Relation navigation remains normal-collection-only and secondary items preserve copy/jump separation.
assert.ok(ui.includes('function normalDestinationsForEntries'));
assert.ok(ui.includes("collection.type !== 'normal' || collection.hidden"));
assert.ok(ui.includes("className: 'relation-copy'"));
assert.ok(ui.includes('relation-jump'));
assert.ok(ui.includes('function displayGlossForRelationItem'));
assert.ok(ui.includes("className: 'relation-gloss'"));
assert.ok(!ui.includes('preferredNormalDestination'), '旧版回退到总表的目标解析不得保留');

// High-risk operations offer an optional backup choice, then continue through the actual confirmation.
assert.ok(ui.includes('function offerOptionalBackup'));
assert.ok(ui.includes("submitText: '下载备份'"));
assert.ok(ui.includes("cancelText: '不下载'"));
assert.ok(ui.includes('此选择只决定是否下载备份；无论选择哪一项，操作都会继续。'));
assert.ok(ui.includes('choiceRequired: true'));
assert.ok(ui.includes("title: '还原到当前版本 Seed'"));
assert.ok(ui.includes("description: '确认后将替换全部本地内容和个人状态。'"));
assert.ok(!ui.includes('seed-reset-confirm'));
assert.ok(!ui.includes('我已确认备份'));
assert.ok(ui.includes("title: '确认恢复完整备份'"));
assert.ok(ui.includes("title: '确认完整替换'"));
assert.ok(exchange.includes('createVixPackage'));
assert.ok(exchange.includes('planVixImport'));

// Main-thread protections retained and extended with variable chunk estimates.
assert.ok(ui.includes('IntersectionObserver'));
assert.ok(ui.includes('ENTRY_CHUNK_SIZE = 42'));
assert.ok(ui.includes('function materializeEntryChunk(chunk)'));
assert.ok(ui.includes('slice.reduce((total, entry)'));
assert.ok(ui.includes("kind === 'phrase-extreme' ? 102"));
assert.ok(ui.includes('document.elementFromPoint'));
assert.ok(ui.includes("window.addEventListener('scrollend'"));
assert.ok(store.includes('visibleEntryIdsByCollection'));
assert.ok(store.includes('relatedPhrasesByEntry'));
assert.ok(store.includes('phraseComponentsByEntry'));
assert.ok(ui.includes('window.setTimeout(renderLocal, 140)'));
for (const [name, source] of [
  ['getRelatedPhrases', store.match(/export function getRelatedPhrases[\s\S]*?\n}/)?.[0] || ''],
  ['getPhraseComponents', store.match(/export function getPhraseComponents[\s\S]*?\n}/)?.[0] || ''],
  ['search', store.match(/export function search\([\s\S]*?\n}/)?.[0] || ''],
]) assert.ok(!source.includes('backupFromState'), `${name} 不得复制整库`);
assert.ok(!css.includes('backdrop-filter: blur(18px)'));
assert.ok(!css.includes('backdrop-filter: blur(16px)'));
assert.ok(!css.includes('backdrop-filter: blur(14px)'));

// 3.3.1 regression guards for virtual views, local annotation writes, and corrected cascade.
assert.ok(model.includes('export function positionScopeDomainId'));
assert.ok(ui.includes('return positionScopeDomainId(collection, entry)'));
assert.ok(ui.includes('lastPersistedPositionKey'));
assert.ok(ui.includes('lastPersistedPositionKey = `${positionDomainId(collection)}'));
assert.ok(ui.includes('visibleEntryIdsByCollection.get(collection.id)?.has(entry.id)'));
assert.ok(store.includes('cleanStudyStampReferences'));
assert.ok(store.includes('migrateGlobalStudyStampOnRename'));
assert.ok(store.includes("emit('annotation-change'"));
assert.ok(!store.match(/export async function replaceAnnotations[\s\S]{0,1800}backupFromState/));
assert.ok(exchange.includes('memberships = memberships.filter((item) => !removed.has(item.entryId))'));
assert.ok(cssRelease.includes('.review-bar .review-edit'));
assert.ok(cssRelease.includes('display: inline-flex !important'));
assert.ok(html.includes('./css/v3.3.1.css'));
assert.ok(sw.includes('./css/v3.3.1.css'));

// PWA precache resources exist and do not duplicate.
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length);
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (clean) assert.ok(exists(clean), `预缓存资源不存在：${clean}`);
}
assert.ok(sw.includes("event.data?.type === 'SKIP_WAITING'"));
assert.ok(!sw.match(/addEventListener\('install'[\s\S]*?\}\);/)?.[0].includes('skipWaiting'));

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.ok(manifest.name.includes('3.3.1'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');

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
