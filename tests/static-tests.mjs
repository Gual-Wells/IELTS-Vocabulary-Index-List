import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const index = read('index.html');
const baseCss = read('css/v3.css');
const css = read('css/v4.0.0.css') + '\n' + read('css/v4.0.1.css') + '\n' + read('css/v4.0.2.css') + '\n' + read('css/v4.1.0.css') + '\n' + read('css/v4.2.0.css') + '\n' + read('css/v4.3.0.css') + '\n' + read('css/v4.4.0.css') + '\n' + read('css/v4.5.0.css') + '\n' + read('css/v4.6.0.css') + '\n' + read('css/v4.7.0.css') + '\n' + read('css/v4.7.1.css') + '\n' + read('css/v4.7.2.css') + '\n' + read('css/v4.7.3.css') + '\n' + read('css/v5.0.0.css');
const css471 = read('css/v4.7.1.css');
const css472 = read('css/v4.7.2.css');
const css473 = read('css/v4.7.3.css');
const ui = read('js/v3-ui.js');
const model = read('js/v3-model.js');
const db = read('js/v3-db.js');
const store = read('js/v3-store.js');
const exchange = read('js/v3-exchange.js');
const integrations = read('js/v3-integrations.js');
const collins = read('js/v3-collins.js');
const upgrade = read('js/v3-upgrade.js');
const version = read('js/v5-version.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const pkg = JSON.parse(read('package.json'));
const schema = JSON.parse(read('data/vix-json.schema.json'));
const lowLexemes = JSON.parse(read('data/relation-low-level-lexemes.json'));
const seedRuntimeManifest = JSON.parse(read('data/seed5-runtime/manifest.json'));
const assetsIgnore = read('.assetsignore');
const gitIgnore = read('.gitignore');
const wrangler = read('wrangler.jsonc');
const worker = read('worker/src/index.js');
const accessJwt = read('worker/src/access-jwt.js');

assert.equal(pkg.version, '5.0.0-alpha.3');
assert.ok(index.includes('css/provider-runtime.css'));
assert.ok(index.includes('Vocabulary Index 5.0.0-alpha.3'));
assert.ok(index.includes('css/v5.0.0.css'));
assert.ok(index.includes('css/v4.0.1.css'));
assert.ok(index.includes('css/v4.0.2.css'));
assert.ok(index.includes('css/v4.1.0.css'));
assert.ok(index.includes('css/v4.2.0.css'));
assert.ok(index.includes('css/v4.3.0.css'));
assert.ok(index.includes('css/v4.4.0.css'));
assert.ok(index.includes('css/v4.5.0.css'));
assert.ok(index.includes('css/v4.6.0.css'));
assert.ok(index.includes('css/v4.7.0.css'));
assert.ok(index.includes('css/v4.7.1.css'));
assert.ok(index.includes('css/v4.7.2.css'));
assert.ok(index.includes('css/v4.7.3.css'));
assert.ok(index.includes('apple-mobile-web-app-status-bar-style" content="default'));
assert.ok(css.includes('.modal-host'));
assert.ok(css.includes('inset: 0'));
assert.ok(index.includes('css/v4.0.0.css'));
assert.ok(!index.includes('css/v3.5.2.css'));
assert.ok(sw.includes('v5.0.0-alpha.3-unified-runtime'));
assert.equal(upgrade.match(/const EXPECTED_CACHE = `([^`]+)`/)?.[1],
  sw.match(/const CACHE_NAME = `([^`]+)`/)?.[1], 'Cache bridge and Service Worker must target the same generation');
assert.ok(!sw.includes('./tests/provider-browser'), 'QA fixtures must not enter the app precache');
assert.ok(sw.includes('./js/v3-motion-runtime.js'));
assert.ok(css472.includes('Runtime-only release'));
assert.ok(css473.includes('.entry-relation-slot'));
assert.ok(css473.includes('grid-template-rows: 0fr'));
assert.ok(css473.includes('.entry-chunk[data-parked="true"]'));
assert.ok(sw.includes('./js/v3-scroll-runtime.js'));
assert.equal(manifest.name, 'Vocabulary Index');
assert.equal(manifest.short_name, 'Vocabulary Index');
assert.ok(index.includes('apple-mobile-web-app-title" content="Vocabulary Index'));
for (const lifecycleDoc of [
  'REQUIREMENT_BASELINE_4.7.3.md',
  'SEMANTIC_IMPACT_MATRIX_4.7.3.md',
  'AUDIT_REPORT_4.7.3.md',
  'TECHNICAL_RESEARCH_4.7.3.md',
  'CHANGE_REPORT_4.7.3.md',
  'MIGRATION_4.7.3.md',
  'UX_SPEC_4.7.3.md',
  'PRODUCT_MANUAL_4.7.3.md',
  'TEST_REPORT_4.7.3.md',
  'tests/IPHONE_REDUCED_TESTS_4.7.3.md',
]) assert.ok(exists(lifecycleDoc), `4.7.3 lifecycle document missing: ${lifecycleDoc}`);

// PWA identity is Vocabulary Index's V mark, not the former Oxford home-screen icon.
const iconSrcs = manifest.icons.map((item) => item.src);
for (const icon of ['./assets/icons/vix-icon-192-v4.png', './assets/icons/vix-icon-512-v4.png']) assert.ok(iconSrcs.includes(icon));
assert.ok(index.includes('assets/icons/vix-icon-180-v4.png'));
for (const file of ['assets/icons/vix-icon-180-v4.png', 'assets/icons/vix-icon-192-v4.png', 'assets/icons/vix-icon-512-v4.png']) assert.ok(exists(file), `${file} 缺失`);
assert.ok(!exists('apple-touch-icon.png') && !exists('icon-192.png') && !exists('icon-512.png'));

// CSP remains local-first; Collins is now a same-origin Worker bridge.
const csp = index.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
assert.ok(csp.includes("default-src 'self'"));
assert.ok(csp.includes('https://api.groq.com'));
assert.ok(!csp.includes('https://api.collinsdictionary.com'));
assert.ok(!/<script[^>]+src=["']https?:/i.test(index));
assert.ok(!/<link[^>]+href=["']https?:/i.test(index));
assert.ok(collins.includes("const LOOKUP_ENDPOINT = './api/collins/lookup'"));
assert.ok(collins.includes("method: 'POST'"));
assert.ok(collins.includes("credentials: 'same-origin'"));
assert.ok(!collins.includes('api.collinsdictionary.com'));
assert.ok(!collins.includes('accessKey'));
assert.ok(!collins.includes('refreshCollinsDictionaries'));
assert.ok(!ui.includes('获取账号词典'));
assert.ok(!ui.includes('词典代码'));

// Service worker precache is complete and duplicate-free.
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length);
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (!clean || clean === './') continue;
  assert.ok(exists(clean), `SW 预缓存资源缺失：${relative}`);
}
for (const required of ['./css/v4.0.0.css', './css/v4.0.1.css', './css/v4.0.2.css', './css/v4.1.0.css', './css/v4.2.0.css', './css/v4.3.0.css', './css/v4.4.0.css', './css/v4.5.0.css', './css/v4.6.0.css', './css/v4.7.0.css', './css/v4.7.1.css', './css/v4.7.2.css', './css/v4.7.3.css', './css/v5.0.0.css', './js/v3-scroll-runtime.js', './js/v3-motion-runtime.js', './js/v5-seed-migration.js', './data/seed5-runtime/manifest.json', './data/seed-4.json', './data/relation-low-level-lexemes.json', './assets/icons/vix-icon-192-v4.png']) assert.ok(precache.includes(required));
assert.equal(seedRuntimeManifest.protocol, 'vix-seed-runtime/1');
assert.equal(seedRuntimeManifest.seedRevision, 6);
for (const releaseDoc of ['README.md', 'DEPLOY.md', 'LOCAL_ARCHITECTURE.md', 'MIGRATION_5.0.0-alpha.3.md', 'RELEASE_5.0.0-alpha.3.md', 'TEST_REPORT_5.0.0-alpha.3.md', 'SEED5_ATTRIBUTIONS.md']) {
  assert.ok(exists(releaseDoc), `alpha.3 release document missing: ${releaseDoc}`);
}
for (const descriptor of [seedRuntimeManifest.meta, ...seedRuntimeManifest.entries, ...seedRuntimeManifest.memberships, ...seedRuntimeManifest.relationComponents]) {
  assert.ok(exists(descriptor.path), `Seed runtime asset missing: ${descriptor.path}`);
  assert.equal(fs.statSync(path.join(root, descriptor.path)).size, descriptor.bytes);
  assert.ok(descriptor.bytes < 25 * 1024 * 1024, `Seed runtime asset exceeds Cloudflare 25 MiB limit: ${descriptor.path}`);
  assert.match(descriptor.sha256, /^[a-f0-9]{64}$/);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, descriptor.path))).digest('hex'), descriptor.sha256);
}
assert.ok(sw.includes('seedAssets'));
assert.match(assetsIgnore, /^data\/seed\.json$/m);
assert.match(assetsIgnore, /^data\/sources\/$/m);
assert.match(assetsIgnore, /^\.dev\.vars(?:\.\*)?$/m);
assert.match(assetsIgnore, /^\.env(?:\.\*)?$/m);
assert.match(gitIgnore, /^\.dev\.vars$/m);
assert.ok(fs.statSync(path.join(root, 'data/seed.json')).size > 25 * 1024 * 1024,
  'Full audit seed should exercise the deployment exclusion boundary');

