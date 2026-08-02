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
const css = read('css/v3.css');

// Version, shell, and CSP.
assert.ok(html.includes('name="application-version" content="3.1.1"'));
assert.ok(html.includes('<title>Vocabulary Index 3.1.1</title>'));
assert.ok(html.includes("script-src 'self'"));
assert.ok(html.indexOf('./js/v3-upgrade.js') < html.indexOf('./css/v3.css'));
assert.ok(html.includes('./js/v3-app.js'));
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(html));
assert.ok(app.includes("const MODULE_VERSION = '3.1.1'"));
assert.ok(upgrade.includes('vocabulary-index:cache-bridge:3.1.1'));
assert.ok(sw.includes('v3.1.1-entry-integrations-20260802-1'));
assert.ok(sw.includes('./js/v3-integrations.js'));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');
for (const id of ['app', 'home-view', 'collection-view', 'letter-nav', 'entry-list', 'back-to-top', 'hidden-file-input']) {
  assert.ok(ids.includes(id), `HTML 缺少 ${id}`);
}
assert.ok(!html.includes('detail-dialog'));
assert.ok(!html.includes('mobile-action-bar'));

// Schema 4 and preservation of 3.0.x data during IndexedDB upgrade.
assert.ok(model.includes('export const SCHEMA_VERSION = 4'));
assert.ok(db.includes('export const DB_VERSION = 4'));
assert.ok(db.includes('const BUILTIN_SEED_REVISION = 3'));
assert.ok(db.includes('StudyStamps'));
assert.ok(db.includes("const DATA_STORE_KEYS = ['domains', 'collections', 'entries', 'memberships', 'phraseTokens', 'pins', 'annotations', 'studyStamps']"));
assert.ok(db.includes('async function readCurrentSnapshot(db)'));
assert.ok(db.includes("sourceVersion: source.appVersion || (currentSnapshot ? '3.0.x' : '2.x')"));
assert.ok(model.includes('if ([3, SCHEMA_VERSION].includes(Number(input?.schemaVersion))'));

// Total views are virtual, type-pure, and named consistently.
assert.ok(store.includes("name: '全局词汇总表'"));
assert.ok(store.includes("name: '全局短语总表'"));
assert.ok(store.includes("name: '词汇总表'"));
assert.ok(model.includes('SYSTEM_GLOBAL_WORDS_ID'));
assert.ok(model.includes('SYSTEM_GLOBAL_PHRASES_ID'));
assert.ok(ui.includes("text: '全局词汇总表'"));
assert.ok(ui.includes("text: '全局短语总表'"));
assert.ok(ui.includes("text: '词汇总表'"));
assert.ok(ui.includes("text: phraseCollection?.name || '短语'"));

// Normal collections are composite: word section first and phrase section second.
assert.ok(ui.includes('function isCompositeCollection(collection)'));
assert.ok(ui.includes("sections.set('word', createSectionContext('word'"));
assert.ok(ui.includes("sections.set('phrase', createSectionContext('phrase'"));
assert.ok(ui.includes("text: section === 'word' ? '词汇' : '短语'"));
assert.ok(ui.includes("otherSection === 'phrase' ? '跳到短语区' : '跳到词汇区'"));
assert.ok(ui.includes("collection.type === 'normal' ? '新增词汇或短语'"));
assert.ok(store.includes("collection.type === 'normal'"));
assert.ok(exchange.includes("targetCollection?.type === 'normal'"));
assert.ok(model.includes("if (entry.kind === 'phrase')"));

// Alphabet and date modes, independent positions, calendar, and unmarked section.
assert.ok(ui.includes("mode === 'date' ? 'alphabet' : 'calendar'"));
assert.ok(ui.includes('function navigationControls(collection, section, sectionContext, mode, otherSection = \'\')'));
assert.ok(ui.includes('function renderDateContent'));
assert.ok(ui.includes("className: 'date-year-title'"));
assert.ok(ui.includes("className: 'date-month-title'"));
assert.ok(ui.includes("className: 'date-day-title'"));
assert.ok(ui.includes("className: 'date-unmarked-heading', text: '未标注'"));
assert.ok(ui.includes("'跳到未标注条目'"));
assert.ok(ui.includes('function calendarForSection'));
assert.ok(store.includes('export function getViewMode(collectionId)'));
assert.ok(store.includes('export async function setViewMode(collectionId, mode)'));
assert.ok(store.includes('export function getCalendarMonth(collectionId, section = \'main\')'));
assert.ok(store.includes('export async function setCalendarMonth(collectionId, section, month)'));
assert.ok(store.includes('`lastPosition:${domainId}:${collectionId}:${mode}:${section}`'));
assert.ok(model.includes('viewModes:'));
assert.ok(model.includes('calendarMonths:'));

