import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.VIX_PLAYWRIGHT_PATH || 'playwright');
} catch (error) {
  const workspaceRuntime = 'C:/Users/huawei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js';
  if (!fs.existsSync(workspaceRuntime)) throw error;
  playwright = require(workspaceRuntime);
}
const { chromium } = playwright;
const executablePath = process.env.VIX_CHROMIUM_PATH
  || [chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
    .find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error('Set VIX_CHROMIUM_PATH to a Chromium-compatible browser executable');

const styles = [
  'css/v3.css', 'css/v3.3.1.css', 'css/v3.4.0.css', 'css/v4.0.0.css', 'css/v4.0.1.css', 'css/v4.0.2.css',
  'css/v4.1.0.css', 'css/v4.2.0.css', 'css/v4.3.0.css', 'css/v4.4.0.css', 'css/v4.5.0.css', 'css/v4.6.0.css',
  'css/v4.7.0.css', 'css/v4.7.1.css', 'css/v4.7.2.css', 'css/v4.7.3.css', 'css/v5.0.0.css',
].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
const uiSource = fs.readFileSync(path.join(root, 'js/v3-ui.js'), 'utf8');
const sortableSource = uiSource.match(/function makeSortableList\(container, onCommit\) \{[\s\S]*?\n\}(?=\n\nfunction createLibraryOrderDraft)/)?.[0];
assert.ok(sortableSource, 'Unable to extract the production sortable implementation');

const actions = '<div class="entry-actions"><span class="entry-action-placeholder relation-placeholder"></span><button></button><button></button><button></button><button></button></div>';
function row(id, index, word, { gloss = '', source = '', date = '' } = {}) {
  return `<article id="${id}" class="entry-row word-normal has-index ${gloss ? 'has-gloss' : 'no-gloss'}${source ? ' has-source-domain' : ''}"><div class="entry-primary-shell"><div class="entry-line${gloss ? ' has-left-meta' : ''}${source ? ' has-right-meta' : ''}">
    <span class="entry-index-inline">${index}</span><div class="entry-text-viewport horizontally-scrollable ${gloss ? 'has-gloss' : 'no-gloss'}"><div class="entry-text-content"><div class="entry-lexeme-stack"><span class="entry-text">${word}</span>${gloss ? `<span class="entry-gloss">${gloss}</span>` : ''}</div></div></div>
    <div class="entry-control-stack${source ? ' has-source' : ''}"><div class="entry-control-main">${date ? `<span class="entry-study-date marked">${date}</span>` : ''}${actions}</div>${source ? `<span class="entry-source-domain">${source}</span>` : ''}</div>
  </div></div></article>`;
}
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${styles}</style></head><body>
<div id="app"></div><div id="entry-fixture" style="width:100%;max-width:520px;margin:0 auto">
${row('plain-row', '12', 'access', { date: '8月8日' })}${row('gloss-row', '13', 'thread', { gloss: '執行緒' })}${row('source-row', '14', 'edge', { source: '計算機術語' })}${row('both-row', '15', 'rendering pipeline', { gloss: '渲染管線', source: '一個非常長的來源標籤', date: '8月8日' })}</div>
<nav id="letter-fixture" class="letter-nav"><div class="letter-nav-track"><button>A</button><button>B</button><button class="empty" disabled>#</button></div></nav>
<nav id="bottom-toolbar" class="bottom-toolbar"><button><span class="ui-icon"></span></button><button disabled><span class="ui-icon"></span></button><button><span class="ui-icon"></span></button><button disabled><span class="ui-icon"></span></button><button><span class="ui-icon"></span></button></nav>
<div id="app-dialog" class="modal-host"><section id="management-layer" class="modal-layer" data-depth="1" data-variant="management"><div class="modal-layer-backdrop"></div><form id="dialog-form" class="modal-card modal-card-management"><header class="dialog-header"><div><h2>管理</h2></div><button class="icon-button" type="button"></button></header><div class="dialog-body"><label class="field"><span>文本</span><input value="test"></label></div><footer class="dialog-actions"><button>取消</button><button>保存</button></footer></form></section>
<section id="search-layer" class="modal-layer" data-depth="2" data-variant="search"><div class="modal-layer-backdrop"></div><div id="search-card" class="modal-card modal-card-search"><header class="dialog-header"><div><h2>搜索</h2></div><button class="icon-button"></button></header><div class="dialog-body"><div class="search-controls"><input value="edge"><select><option>全部</option></select><button class="secondary-button">搜索</button></div></div></div></section>
<section id="confirm-layer" class="modal-layer" data-depth="3" data-variant="confirm"><div class="modal-layer-backdrop"></div><form id="confirm-card" class="modal-card modal-card-confirm"><header class="dialog-header"><div><h2>确认操作</h2></div><button class="icon-button"></button></header><div class="dialog-body"><p>确认内容</p></div><footer class="dialog-actions"><button>取消</button><button>确认</button></footer></form></section></div>
<section id="pin-fixture" class="context-bar pin-bar" aria-hidden="true"><div class="pin-bar-content"><span>PIN</span></div></section></body></html>`;

const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  await page.setContent(html);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--visual-width', `${innerWidth}px`);
    document.documentElement.style.setProperty('--visual-height', `${innerHeight}px`);
    document.documentElement.style.setProperty('--visual-center-x', `${innerWidth / 2}px`);
    document.documentElement.style.setProperty('--visual-center-y', `${innerHeight / 2}px`);
  });
  const box = (selector) => page.locator(selector).boundingBox();
  const host = await box('#app-dialog');
  const appCard = await box('#dialog-form');
  assert.ok(host && appCard);
  assert.ok(Math.abs(host.width - 402) < 1 && Math.abs(host.height - 874) < 1);
  assert.ok(appCard.width <= 374.5 && appCard.height <= 666.5 && appCard.y > 12 && appCard.y + appCard.height < 862);
  assert.ok(Math.abs(appCard.x + appCard.width / 2 - 201) < 1.5);

  for (const selector of ['#search-card', '#confirm-card']) {
    const card = await box(selector);
    assert.ok(card && card.height < 850 && Math.abs(card.x + card.width / 2 - 201) < 1.5);
  }
  for (const selector of ['#management-layer', '#search-layer', '#confirm-layer']) {
    const layer = await box(selector);
    const backdrop = await box(`${selector} .modal-layer-backdrop`);
    assert.ok(layer && backdrop && Math.abs(layer.width - 402) < 1 && Math.abs(layer.height - 874) < 1);
    assert.ok(Math.abs(backdrop.width - 402) < 1 && Math.abs(backdrop.height - 874) < 1);
  }

  const pin = page.locator('#pin-fixture');
  assert.equal(await pin.evaluate((element) => getComputedStyle(element).display), 'grid');
  assert.equal(await pin.evaluate((element) => getComputedStyle(element).visibility), 'hidden');
  await pin.evaluate((element) => element.classList.add('dock-visible'));
  assert.equal(await pin.evaluate((element) => getComputedStyle(element).visibility), 'visible');

  const gloss = await box('#both-row .entry-gloss');
  const source = await box('#both-row .entry-source-domain');
  const line = await box('#both-row .entry-line');
  assert.ok(gloss && source && line);
  const glossGap = line.y + line.height - gloss.y - gloss.height;
  const sourceGap = line.y + line.height - source.y - source.height;
  assert.ok(Math.abs(glossGap - sourceGap) <= 1.2);
  for (const id of ['plain-row', 'gloss-row', 'source-row', 'both-row']) {
    const rowLine = await box(`#${id} .entry-line`);
    const index = await box(`#${id} .entry-index-inline`);
    assert.ok(rowLine && index && Math.abs(index.y + index.height / 2 - rowLine.y - rowLine.height / 2) <= 1.5);
  }

  const cells = [1, 2, 3].map((index) => page.locator(`#letter-fixture button:nth-child(${index})`));
  assert.equal(await cells[0].evaluate((element) => getComputedStyle(element).borderLeftWidth), '1px');
  for (const cell of cells) for (const side of ['Top', 'Right', 'Bottom']) {
    assert.equal(await cell.evaluate((element, property) => getComputedStyle(element)[property], `border${side}Width`), '1px');
  }
  assert.equal(await cells[2].evaluate((element) => getComputedStyle(element).opacity), '1');
  const toolbar = await box('#bottom-toolbar');
  assert.ok(toolbar && Math.abs(toolbar.height - 58) <= 0.7);
  assert.equal(await page.locator('body').evaluate((element) => getComputedStyle(element).userSelect), 'none');
  assert.equal(await page.locator('#dialog-form input').evaluate((element) => getComputedStyle(element).userSelect), 'text');

  const sortableResult = await page.evaluate(async (source) => {
    globalThis.displayError = (error) => { throw error; };
    globalThis.eval(`${source}; globalThis.__makeSortableList = makeSortableList;`);
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.hasPointerCapture = () => false;
    const outer = document.createElement('div');
    outer.innerHTML = `
      <section data-sort-id="domain-a"><button class="drag-handle"></button><div class="inner">
        <div data-sort-id="collection-a"><button id="inner-handle" class="drag-handle"></button></div>
        <div id="inner-target" data-sort-id="collection-b"><button class="drag-handle"></button></div>
      </div></section>
      <section data-sort-id="domain-b"><button class="drag-handle"></button></section>`;
    document.body.append(outer);
    const inner = outer.querySelector('.inner');
    const innerTarget = outer.querySelector('#inner-target');
    innerTarget.getBoundingClientRect = () => ({ top: 10, height: 40, bottom: 50, left: 0, right: 100, width: 100, x: 0, y: 10, toJSON() {} });
    document.elementFromPoint = () => innerTarget;
    const commits = { inner: [], outer: [] };
    globalThis.__makeSortableList(inner, (ids) => { commits.inner.push(ids); });
    globalThis.__makeSortableList(outer, (ids) => { commits.outer.push(ids); });
    const handle = outer.querySelector('#inner-handle');
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, button: 0, clientX: 8, clientY: 12 }));
    handle.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, button: 0, clientX: 8, clientY: 45 }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    handle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, button: 0, clientX: 8, clientY: 45 }));
    await Promise.resolve();
    return {
      innerOrder: [...inner.children].filter((item) => item.dataset.sortId).map((item) => item.dataset.sortId),
      outerOrder: [...outer.children].filter((item) => item.dataset.sortId).map((item) => item.dataset.sortId),
      commits,
    };
  }, sortableSource);
  assert.deepEqual(sortableResult.innerOrder, ['collection-b', 'collection-a']);
  assert.deepEqual(sortableResult.outerOrder, ['domain-a', 'domain-b']);
  assert.deepEqual(sortableResult.commits.inner, [['collection-b', 'collection-a']]);
  assert.deepEqual(sortableResult.commits.outer, []);
  await page.close();
} finally {
  await browser.close();
}
console.log('layout-contract-check: OK (402x874, alpha4 styles)');