// Protected Worker routes fail closed and validate Access assertions cryptographically.
assert.ok(wrangler.includes('"TEAM_DOMAIN": "https://blue-breeze-4dac.cloudflareaccess.com"'));
assert.ok(wrangler.includes('"POLICY_AUD": "15fef9936b16c8b08ed05b96a146ba6b19acfbd6a0a24c7fac6493fd1b04720d"'));
assert.ok(wrangler.includes('"preview_urls": false'));
assert.ok(wrangler.includes('"required": ["COLLINS_ACCESS_KEY"]'));
assert.ok(worker.includes("import { authorizeAccess } from './access-jwt.js'"));
assert.ok(!worker.includes('cf-access-authenticated-user-email'));
assert.ok(accessJwt.includes("header.alg !== 'RS256'"));
assert.ok(accessJwt.includes('crypto.subtle.verify'));
assert.ok(accessJwt.includes('payload.iss === teamDomain'));
assert.ok(accessJwt.includes('audiences.includes(audience)'));
assert.ok(accessJwt.includes("cookieValue(request, 'CF_Authorization')"));
assert.ok(accessJwt.includes('executionContext?.access'));

// 4.0 generation/model constants.
assert.ok(model.includes('export const SCHEMA_VERSION = 6'));
assert.ok(db.includes('export const DB_VERSION = 5'));
assert.ok(db.includes('export const BUILTIN_SEED_REVISION = 6'));
assert.ok(db.includes('reconcileSeedUpgrade'));
assert.ok(db.includes('persistSeedMigrationBackup'));
assert.ok(exchange.includes('export const VIX_VERSION = 2'));
assert.ok(model.includes("['word', 'phrase', 'content']"));
assert.ok(model.includes("contentMode = 'structured'"));
assert.ok(model.includes('relationExcluded'));
assert.ok(store.includes('closeLowLevelRelations'));
assert.ok(store.includes('rawRelationsByEntry'));
assert.ok(store.includes('relatedEntriesByEntry'));
assert.ok(store.includes('buildRelationComponentsForEntries'));
assert.ok(db.includes('RelationComponents'));
assert.ok(!db.includes("migrateLegacyBackup(raw)"), '内置 4.0 Seed 不得隐式迁移旧世代');

