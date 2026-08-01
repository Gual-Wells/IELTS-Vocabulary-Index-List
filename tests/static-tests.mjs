import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const html = read('index.html');
assert.ok(html.includes('name="application-version" content="3.0.7"'));
assert.ok(html.includes("script-src 'self'"));
assert.ok(html.includes('./js/v3-upgrade.js'));
assert.ok(html.indexOf('./js/v3-upgrade.js') < html.indexOf('./css/v3.css'), '升级引导必须先于样式和应用模块加载');
assert.ok(html.includes('./js/v3-app.js'));
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(html), 'HTML 不得包含内联事件');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');

const requiredIds = [
  'boot-screen', 'app', 'back-button', 'page-title', 'page-subtitle', 'search-button', 'settings-button',
  'home-view', 'collection-view', 'collection-toolbar', 'pin-bar', 'annotation-review-bar', 'letter-nav', 'entry-list',
  'task-capsule', 'task-panel', 'toast-region', 'update-banner', 'update-now-button', 'update-later-button',
  'app-dialog', 'dialog-form', 'dialog-title', 'dialog-description', 'dialog-close', 'dialog-body', 'dialog-actions',
  'action-dialog', 'action-title', 'action-description', 'action-close', 'action-body',
  'search-dialog', 'search-close', 'search-body',
  'confirm-dialog', 'confirm-form', 'confirm-title', 'confirm-description', 'confirm-body', 'confirm-cancel', 'confirm-submit',
  'hidden-file-input',
];
for (const id of requiredIds) assert.ok(ids.includes(id), `HTML 缺少 UI 节点：${id}`);
assert.ok(!html.includes('detail-dialog'), '不得保留独立详情弹窗');
assert.ok(!html.includes('mobile-action-bar'), '不得包含永久移动底栏');

const ui = read('js/v3-ui.js');
const css = read('css/v3.css');
const app = read('js/v3-app.js');
const upgrade = read('js/v3-upgrade.js');
const store = read('js/v3-store.js');
const model = read('js/v3-model.js');
const ai = read('js/v3-ai.js');
const exchange = read('js/v3-exchange.js');
const dataWorker = read('js/v3-data-worker.js');

// 词汇与短语同构；主列表不显示词性，不出现独立详情。
assert.ok(ui.includes("function relationItemsForEntry"));
assert.ok(ui.includes("getRelatedPhrases(word.id)"));
assert.ok(ui.includes("getPhraseComponents(phrase.id)"));
assert.ok(ui.includes("className: 'relation-panel'"));
assert.ok(ui.includes('SYSTEM_GLOBAL_PHRASES_ID'), '必须提供全局短语表');
assert.ok(model.includes('SYSTEM_GLOBAL_PHRASES_ID'));
assert.ok(store.includes("name: '全局短语表'"));
assert.ok(ui.includes("className: `entry-pin${pinned ? ' active' : ''}`"), 'PIN 必须直接位于表项');
assert.ok(ui.includes("iconButton('more', 'entry-more'"));
assert.ok(!ui.includes('openEntryDetails'));
assert.ok(!ui.includes("className: 'entry-pos'"), '主列表不得显示词性');
assert.ok(!ui.includes('词项'), '用户界面不得出现“词项”注释');
assert.ok(!ui.includes('相关短语') && !ui.includes('组成词') && !ui.includes('词表来源'), '关系展开不得添加说明标题');
assert.ok(model.includes("if (entry.kind === 'phrase')"));
assert.ok(model.includes('continue;'), '短语投影到短语表后必须停止进入普通词表');
assert.ok(store.includes("collection.type === 'normal' && entry.kind === 'word'"));
assert.ok(model.includes('SYSTEM_GLOBAL_WORDS_ID'));
assert.ok(model.includes('systemDomainWordsCollectionId'));
assert.ok(ui.includes("collection.type === 'system-phrases' || collection.type === 'system-global-phrases'"));
assert.ok(ui.includes("className: 'letter-section flat-section'"), '短语词表不得生成首字母标题');
assert.ok(ui.includes('if (relationPanel) row.append(relationPanel)'), '空关系面板不得被 append 为 null 文本');
assert.ok(ui.includes('jumpToRelation'));
assert.ok(ui.includes('preferredNormalDestination'), '短语组成词必须跳到优先普通词表');
assert.ok(ui.includes("className: 'relation-copy'"), '关联子项文字必须保留复制');
assert.ok(ui.includes("iconButton('jump', 'relation-jump'"), '关联跳转必须使用独立控件');
assert.ok(ui.includes("className: 'entry-gloss'"), '启用释义后必须行内显示');
assert.ok(ui.includes("function displayGlossForRelationItem"), '关联展开项必须按当前词域显示繁体释义');
assert.ok(ui.includes("className: 'relation-gloss'"), '关联展开项必须保留释义栏');
assert.ok(css.includes('.relation-gloss'), '关联释义必须具备与一级表项一致的截断样式');


