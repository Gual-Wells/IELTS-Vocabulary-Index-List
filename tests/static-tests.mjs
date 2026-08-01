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
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(html));
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');

const ui = read('js/v3-ui.js');
for (const id of [...ui.matchAll(/'([a-z][a-z0-9-]+)'/g)].map((match) => match[1])) {
  if (id.includes('-') && ui.includes(`'${id}'`) && ['boot-screen','back-button','page-title','page-subtitle','undo-button','redo-button','search-button','settings-button','home-view','collection-view','collection-toolbar','pin-bar','letter-nav','entry-list','mobile-action-bar','task-panel','annotation-review-bar','toast-region','app-dialog','dialog-form','dialog-title','dialog-description','dialog-close','dialog-body','dialog-actions','hidden-file-input'].includes(id)) {
    assert.ok(ids.includes(id), `UI 引用的 ID 不存在：${id}`);
  }
}

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.startsWith('v3-') && name.endsWith('.js'));
for (const name of jsFiles) {
  const source = read(`js/${name}`);
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const target = path.resolve(root, 'js', path.dirname(name), match[1]);
    assert.ok(fs.existsSync(target), `${name} 依赖不存在：${match[1]}`);
  }
}

const sw = read('sw.js');
assert.ok(sw.includes("const CACHE_NAME = `${CACHE_PREFIX}v3.0.0-rc2`"));
const precacheBody = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)?.[1] || '';
const precache = [...precacheBody.matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
assert.equal(new Set(precache).size, precache.length, 'Service Worker 预缓存路径不得重复');
for (const relative of precache) {
  const clean = relative.replace(/^\.\//, '');
  if (!clean) continue;
  const retained = clean.startsWith('data/') || clean.startsWith('assets/icons/');
  assert.ok(exists(clean) || retained, `预缓存资源不存在：${clean}`);
}

const model = read('js/v3-model.js');
assert.ok(model.includes('createMembership'));
assert.ok(!/createMembership[\s\S]{0,600}sourceText/.test(model), 'Membership 不得包含 sourceText');
assert.ok(ui.includes('AiCheckController'));
assert.ok(ui.includes('setNumberMode'));
assert.ok(read('js/v3-db.js').includes('expectedRevision'), '跨实例写入必须检查数据修订号');
assert.ok(read('js/v3-db.js').includes('setLastPositionSetting'), '浏览位置必须使用原子合并写入');
assert.ok(ui.includes('BroadcastChannel') || read('js/v3-store.js').includes('BroadcastChannel'));
assert.ok(!jsFiles.some((name) => name.includes('cloud')));
assert.ok(!jsFiles.some((name) => read(`js/${name}`).includes('api.github.com')));



const css = read('css/v3.css');
assert.ok(html.includes('id="pin-bar"'), '词表页必须具有独立 PIN 上下文导航');
assert.ok(html.includes('id="mobile-action-bar"'), '移动端必须具有持续可达的词表操作栏');
assert.ok(html.includes('id="undo-button"') && html.includes('id="redo-button"'), '撤销与重做必须位于持续可达的顶栏');
assert.ok(ui.includes('function renderPinBar('), '必须渲染 PIN 导航条');
assert.ok(ui.includes('function syncPinIndexForEntry('), 'PIN 跳转后必须同步当前 PIN');
assert.ok(ui.includes('function openEntryDetailSheet('), '词条关系与低频操作必须进入详情 Sheet');
assert.ok(ui.includes("move(-1)") && ui.includes("move(1)"), 'AI 标注审阅必须同时提供上一条与下一条');
assert.ok(!ui.includes("button('PIN ←'"), 'PIN 导航不得放回会滚出视口的词表顶部工具栏');
assert.ok(!ui.includes('expandedEntries'), '词条详情不得依赖整表重绘式内联展开状态');
assert.match(css, /\.pin-bar\s*\{[\s\S]*?position:\s*sticky/, 'PIN 导航必须随滚动保持可达');
assert.ok(css.includes('top: var(--topbar-height)'), 'PIN 导航必须停靠在顶栏下方');
assert.ok(css.includes('top: calc(var(--topbar-height) + var(--pinbar-offset))'), '字母导航必须避让 PIN 导航');
assert.match(css, /\.mobile-action-bar:not\(\.hidden\)\s*\{[\s\S]*?position:\s*fixed/, '移动操作栏必须固定在安全区上方');
assert.ok(css.includes('min-height: 44px'), '高频触控目标必须达到 44px 级别');
assert.ok(css.includes(':focus-visible'), '自定义控件必须保留可见键盘焦点');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.ok(manifest.icons.every((icon) => icon.src.startsWith('./')));

console.log('static-tests: OK');