// Nested collection and domain sorting must not share drag handles or process
// every raw pointermove synchronously on iPhone.
assert.ok(ui.includes('row.parentElement !== container'));
assert.ok(ui.includes('requestAnimationFrame(processMove)'));
assert.ok(ui.includes('event.stopPropagation()'));
assert.ok(baseCss.includes('-webkit-touch-callout: none'));
assert.ok(ui.includes('settings-source-card'));
assert.ok(baseCss.includes('.source-document-link'));

// VIX schema is v2 and contains the 4.0 domain/entry vocabulary.
assert.match(schema.title, /VIX.*v2/i);
assert.ok(JSON.stringify(schema).includes('nonStructured'));
assert.ok(JSON.stringify(schema).includes('contentType'));
assert.ok(JSON.stringify(schema).includes('partsOfSpeech'));
assert.ok(Array.isArray(lowLexemes.items) && lowLexemes.items.length >= 20);
assert.ok(lowLexemes.items.every((item) => item.normalizedText && item.category && item.reason));

// Priority ownership is one projection rule for all three Entry kinds.
const firstCandidatePushes = [...model.matchAll(/if \(candidates\[0\]\) projection\.get\(candidates\[0\]\.collection\.id\)\?\.push\(entry\)/g)].length;
assert.ok(firstCandidatePushes >= 3, 'word / phrase / content 都必须通过最高优先级普通表投影');

