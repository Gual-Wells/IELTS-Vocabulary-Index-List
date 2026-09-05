import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json'], ['.png', 'image/png'],
]);

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  if (pathname.startsWith('/api/')) { response.writeHead(404).end(); return; }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'content-type': types.get(path.extname(target)) || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(target).pipe(response);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.VIX_CHROMIUM_PATH
  || [playwright.chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
    .find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error('Set VIX_CHROMIUM_PATH to a Chromium-compatible browser executable');
const browser = await playwright.chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ serviceWorkers: 'block' });

try {
  const first = await context.newPage();
  const firstStart = Date.now();
  await first.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await first.waitForFunction(() => Number(document.querySelector('#boot-progress')?.value || 0) >= 12, null, { timeout: 180_000 });
  const interruptedAt = Date.now() - firstStart;
  const interrupted = await first.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('gual-vocabulary-index', 5);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('v3Settings', 'readonly');
    const value = await new Promise((resolve, reject) => {
      const request = tx.objectStore('v3Settings').get('seedImportState');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  });
  assert.equal(interrupted?.protocol, 'vix-seed-import/1');
  assert.ok(interrupted.writtenRecords > 0);
  await first.close();

  const resumedPage = await context.newPage();
  const resumedStart = Date.now();
  await resumedPage.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await resumedPage.waitForSelector('#app:not(.hidden)', { timeout: 600_000 });
  const resumedElapsed = Date.now() - resumedStart;
  const result = await resumedPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('gual-vocabulary-index', 5);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stores = ['v3Domains', 'v3Collections', 'v3Entries', 'v3Memberships', 'v3RelationComponents'];
    const counts = {};
    for (const name of stores) {
      const tx = db.transaction(name, 'readonly');
      counts[name] = await new Promise((resolve, reject) => {
        const request = tx.objectStore(name).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    const tx = db.transaction('v3Settings', 'readonly');
    const settingsStore = tx.objectStore('v3Settings');
    const read = (key) => new Promise((resolve, reject) => {
      const request = settingsStore.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
    const schemaVersion = await read('schemaVersion');
    const importState = await read('seedImportState');
    db.close();
    return { counts, schemaVersion, importState, version: document.querySelector('meta[name="application-version"]')?.content };
  });
  assert.equal(result.schemaVersion, 6);
  assert.equal(result.importState, null);
  assert.equal(result.version, '5.0.0-alpha.9');
  assert.deepEqual(result.counts, {
    v3Domains: 3, v3Collections: 24, v3Entries: 23917, v3Memberships: 61905, v3RelationComponents: 20793,
  });
  console.log(`cold-start-browser: OK (interrupted after ${interruptedAt}ms at ${interrupted.writtenRecords} records; resumed in ${resumedElapsed}ms)`);
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