// Study date is an explicit user action and has a separate persistent store.
assert.ok(model.includes('export function createStudyStamp'));
assert.ok(store.includes('export async function refreshStudyDate(entryId, collectionId'));
assert.ok(ui.includes("className: 'entry-study-date'"));
assert.ok(ui.includes("iconButton('refresh', 'entry-study-refresh'"));
assert.ok(ui.includes('async function refreshEntryStudyDate'));
assert.ok(!ui.match(/copyText[\s\S]{0,500}refreshStudyDate/), '复制不得刷新学习日期');
assert.ok(exchange.includes('Study dates, PINs, annotations and view state are intentionally excluded') || !exchange.includes('data: { studyStamps'));
assert.ok(css.includes('.entry-study-refresh'));
assert.ok(css.includes('.date-day-section'));

// Relation navigation: totals only jump out; legal destinations are normal collections.
assert.ok(ui.includes('function normalDestinationsForEntries'));
assert.ok(ui.includes("collection.type !== 'normal' || collection.hidden"));
assert.ok(ui.includes("navigationKind: 'intra'"));
assert.ok(ui.includes("navigationKind: 'external'"));
assert.ok(ui.includes("navigationKind: 'global'"));
assert.ok(ui.includes("item.navigationKind === 'external' ? 'external' : item.navigationKind === 'global' ? 'globalDown' : 'intra'"));
assert.ok(ui.includes('从全局下钻到'));
assert.ok(ui.includes('跳到其他独立域中的'));
assert.ok(ui.includes('跳到当前独立域中的'));
assert.ok(ui.includes('destinations: normalDestinationsForEntries'));
assert.ok(!ui.includes('preferredNormalDestination'), '旧版回退到总表的目标解析不得保留');
assert.ok(ui.includes('function globalRepresentative(entry)'));

// Return-to-top is in-table and must not overwrite the saved last position.
assert.ok(html.includes('id="back-to-top"'));
assert.ok(ui.includes('function returnToTop()'));
assert.ok(ui.includes("elements['back-to-top']?.addEventListener('click', returnToTop)"));
assert.ok(css.includes('.back-to-top'));

// Existing interaction contracts remain: inline PIN, relation copy/jump, gloss parity, no POS in main row.
assert.ok(ui.includes("className: `entry-pin${pinned ? ' active' : ''}`"));
assert.ok(ui.includes("className: 'relation-copy'"));
assert.ok(ui.includes('relation-jump'));
assert.ok(ui.includes('function displayGlossForRelationItem'));
assert.ok(ui.includes("className: 'relation-gloss'"));
assert.ok(ui.includes("className: 'entry-gloss'"));
assert.ok(!ui.includes("className: 'entry-pos'"));
assert.ok(!ui.includes('词项'));

// First-level external query controls are direct, isolated user actions.
assert.ok(ui.includes("iconButton('dictionary', 'entry-oxford'"));
assert.ok(ui.includes("iconButton('aiChat', 'entry-chatgpt'"));
assert.ok(ui.includes('function openOxfordLookup(entry)'));
assert.ok(ui.includes('function openChatGPTEntryQuery(entry, collection)'));
assert.ok(ui.includes('createEntryContext(state, entry, collection.id'));
assert.ok(integrations.includes("export const CHATGPT_SHORTCUT_NAME = 'AI查询'"));
assert.ok(integrations.includes("hk-com-oupc-oecd-lookup://x-callback-url/s"));
assert.ok(integrations.includes('shortcuts://run-shortcut'));
assert.ok(integrations.includes('&input=text&text='));
assert.ok(integrations.includes("scope: 'global-aggregate'"));
assert.ok(integrations.includes("scope: 'domain-entry'"));
assert.ok(integrations.includes('Groq API Key'));
assert.ok(css.includes('.entry-oxford'));
assert.ok(css.includes('.entry-chatgpt'));

// Data exchange and Seed reset remain available; content packages exclude personal state.
assert.ok(ui.includes("option('还原到 Seed'" ) || ui.includes("text: '还原到 Seed'"));
assert.ok(ui.includes('备份并还原初始数据') || ui.includes('确认还原初始数据'));
assert.ok(exchange.includes('createVixPackage'));
assert.ok(exchange.includes('planVixImport'));
assert.ok(!/data\s*:\s*\{[^}]*studyStamps/s.test(exchange));

// Performance protections retained.
for (const [name, source] of [
  ['getRelatedPhrases', store.match(/export function getRelatedPhrases[\s\S]*?\n}/)?.[0] || ''],
  ['getPhraseComponents', store.match(/export function getPhraseComponents[\s\S]*?\n}/)?.[0] || ''],
  ['search', store.match(/export function search\([\s\S]*?\n}/)?.[0] || ''],
]) assert.ok(!source.includes('backupFromState'), `${name} 不得复制整库`);
assert.ok(store.includes('relatedPhrasesByEntry'));
assert.ok(store.includes('phraseComponentsByEntry'));
assert.ok(ui.includes('window.setTimeout(renderLocal, 140)'));

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
assert.ok(manifest.name.includes('3.1.1'));
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