// Relation matching and four-state navigation.
assert.ok(model.includes('export function buildRelationComponentsForEntries'));
assert.ok(model.includes('adjacency.get(source.id)?.add(target.id)'));
assert.ok(model.includes('adjacency.get(target.id)?.add(source.id)'));
assert.ok(ui.includes("return 'nonstruct'"));
assert.ok(ui.includes("return 'multi'"));
for (const icon of ['intra:', 'external:', 'nonstruct:', 'multi:']) assert.ok(ui.includes(icon), `缺少关系图标 ${icon}`);
assert.ok(model.includes('export function relationEdgeSuppressed'));
assert.ok(store.includes('relationEdgeSuppressed(left, right'));
assert.ok(model.includes('domainById.get(left.domainId)?.relationExcluded'));
assert.ok(model.includes("left.kind === 'word' && lowLevelLexemes.has(left.normalizedText)"));

// Fresh Home navigation is not a hidden page-state restore.
assert.ok(ui.includes("pendingJumpReason = 'home'"));
assert.ok(ui.includes("hydrateRuntimeViewState(collection.id, { mode: 'alphabet', section: nextView })"));
assert.ok(ui.includes("homeGlobalMode = 'structured'"));
assert.ok(ui.includes('global-mode-toggle'));
assert.ok(ui.includes('switchParallel:'));
assert.ok(ui.includes("[toggleGlobal, ...homeActions]"));
assert.ok(ui.includes("elements['page-title'].textContent = 'Vocabulary Index'"));
assert.ok(ui.includes('全局非结构总表'));
assert.ok(store.includes("name: '全局非结构总表'"));
assert.ok(ui.includes('SYSTEM_GLOBAL_CONTENT_ID'));
assert.ok(css.includes('.app.is-home #page-title'));
assert.ok(css.includes('font-family: ui-serif'));
assert.ok(css.includes('.global-scope .scope-heading::after'));
assert.ok(css.includes('font-size: 15px !important'));
assert.ok(css.includes('.global-scope {\n  border: 0 !important'));
assert.ok(ui.includes("switchParallel:"));