// 性能硬约束：高频读取不得复制整库；PIN 不得走全量 mutate。
const relatedGetterBody = store.match(/export function getRelatedPhrases[\s\S]*?\n}/)?.[0] || '';
const componentsGetterBody = store.match(/export function getPhraseComponents[\s\S]*?\n}/)?.[0] || '';
const searchGetterBody = store.match(/export function search\([\s\S]*?\n}/)?.[0] || '';
const pinBody = store.match(/export async function togglePin[\s\S]*?\n}/)?.[0] || '';
assert.ok(!relatedGetterBody.includes('backupFromState'), '关系读取不得 structuredClone 整库');
assert.ok(!componentsGetterBody.includes('backupFromState'), '短语组成词读取不得 structuredClone 整库');
assert.ok(!searchGetterBody.includes('backupFromState'), '搜索不得在每次输入时 structuredClone 整库');
assert.ok(!pinBody.includes("mutate('切换 PIN'"), 'PIN 不得走全量数据重建');
assert.ok(!pinBody.includes('buildProjection('), 'PIN 不得重建全部投影');
assert.ok(store.includes('relatedPhrasesByEntry'));
assert.ok(store.includes('phraseComponentsByEntry'));
assert.ok(ui.includes('window.setTimeout(renderLocal, 140)'), '搜索输入必须合并连续键入');

// PIN 与审阅控制器持续可达。
assert.ok(css.includes('.app.has-pin'));
assert.ok(css.includes('.app.has-review'));
assert.match(css, /\.context-bar\s*\{[^}]*position:\s*sticky/s);
assert.ok(ui.includes('jumpPinned(collection.id, -1)'));
assert.ok(ui.includes('jumpPinned(collection.id, 1)'));
assert.ok(ui.includes("button('‹', '', () => navigateReview(-1)"));
assert.ok(ui.includes("button('›', '', () => navigateReview(1)"));

// 上次位置严格限定当前词表，菜单中不得重复。
const toolbarBody = ui.match(/function renderCollectionToolbar[\s\S]*?function syncPinIndexForEntry/)?.[0] || '';
assert.ok(ui.includes("iconButton('target', 'last-position-button'"));
assert.ok(ui.includes("reason: 'last'"));
const collectionActionsBody = ui.match(/function openCollectionActions[\s\S]*?function openCollectionMenu/)?.[0] || '';
assert.ok(!collectionActionsBody.includes('上次'), '更多菜单不得重复上次位置');
assert.ok(store.includes("(state.projection.get(collectionId) || []).some"), '读取上次位置时必须验证当前词表可见性');

// 搜索范围必须支持全局、词域和词表三级。
assert.ok(ui.includes("value: 'all'"));
assert.ok(ui.includes('`domain:${domain.id}`'));
assert.ok(ui.includes('`collection:${collection.id}`'));
assert.ok(ui.includes("scope.value = currentCollectionId ? `collection:${currentCollectionId}` : 'all'"));

