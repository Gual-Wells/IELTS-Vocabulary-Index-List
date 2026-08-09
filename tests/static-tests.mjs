import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const index = read('index.html');
const css = read('css/v4.0.0.css') + '\n' + read('css/v4.0.1.css') + '\n' + read('css/v4.0.2.css') + '\n' + read('css/v4.1.0.css') + '\n' + read('css/v4.2.0.css') + '\n' + read('css/v4.3.0.css');
const ui = read('js/v3-ui.js');
const model = read('js/v3-model.js');
const db = read('js/v3-db.js');
const store = read('js/v3-store.js');
const exchange = read('js/v3-exchange.js');
const integrations = read('js/v3-integrations.js');
const upgrade = read('js/v3-upgrade.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const pkg = JSON.parse(read('package.json'));
const schema = JSON.parse(read('data/vix-json.schema.json'));
const lowLexemes = JSON.parse(read('data/relation-low-level-lexemes.json'));

assert.equal(pkg.version, '4.3.0');
assert.ok(index.includes('Vocabulary Index 4.3.0'));
assert.ok(index.includes('css/v4.0.1.css'));
assert.ok(index.includes('css/v4.0.2.css'));
assert.ok(index.includes('css/v4.1.0.css'));
assert.ok(index.includes('css/v4.2.0.css'));
assert.ok(index.includes('css/v4.3.0.css'));
assert.ok(index.includes('apple-mobile-web-app-status-bar-style" content="default'));
assert.ok(css.includes('.modal-host'));
assert.ok(css.includes('inset: 0'));
assert.ok(index.includes('css/v4.0.0.css'));
assert.ok(!index.includes('css/v3.5.2.css'));
assert.ok(sw.includes('v4.3.0-runtime-convergence'));
assert.equal(manifest.name, 'Vocabulary Index');
assert.equal(manifest.short_name, 'Vocabulary Index');
assert.ok(index.includes('apple-mobile-web-app-title" content="Vocabulary Index'));

// PWA identity is Vocabulary Index's V mark, not the former Oxford home-screen icon.
const iconSrcs = manifest.icons.map((item) => item.src);
for (const icon of ['./assets/icons/vix-icon-192-v4.png', './assets/icons/vix-icon-512-v4.png']) assert.ok(iconSrcs.includes(icon));
assert.ok(index.includes('assets/icons/vix-icon-180-v4.png'));
for (const file of ['assets/icons/vix-icon-180-v4.png', 'assets/icons/vix-icon-192-v4.png', 'assets/icons/vix-icon-512-v4.png']) assert.ok(exists(file), `${file} 缺失`);
assert.ok(!exists('apple-touch-icon.png') && !exists('icon-192.png') && !exists('icon-512.png'));

// CSP remains local-first while allowing only the configured direct providers.
const csp = index.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
assert.ok(csp.includes("default-src 'self'"));
assert.ok(csp.includes('https://api.groq.com'));
assert.ok(csp.includes('https://api.collinsdictionary.com'));
assert.ok(!/<script[^>]+src=["']https?:/i.test(index));
assert.ok(!/<link[^>]+href=["']https?:/i.test(index));

// Service worker precache is complete and duplicate-free.
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length);
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (!clean || clean === './') continue;
  assert.ok(exists(clean), `SW 预缓存资源缺失：${relative}`);
}
for (const required of ['./css/v4.0.0.css', './css/v4.0.1.css', './css/v4.0.2.css', './css/v4.1.0.css', './css/v4.2.0.css', './css/v4.3.0.css', './data/seed.json', './data/relation-low-level-lexemes.json', './assets/icons/vix-icon-192-v4.png']) assert.ok(precache.includes(required));

// 4.0 generation/model constants.
assert.ok(model.includes('export const SCHEMA_VERSION = 6'));
assert.ok(db.includes('export const DB_VERSION = 5'));
assert.ok(db.includes('export const BUILTIN_SEED_REVISION = 4'));
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
assert.ok(ui.includes("await setViewMode(collection.id, 'alphabet')"));
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
assert.ok(css.includes('.modal-layer-entering'));
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
assert.ok(ui.includes('const stickyEngaged = navAttached && activeIndex >= 0'));
assert.ok(!ui.includes('renderStickyAlphabetHeading'));
assert.ok(!ui.includes("elements['sticky-letter-heading']"));
assert.ok(!ui.includes('Math.max(bottom, viewportTop + 72)'));
assert.ok(css.includes('.letter-nav-track button:first-child'));
assert.ok(css.includes('border-top: 1px solid var(--line) !important'));
assert.ok(css.includes('.letter-nav-track button.empty'));
assert.ok(css.includes('opacity: 1 !important'));
assert.ok(!css.includes('calc(var(--sticky-base-top) + 52px)'));

// Navigation is a one-way VIX-owned destructive stack; browser history is only the gesture rail.
assert.ok(index.includes('id="home-button"'));
assert.ok(index.includes('id="navigation-underlay"'));
assert.ok(index.includes('id="navigation-guard-feedback"'));
assert.ok(ui.includes("const NAVIGATION_MODEL = 'destructive-v1'"));
assert.ok(upgrade.includes("history.scrollRestoration = 'manual'"));
assert.ok(ui.includes('navigationStack'));
assert.ok(ui.includes('discardNavigationFramesFrom'));
assert.ok(ui.includes('discardedNavigationTokens'));
assert.ok(ui.includes('discardedForwardAvailable'));
assert.ok(ui.includes('resetNavigationToHome'));
assert.ok(ui.includes('finalizeNavigationResetToHome'));
assert.ok(ui.includes('enterHomeRoot'));
assert.ok(ui.includes('if (!route.collectionId && !pendingRootReset && (appNavigationDepth > 0 || navigationStack.length > 0))'));
assert.ok(ui.includes('const forwardIsForbidden = isForward'));
assert.ok(ui.includes("event.preventDefault()"));
assert.ok(ui.includes("{ passive: false, capture: true }"));
assert.ok(!ui.includes('pageSnapshot'));
assert.ok(ui.includes('expandedLettersByCollection.clear()'));
assert.ok(ui.includes('expandedRelations.clear()'));
assert.ok(ui.includes("elements['home-button'].classList.toggle('hidden', appNavigationDepth < 2)"));
assert.ok(index.includes('aria-label="返回上一页"'));
assert.ok(index.includes('aria-label="返回首页并清空页面历史"'));

// Date-mode study-date refresh is an in-place mutation, not a navigation jump.
assert.ok(ui.includes("const preserveDateViewport = mode === 'date'"));
assert.ok(ui.includes("window.scrollTo({ top: preservedScrollY, behavior: 'auto' })"));
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

// 4.3.0 collection mode ownership and collapse/presentation transactions.
assert.ok(store.includes('export function getViewMode(collectionId)'));
assert.ok(store.includes('export async function setViewMode(collectionId, mode)'));
assert.ok(!store.includes('getViewMode(collectionId, section'));
assert.ok(ui.includes('function collapseNativeStickySection'));
assert.ok(!ui.includes('compensateCollapsedSection'));
assert.ok(ui.includes('collapse();'));
assert.ok(ui.includes("window.scrollTo({ top: targetScrollY, behavior: 'auto' })"));
assert.ok(css.includes('.navigation-underlay'));
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