// Search scope identities are explicit and Collection scope is complete, not current-view-only.
for (const token of ['global:words', 'global:phrases', 'global:content', 'domain:', 'collection:']) assert.ok(ui.includes(token), `缺少搜索范围 ${token}`);
assert.ok(store.includes('searchBackup({ entries }, query, searchOptions)'));

// Provider order and compact context.
assert.ok(ui.indexOf('const oxford =') < ui.indexOf('const collins ='));
assert.ok(ui.indexOf('const collins =') < ui.indexOf('const groq ='));
assert.ok(ui.indexOf('const groq =') < ui.indexOf('const chatgpt ='));
assert.ok(ui.includes('providerOptions'));
for (const label of ['Oxford', 'Collins', 'Groq', 'ChatGPT']) assert.ok(ui.includes(`'${label}'`));
assert.ok(ui.includes('M6 5.2h11.2'), 'Oxford must use the 4.2.0 compact closed-book geometry');
assert.ok(ui.includes('M8.7 9h6.8M6 16.4h12.8M7.6 19h11.2'), 'Oxford must keep compact face/page lines inside the shared optical box');
assert.ok(css.includes('--query-menu-edge-inset: 12px'));
assert.ok(ui.includes('sourceRect.right - menuRect.width - 10'));
assert.ok(ui.includes('const gap = 13'));
assert.ok(integrations.includes('export const ENTRY_CONTEXT_VERSION = 2'));
assert.ok(integrations.includes('const MAX_CONTEXT_RELATIONS = 16'));
for (const excluded of ['PIN', '学习日期', 'AI 标注', '全量 Membership', '原始关系组件']) assert.ok(integrations.includes(excluded));

// Blocking surfaces converge on one retained custom modal lifecycle.
assert.ok(index.includes('id="app-dialog" class="modal-host hidden"'));
assert.ok(!index.includes('id="search-dialog"'));
assert.ok(!index.includes('id="confirm-dialog"'));
assert.ok(css.includes('.modal-host'));
assert.ok(css.includes('.modal-layer-backdrop'));
assert.ok(css.includes('.modal-card-management'));
assert.ok(css.includes('.modal-card-search'));
assert.ok(css.includes('.modal-card-confirm'));
assert.ok(css471.includes('@starting-style'));
assert.ok(css471.includes('background: transparent !important'));
assert.ok(css.includes('.modal-layer-closing'));
assert.ok(ui.includes('createAppDialogFrame'));
assert.ok(ui.includes('parent.layer.inert = true'));
assert.ok(ui.includes('parent.onRestore?.()'));
assert.ok(ui.includes("variant: 'search'"));
assert.ok(ui.includes("variant: 'confirm', kind: 'confirm'"));
assert.ok(!ui.includes('showModalStable'));
assert.ok(!ui.includes('.showModal('));
assert.ok(!ui.includes("body.style.position = 'fixed'"));
assert.ok(!ui.includes("body.style.top ="));
assert.ok(!ui.includes('modal-card-pending'));
assert.ok(!ui.includes('snapshotAppDialog'));
assert.ok(!ui.includes('restoreAppDialog'));

