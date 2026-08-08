import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const index = read('index.html');
const css = read('css/v4.0.0.css');
const ui = read('js/v3-ui.js');
const model = read('js/v3-model.js');
const db = read('js/v3-db.js');
const store = read('js/v3-store.js');
const exchange = read('js/v3-exchange.js');
const integrations = read('js/v3-integrations.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const pkg = JSON.parse(read('package.json'));
const schema = JSON.parse(read('data/vix-json.schema.json'));
const lowLexemes = JSON.parse(read('data/relation-low-level-lexemes.json'));

assert.equal(pkg.version, '4.0.0');
assert.ok(index.includes('Vocabulary Index 4.0.0'));
assert.ok(index.includes('css/v4.0.0.css'));
assert.ok(!index.includes('css/v3.5.2.css'));
assert.ok(sw.includes('v4.0.0-major-generation'));
assert.ok(manifest.name.includes('4.0.0'));

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
for (const required of ['./css/v4.0.0.css', './data/seed.json', './data/relation-low-level-lexemes.json', './assets/icons/vix-icon-192-v4.png']) assert.ok(precache.includes(required));

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
assert.ok(ui.includes("await setViewMode(collection.id, 'alphabet', nextView)"));
assert.ok(ui.includes("homeGlobalMode = 'structured'"));
assert.ok(ui.includes('global-mode-toggle'));
assert.ok(ui.includes('SYSTEM_GLOBAL_CONTENT_ID'));

// Search scope identities are explicit and Collection scope is complete, not current-view-only.
for (const token of ['global:words', 'global:phrases', 'global:content', 'domain:', 'collection:']) assert.ok(ui.includes(token), `缺少搜索范围 ${token}`);
assert.ok(store.includes('searchBackup({ entries }, query, searchOptions)'));

// Provider order and compact context.
assert.ok(ui.indexOf('const oxford =') < ui.indexOf('const collins ='));
assert.ok(ui.indexOf('const collins =') < ui.indexOf('const groq ='));
assert.ok(ui.indexOf('const groq =') < ui.indexOf('const chatgpt ='));
assert.ok(ui.includes('replaceChildren(oxford, collins, groq, chatgpt)'));
assert.ok(integrations.includes('export const ENTRY_CONTEXT_VERSION = 2'));
assert.ok(integrations.includes('const MAX_CONTEXT_RELATIONS = 16'));
for (const excluded of ['PIN', '学习日期', 'AI 标注', '全量 Membership', '原始关系组件']) assert.ok(integrations.includes(excluded));

// Dialog roots are card-sized; native backdrop owns screen coverage.
assert.ok(css.includes('.app-dialog::backdrop'));
assert.ok(css.includes('.sheet-dialog::backdrop'));
assert.ok(css.includes('.confirm-dialog::backdrop'));
const dialogSection = css.slice(css.indexOf('.app-dialog,'), css.indexOf('.dialog-header'));
assert.ok(dialogSection.includes('position: fixed !important'));
assert.ok(dialogSection.includes('left: var(--visual-center-x'));
assert.ok(dialogSection.includes('top: var(--visual-center-y'));
assert.ok(!dialogSection.includes('width: 100vw'));
assert.ok(!dialogSection.includes('height: 100lvh'));
assert.ok(!dialogSection.includes('transition:'));

// One measured top geometry source replaces fixed +52 sticky logic.
assert.ok(ui.includes("setProperty('--content-sticky-top'"));
assert.ok(ui.includes('topChromeBottom()'));
assert.ok(!css.includes('calc(var(--sticky-base-top) + 52px)'));

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
const glossRule = css.match(/\.entry-line\.has-left-meta \.entry-gloss\s*\{([\s\S]*?)\}/)?.[1] || '';
const sourceRule = css.match(/\.entry-line\.has-right-meta \.entry-source-domain\s*\{([\s\S]*?)\}/)?.[1] || '';
assert.ok(/bottom:\s*6px/.test(glossRule));
assert.ok(/bottom:\s*6px/.test(sourceRule));

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