// 弹窗栈、视口锁定与 iOS 键盘适配。
assert.ok(ui.includes('const dialogStack = []'));
assert.ok(ui.includes('snapshotAppDialog'));
assert.ok(ui.includes('restoreAppDialog'));
assert.ok(ui.includes('lockPageForModal'));
assert.ok(!ui.includes("input.focus({ preventScroll: true })"), '搜索不应自动聚焦并推动 iOS 视口');
assert.ok(css.includes('--visual-height'));
assert.ok(css.includes('.search-dialog[open]'));
assert.ok(css.includes('body.modal-open'));

// 管理页使用拖动排序，而非提高/降低按钮。
assert.ok(ui.includes('makeSortableList'));
assert.ok(ui.includes('reorderCollections'));
assert.ok(ui.includes('reorderDomains'));
assert.ok(ui.includes("item.type === 'normal' && !item.hidden"), '管理器与首页不得暴露内置来源词表');
assert.ok(!ui.includes('提高优先级') && !ui.includes('降低优先级'));
assert.ok(css.includes('.drag-handle'));

// 卡片不得保留大面积绝对定位“宽额头”。
assert.ok(css.includes('.collection-card-title'));
assert.match(css, /\.collection-card\s*\{[^}]*display:\s*grid/s);
const refineCss = css.slice(css.indexOf('/* 3.0.4 navigation, relation and derived-list refinement */'));
assert.ok(!/\.collection-card \.count\s*\{[^}]*position:\s*absolute/s.test(refineCss));
assert.ok(!ui.includes('count-label'));

// 统一定位必须局部展开，不得重建整个词表。
const jumpBody = ui.match(/function jumpToEntry\([\s\S]*?\n}\n\nfunction jumpPinned/)?.[0] || '';
assert.ok(jumpBody.includes('ensureEntryRendered'));
assert.ok(ui.includes('positionElementAtReadingAnchor'));
assert.ok(ui.includes('0.38'), '长距离跳转应使用阅读锚点');
assert.ok(!jumpBody.includes('renderCollection()'));
assert.ok(ui.includes("window.addEventListener('scroll', persistScrollPosition"));


assert.ok(ui.includes("className: 'index-scope global-scope'"), '首页必须封装全局层');
assert.ok(ui.includes("className: 'index-scope domain-scope'"), '首页必须分别封装独立词域');
assert.ok(css.includes('.index-scope') && css.includes('.global-scope') && css.includes('.domain-scope'));
assert.ok(model.includes('hidden: Boolean(hidden)'), '词表模型必须保留隐藏来源标记');
const dbSource = read('js/v3-db.js');
assert.ok(dbSource.includes('BUILTIN_SEED_REVISION = 2'));
assert.ok(dbSource.includes("BUILTIN_COMPUTER_DOMAIN_ID = 'domain_computer_terms'"));
assert.ok(dbSource.includes('ensureBuiltInSeedRevision'), '既有 3.0 数据库必须一次性合并新内置词域');