// Alphabet headings are native sticky again; JS metrics only synchronize the alphabet bar.
assert.ok(!index.includes('sticky-letter-heading'));
assert.ok(css.includes('.letter-heading {'));
assert.ok(css.includes('position: sticky !important'));
assert.ok(css.includes('top: var(--content-sticky-top) !important'));
assert.ok(ui.includes('refreshAlphabetSectionMetrics'));
assert.ok(ui.includes('alphabetSectionMetrics'));
assert.ok(ui.includes('while (low <= high)'));
assert.ok(ui.includes("setProperty('--content-sticky-top'"));
assert.ok(ui.includes("const navHeight = Math.max(0, nav.getBoundingClientRect().height || nav.offsetHeight || 0)"));
assert.ok(ui.includes('return baseBottom + navHeight'));
assert.ok(ui.includes('function alphabetNavAttached()'));
assert.ok(ui.includes('activeAlphabetMetricAtReadingBoundary'));
assert.ok(!ui.includes('const liveBoundary = navAttached'));
assert.ok(ui.includes('if (scrollCoordinator.isActive()) return;'));
assert.ok(ui.includes('finalizeRootScrollPresentation'));
assert.ok(!ui.includes('renderStickyAlphabetHeading'));
assert.ok(!ui.includes("elements['sticky-letter-heading']"));
assert.ok(!ui.includes('Math.max(bottom, viewportTop + 72)'));
assert.ok(css.includes('.letter-nav-track button:first-child'));
assert.ok(css.includes('border-top: 1px solid var(--line) !important'));
assert.ok(css.includes('.letter-nav-track button.empty'));
assert.ok(css.includes('opacity: 1 !important'));
assert.ok(!css.includes('calc(var(--sticky-base-top) + 52px)'));

