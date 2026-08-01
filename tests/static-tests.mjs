import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));

const html = read('index.html');
assert.ok(html.includes('name="application-version" content="3.0.0"'));
assert.ok(html.includes("script-src 'self'"));
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
  'detail-dialog', 'detail-title', 'detail-description', 'detail-close', 'detail-body',
  'search-dialog', 'search-close', 'search-body',
  'confirm-dialog', 'confirm-form', 'confirm-title', 'confirm-description', 'confirm-body', 'confirm-cancel', 'confirm-submit',
  'hidden-file-input',
];
for (const id of requiredIds) assert.ok(ids.includes(id), `HTML 缺少 UI 节点：${id}`);
assert.ok(!html.includes('mobile-action-bar'), '真 3.0 不得包含永久移动底栏');

const ui = read('js/v3-ui.js');
const css = read('css/v3.css');
const app = read('js/v3-app.js');
const store = read('js/v3-store.js');
const ai = read('js/v3-ai.js');

// 主浏览面：点词复制、单一更多入口、当前词表词性。
assert.ok(ui.includes("className: 'copy-entry'"));
assert.ok(ui.includes("sourceLabelForCollection(entry.id, collection.id)"));
assert.ok(ui.includes("button('⋯', 'entry-more'"));
assert.ok(!ui.includes('expandedEntries'), '详情不得依赖整表展开状态');
assert.ok(ui.includes('openEntryActions'));
assert.ok(ui.includes('openEntryDetails'));
assert.ok(html.includes('id="action-dialog"') && html.includes('id="detail-dialog"'), '动作与详情必须分离');

// PIN 与标注审阅是互斥、持续可达的上下文控制器。
assert.ok(css.includes('.app.has-pin'));
assert.ok(css.includes('.app.has-review'));
assert.ok(css.includes('.context-bar'));
assert.match(css, /\.context-bar\s*\{[^}]*position:\s*sticky/s);
assert.ok(ui.includes("if (review.ids.length || !pins.length)"));
assert.ok(ui.includes("elements.app.classList.remove('has-pin')"));
assert.ok(ui.includes("button('‹', '', () => navigateReview(-1)"));
assert.ok(ui.includes("button('›', '', () => navigateReview(1)"));
assert.ok(ui.includes('jumpPinned(collection.id, -1)'));
assert.ok(ui.includes('jumpPinned(collection.id, 1)'));
assert.match(css, /\.letter-nav\s*\{[^}]*position:\s*sticky[^}]*top:\s*calc\(var\(--topbar-height\) \+ var\(--context-height\)\)/s);

// 统一定位必须局部展开，不得重建整个词表。
const jumpBody = ui.match(/function jumpToEntry\([\s\S]*?\n}\n\nfunction jumpPinned/)?.[0] || '';
assert.ok(jumpBody.includes('ensureEntryRendered'));
assert.ok(jumpBody.includes('scrollIntoView'));
assert.ok(!jumpBody.includes('renderCollection()'), '单词定位不得重建整张词表');
assert.ok(ui.includes("window.addEventListener('scroll', persistScrollPosition"));
assert.ok(ui.includes('setLastPosition(entry.domainId, collection.id, entry.id)'));

// 搜索、确认、AI 任务与 PWA 更新均有独立状态。
assert.ok(html.includes('id="search-dialog"'));
assert.ok(html.includes('id="confirm-dialog"'));
assert.ok(ui.includes('taskPanelExpanded'));
assert.ok(ui.includes("elements['task-capsule']"));
assert.ok(ui.includes('notifyServiceWorkerUpdate'));
assert.ok(app.includes('registration.waiting'));
assert.ok(app.includes("navigator.serviceWorker.addEventListener('controllerchange'"));

// 数据与 AI 核心契约。
assert.ok(store.includes('expectedRevision'), '跨实例写入必须检查数据修订号');
assert.ok(read('js/v3-db.js').includes('setLastPositionSetting'), '浏览位置必须原子合并写入');
assert.ok(store.includes('mergeSourceLabels'), '重复词性必须合并');
assert.ok(ui.includes('createAiCheckBatches'));
assert.ok(ui.includes('AiCheckController'));
assert.ok(ai.includes('CATALOG_STORAGE'));
assert.ok(!/qwen|llama|gpt-oss|openai\/gpt/i.test(ai), 'AI 策略不得按模型品牌硬编码');
assert.ok(ui.includes('setNumberMode'));
assert.ok(store.includes('BroadcastChannel'));

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.startsWith('v3-') && name.endsWith('.js'));
for (const name of jsFiles) {
  const source = read(`js/${name}`);
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const target = path.resolve(root, 'js', path.dirname(name), match[1]);
    assert.ok(fs.existsSync(target), `${name} 依赖不存在：${match[1]}`);
  }
}
assert.ok(!jsFiles.some((name) => name.includes('cloud')));
assert.ok(!jsFiles.some((name) => read(`js/${name}`).includes('api.github.com')));

const sw = read('sw.js');
assert.ok(sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v3.0.0-final`"));
const installBody = sw.match(/sw\.addEventListener\('install',[\s\S]*?\n}\);/)?.[0] || '';
assert.ok(!installBody.includes('skipWaiting'), '安装阶段不得静默强制更新');
assert.ok(sw.includes("event.data?.type === 'SKIP_WAITING'"), '用户确认后才激活新版本');
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length, 'Service Worker 预缓存路径不得重复');
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (!clean) continue;
  assert.ok(exists(clean), `预缓存资源不存在：${clean}`);
}

const model = read('js/v3-model.js');
assert.ok(model.includes('createMembership'));
assert.ok(!/createMembership[\s\S]{0,600}sourceText/.test(model), 'Membership 不得包含 sourceText');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.icons.every((icon) => icon.src.startsWith('./')));

// 基本可访问性和真 3.0 视觉契约。
assert.ok(css.includes(':focus-visible'));
assert.ok(css.includes('min-height: 44px'));
assert.ok(css.includes('Georgia'));
assert.ok(css.includes('--bg: #f5f1e8'));
assert.ok(css.includes('--accent: #2e5b4b'));
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));

console.log('static-tests: OK');