// 数据交换中心：统一全局、独立域、词表的内容导入导出与完整备份。
assert.ok(ui.includes("button('数据交换'"), '首页设置必须提供数据交换入口');
assert.ok(ui.includes("title: '数据交换'"));
assert.ok(ui.includes('if (dialogSubmitHandler === activeHandler) closeDialog()'), '打开差异预览后不得被父表单提交逻辑立即关闭');
assert.ok(ui.includes("value: 'import-content'"));
assert.ok(ui.includes("value: 'export-content'"));
assert.ok(ui.includes("value: 'export-backup'"));
assert.ok(ui.includes("value: 'restore-backup'"));
assert.ok(ui.includes("value: 'merge'"));
assert.ok(ui.includes("value: 'replace'"));
assert.ok(ui.includes('planDataExchangeFile'));
assert.ok(ui.includes('openDataExchangePreview'));
assert.ok(ui.includes('vocabulary-index-recovery-'), '内容导入前必须自动生成恢复备份');
assert.ok(exchange.includes("export const VIX_FORMAT = 'vix-json'"));
assert.ok(exchange.includes('export function createVixPackage'));
assert.ok(exchange.includes('export function planVixImport'));
assert.ok(exchange.includes('normalizePersonalReferences'));
assert.ok(dataWorker.includes('planVixImport'));
assert.ok(dataWorker.includes('JSON.parse'), '大型内容 JSON 必须在 Worker 中解析');
assert.ok(css.includes('.data-exchange-form'));
assert.ok(css.includes('.exchange-summary'));
assert.ok(ui.includes("value: 'reset-seed'"), '数据交换中心必须保留还原到 Seed 入口');
assert.ok(ui.includes('vocabulary-index-recovery-before-seed-'), '还原 Seed 前必须自动导出恢复备份');
assert.ok(ui.includes('await resetToSeed()'), '还原 Seed 必须调用专用事务接口');
assert.ok(store.includes('export async function resetToSeed()'));
assert.ok(read('js/v3-db.js').includes('replaceWithCanonicalSeed'));
assert.ok(model.includes('contentSources'), '完整备份必须保存来源目录');
assert.ok(model.includes("collection?.type === 'normal' && !collection.hidden"), '隐藏来源不得抢占普通词表投影');

// AI、数据和 PWA 契约。
assert.ok(ui.includes('createAiCheckBatches'));
assert.ok(ui.includes('AiCheckController'));
assert.ok(ai.includes('CATALOG_STORAGE'));
assert.ok(!/qwen|llama|gpt-oss|openai\/gpt/i.test(ai), 'AI 策略不得按模型品牌硬编码');
assert.ok(store.includes('expectedRevision'));
assert.ok(read('js/v3-db.js').includes('setLastPositionSetting'));
assert.ok(store.includes('BroadcastChannel'));
assert.ok(app.includes("const MODULE_VERSION = '3.0.7'"));
assert.ok(app.includes('registration.waiting'));
assert.ok(upgrade.includes('vocabulary-index:cache-bridge:3.0.7'));
assert.ok(upgrade.includes('caches.delete'));
assert.ok(!upgrade.includes('indexedDB'), '升级引导不得触碰业务数据库');

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.startsWith('v3-') && name.endsWith('.js'));
for (const name of jsFiles) {
  const source = read(`js/${name}`);
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const target = path.resolve(root, 'js', path.dirname(name), match[1]);
    assert.ok(fs.existsSync(target), `${name} 依赖不存在：${match[1]}`);
  }
}

const sw = read('sw.js');
assert.ok(sw.includes('v3.0.7-navigation-20260801-1'));
const installBody = sw.match(/sw\.addEventListener\('install',[\s\S]*?\n}\);/)?.[0] || '';
assert.ok(!installBody.includes('skipWaiting'));
assert.ok(sw.includes("event.data?.type === 'SKIP_WAITING'"));
assert.ok(sw.includes('async function appShellFirst'));
assert.ok(sw.includes('event.respondWith(appShellFirst(request))'), '导航必须使用当前代 App Shell，避免新 HTML 与旧 JS 混装');
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.ok(precache.includes('./js/v3-exchange.js'));
assert.ok(precache.includes('./js/v3-data-worker.js'));
assert.equal(new Set(precache).size, precache.length);
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (clean) assert.ok(exists(clean), `预缓存资源不存在：${clean}`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.ok(css.includes(':focus-visible'));
assert.ok(css.includes('Georgia'));
assert.ok(css.includes('--bg: #f5f1e8'));
assert.ok(css.includes('--accent: #2e5b4b'));
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));

console.log('static-tests: OK');