// 4.7 retires Safari History as the internal transport rail. One root browser slot; VIX owns Back/Home.
assert.ok(index.includes('id="home-button"'));
assert.ok(!index.includes('id="navigation-underlay"'));
assert.ok(ui.includes('NAVIGATION_MODEL'));
assert.ok(version.includes("export const NAVIGATION_MODEL = 'single-slot-vix-v1'"));
assert.ok(ui.includes('navigationStack'));
assert.ok(ui.includes('resetNavigationToHome'));
assert.equal((ui.match(/history\.replaceState\s*\(/g) || []).length, 1);
assert.equal((ui.match(/history\.pushState\s*\(/g) || []).length, 0);
assert.equal((ui.match(/\.traverseTo\s*\(/g) || []).length, 0);
assert.ok(!ui.includes('rootBrowserKey'));
assert.ok(!ui.includes('deadBrowserKeys'));
assert.ok(ui.includes('expandedLettersByCollection.clear()'));
assert.ok(ui.includes('expandedRelations.clear()'));
assert.ok(ui.includes("elements['home-button'].classList.toggle('hidden', appNavigationDepth < 2)"));
assert.ok(index.includes('aria-label="返回上一页"'));
assert.ok(index.includes('aria-label="返回首页并清空页面历史"'));
assert.ok(ui.includes('document.startViewTransition'));
assert.ok(css.includes('vix-motion-push'));
assert.ok(css.includes('vix-motion-pop'));
assert.ok(ui.includes('runAtomicCollectionCommit'));
assert.ok(ui.includes('runRootCommit'));
assert.ok(!ui.includes('runBufferedCollectionCommit'));
assert.ok(!ui.includes('runRootBufferedCommit'));
assert.ok(!ui.includes('letter-nav-locus'));
assert.ok(ui.includes('cameraTargetForActiveCell'));
assert.ok(css471.includes('--vix-motion-pop: 282ms'));
assert.ok(css471.includes('--presentation-motion-ms: 140ms'));
assert.ok(css471.includes('--presentation-exit-ms: 140ms'));

// Date-mode study-date refresh is an in-place mutation, not a navigation jump.
assert.ok(ui.includes("const preserveDateViewport = mode === 'date'"));
assert.ok(ui.includes("beginRootScrollTransaction('study-date-refresh'"));
assert.ok(ui.includes("restoreSemanticPosition(position, transaction.epoch"));
assert.ok(!ui.includes("pendingJumpReason = 'study-date'"));
assert.ok(!ui.includes('学习日期已刷新并移到今天'));

// 4.1.0 dynamic shell tint experiment is retired: real backdrops own Web-layer dimming.
assert.ok(!ui.includes('function compositeShellSurface'));
assert.ok(!ui.includes('function syncSystemShellSurface'));
assert.ok(!ui.includes('MODAL_BACKDROP_ALPHA'));
assert.ok(css.includes('.modal-layer-backdrop { inset: 0 !important; }'));
assert.ok(css.includes('.modal-layer-backdrop { inset: 0 !important; }'));
assert.ok(index.includes('theme-color" content="#fafafa'));

// Bottom toolbar size remains accepted 58px, but layout code can measure it.
assert.ok(css.includes('--bottom-toolbar-height: 58px'));
assert.ok(ui.includes("document.querySelectorAll('.bottom-toolbar, .pin-bar, .review-bar')"));
assert.ok(!css.includes('height: calc(var(--bottom-toolbar-height) + env(safe-area-inset-bottom))'));

// Normal UI is deliberately non-selectable; real editors explicitly opt in.
assert.ok(css.includes('-webkit-user-select: none'));
assert.ok(css.includes('user-select: none'));
assert.ok(css.includes('input, textarea, [contenteditable="true"]'));
assert.ok(css.includes('-webkit-touch-callout: none'));
assert.ok(css.includes('.toast'));
assert.ok(css.includes('pointer-events: none'));
assert.ok(css.includes('html.longpress-guard'));

// Longpress is an explicit 520ms lifecycle plus 350ms invisible grace guard.
assert.ok(ui.includes('520'));
assert.ok(ui.includes('350'));
assert.ok(ui.includes("document.documentElement.classList.add('longpress-guard')"));
assert.ok(ui.includes("document.documentElement.classList.remove('longpress-guard')"));
assert.ok(ui.includes("for (const type of ['selectstart', 'contextmenu'])"));
assert.ok(ui.includes('window.getSelection?.()?.removeAllRanges()'));

// Source and Traditional gloss use the same secondary-line Y metric.
assert.ok(css.includes('.entry-line.has-left-meta .entry-gloss { bottom: 2px !important; }'));
assert.ok(css.includes('.entry-line.has-right-meta .entry-source-domain { bottom: 2px !important; }'));
assert.ok(css.includes('.entry-line.has-left-meta .entry-text-viewport { padding-bottom: 10px !important; }'));
assert.ok(css.includes('.entry-line.has-right-meta .entry-control-stack { padding-bottom: 10px !important; }'));


// content long text inherits explicit normal/two-line/extreme handling.
for (const kind of ['content-normal', 'content-two-line', 'content-extreme']) assert.ok(ui.includes(kind));
assert.ok(css.includes('.content-two-line .entry-text'));
assert.ok(css.includes('.content-extreme .entry-text-content'));

// Settings are management-sized and remove development-style helper paragraphs.
assert.ok(ui.includes("variant: 'management'"));
assert.ok(ui.includes("className: 'vix-checkbox'"));
assert.ok(css.includes('.vix-checkbox:checked'));
assert.ok(!ui.includes('仅保存在本机浏览器存储。若静态 PWA 受 CORS 限制'));
assert.ok(!ui.includes('默认开启。只逻辑隐藏代词'));

// 4.6 keeps 4.4 Sticky/Modal runtime correctness ownership.
assert.ok(store.includes('export function getViewMode(collectionId)'));
assert.ok(store.includes('export async function setViewMode(collectionId, mode)'));
assert.ok(store.includes('export function hydrateRuntimeViewState'));
assert.ok(store.includes('export async function persistRuntimeViewState'));
assert.ok(!store.includes('getViewMode(collectionId, section'));
assert.ok(ui.includes('function stickyCollapseGeometry'));
assert.ok(ui.includes("querySelector(':scope > .section-flow-anchor')"));
assert.ok(ui.includes("document.startViewTransition"));
assert.ok(ui.includes('waitForRootScrollSettle'));
assert.ok(!ui.includes('compensateCollapsedSection'));
assert.ok(!index.includes('navigation-underlay'));
assert.ok(css.includes('.section-flow-anchor'));
assert.ok(css.includes('sticky-collapse-transition::view-transition-old(root)'));
assert.ok(css.includes('.navigation-guard-feedback'));
assert.ok(css.includes('.pin-bar.dock-visible'));
assert.ok(css.includes('.review-bar.dock-visible'));
assert.ok(css.includes('@keyframes vix-popover-in'));
assert.ok(css.includes('@keyframes vix-popover-out'));
const pinToggleStart = ui.indexOf('async function toggleEntryPin');
const pinToggleEnd = ui.indexOf('\nfunction ', pinToggleStart + 1);
const pinToggleSource = ui.slice(pinToggleStart, pinToggleEnd > pinToggleStart ? pinToggleEnd : undefined);
assert.ok(pinToggleStart >= 0);
assert.ok(!pinToggleSource.includes('replaceWith('), 'PIN 状态切换不得重建整个 Entry row');
const relationToggleStart = ui.indexOf('async function toggleEntryRelations');
const relationToggleEnd = ui.indexOf('\nasync function toggleEntryPin', relationToggleStart);
const relationToggleSource = ui.slice(relationToggleStart, relationToggleEnd);
assert.ok(!relationToggleSource.includes('replaceWith('), 'Relation 展开不得重建整个 Entry row');
assert.ok(relationToggleSource.includes('.entry-relation-slot'));

// 4.7 root-scroll / virtual-layout / motion ownership invariants.
assert.ok(ui.includes("import { clampRootScrollTarget, createScrollCoordinator"));
assert.ok(ui.includes("owner: 'letter-jump'"));
assert.ok(ui.includes("beginRootScrollTransaction('back-restore'"));
assert.ok(ui.includes("querySelector(':scope > .section-flow-anchor')"));
assert.ok(ui.includes('prepareSemanticPositionGeometry'));
assert.ok(ui.includes('materializeChunksAroundScrollY'));
assert.ok(ui.includes('virtualLayoutCache: new Map()'));
assert.ok(ui.includes('layoutCache?.set(data.chunkKey, height)'));
assert.ok(ui.includes("rootMargin: '960px 0px 960px'"));
assert.ok(ui.includes('const ENTRY_CHUNK_SIZE = 42'));
assert.ok(ui.includes('flushQueuedVirtualChunksNow'));
assert.ok(ui.includes('parkEntryChunksOutsideResidentWindow'));
assert.ok(ui.includes("chunk.dataset.parked = 'true'"));
assert.ok(ui.includes('maybeParkEntryChunksDuringProgrammaticScroll'));
assert.ok(!ui.includes('function captureScrollAnchor('));
assert.ok(!ui.includes('function restoreScrollAnchor('));
const materializeStart = ui.indexOf('function materializeEntryChunk');
const materializeEnd = ui.indexOf('\nfunction flushQueuedVirtualChunksNow', materializeStart);
const materializeSource = ui.slice(materializeStart, materializeEnd);
assert.ok(materializeStart >= 0 && materializeEnd > materializeStart);
assert.ok(!materializeSource.includes('window.scrollTo'));
assert.ok(!materializeSource.includes('window.scrollBy'));
const directRootScrollWrites = [...ui.matchAll(/window\.scrollTo\s*\(/g)].map((match) => match.index);
assert.equal(directRootScrollWrites.length, 2, 'only root scroll adapters may call window.scrollTo');
assert.equal((ui.match(/window\.scrollBy\s*\(/g) || []).length, 0, 'direct window.scrollBy is forbidden');
assert.ok(ui.includes('closeSearchDialogForNavigation'));
assert.ok(ui.includes('serviceWorkerReloadIsArmed'));
assert.ok(sw.includes('clients.claim()'));

// Product package sources must not contain NUL bytes.
for (const dir of ['js', 'css', 'data', 'tests', 'tools']) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    const file = path.join(root, dir, name);
    if (!fs.statSync(file).isFile()) continue;
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.includes(0), false, `NUL byte: ${path.relative(root, file)}`);
  }
}

console.log(`static-tests: OK (${precache.length} precache resources)`);
