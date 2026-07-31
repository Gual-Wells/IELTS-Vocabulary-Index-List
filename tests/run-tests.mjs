import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildCategoryViewModel, resolveExpandedLetters } from '../js/category-view-model.js';
import { applyManualEntryEdit, mergeEntrySource, recalculateEntry } from '../js/entry-model.js';
import { formatPos, groupForWord, mergePos, normalizeCategoryName, normalizeWord, parsePos } from '../js/utils.js';
import { canonicalizeBackup, exportCategoryCsv, exportCategoryMarkdown, parseCsv, parseImportContent, parseMarkdownOrText, validateBackup } from '../js/import-export.js';
import { fuzzySearch, scoreWord } from '../js/search.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function clone(value) { return structuredClone(value); }
function pngSize(relative) {
  const data = fs.readFileSync(path.join(root, relative));
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG');
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

// Core normalization and POS behavior.
assert.equal(normalizeWord('  Can’t   wait  '), "can't wait");
assert.equal(normalizeCategoryName('  Ａ１   Core '), 'a1 core');
assert.equal(groupForWord('apple'), 'A');
assert.equal(groupForWord(' according to'), 'A');
assert.equal(groupForWord('123'), '#');
assert.deepEqual(parsePos('n., v., noun'), ['n.', 'v.']);
assert.deepEqual(parsePos('det./pron./adv.'), ['adv.', 'pron.', 'det.']);
assert.equal(formatPos(mergePos(['v.'], ['n.', 'v.'])), 'n., v.');
assert.throws(() => parsePos('noun-ish'), /无法识别词性/);


// Pure global ownership/POS model tests cover duplicate merging independently
// of IndexedDB and UI event timing.
const modelCategories = [
  { id: 'a1', name: 'A1', order: 0 },
  { id: 'b1', name: 'B1', order: 1 },
];
const multiSource = recalculateEntry({
  id: 'e1', word: 'access', normalizedWord: 'access', manualWord: null, manualPos: null,
  sources: {
    a1: { word: 'access', pos: ['n.'] },
    b1: { word: 'access', pos: ['v.'] },
  },
}, modelCategories, { now: 'test' });
assert.equal(multiSource.categoryId, 'a1');
assert.equal(formatPos(multiSource.pos), 'n., v.');
const movedSource = recalculateEntry(multiSource, [
  { ...modelCategories[1], order: 0 }, { ...modelCategories[0], order: 1 },
], { now: 'test2' });
assert.equal(movedSource.categoryId, 'b1');
const manualThenImported = mergeEntrySource({ ...multiSource, manualPos: ['n.'] }, 'b1', { word: 'access', pos: ['adj.'] }, modelCategories);
assert.equal(formatPos(manualThenImported.pos), 'n., adj.');

const renamed = applyManualEntryEdit(multiSource, 'accessible', ['adj.'], modelCategories);
assert.equal(renamed.word, 'accessible');
assert.equal(renamed.normalizedWord, 'accessible');
assert.equal(formatPos(renamed.pos), 'adj.');
assert.ok(Object.values(renamed.sources).every((source) => normalizeWord(source.word) === 'accessible'),
  '人工改名必须同步更新所有来源词形，避免后续导入产生来源不一致');

// Import parsers never mutate data and reject malformed rows.
const md = parseMarkdownOrText('# Demo\n## A\naccess n., v.\naccess v.\naccording to prep.\n');
assert.equal(md.errors.length, 0);
assert.equal(md.entries.length, 2);
assert.equal(formatPos(md.entries.find((item) => item.word === 'access').pos), 'n., v.');
const hashWord = parseMarkdownOrText('#hashtag n.\n');
assert.equal(hashWord.entries.length, 1, '没有空格的 # 开头词汇不能被误判为 Markdown 标题');
assert.equal(hashWord.entries[0].word, '#hashtag');
assert.equal(parseMarkdownOrText(`${'a'.repeat(161)} n.\n`).entries.length, 0);
assert.match(parseMarkdownOrText(`${'a'.repeat(161)} n.\n`).errors[0], /超过 160/);

const csv = parseCsv('word,pos\n"access","n., v."\n"according to","prep."\n');
assert.equal(csv.entries.length, 2);
assert.equal(csv.errors.length, 0);
assert.deepEqual(parseCsv('word,pos\n"broken,n.\n').errors, ['CSV 存在未闭合的双引号']);
assert.equal(parseCsv('word,pos\naccess,\n').errors.length, 1);
const jsonWithoutPos = parseImportContent('bad.json', JSON.stringify([{ word: 'access' }]));
assert.equal(jsonWithoutPos.entries.length, 0);
assert.equal(jsonWithoutPos.errors.length, 1);

// Search behavior.
const searchEntries = [
  { id: '1', word: 'access', normalizedWord: 'access' },
  { id: '2', word: 'accommodate', normalizedWord: 'accommodate' },
  { id: '3', word: 'according to', normalizedWord: 'according to' },
];
assert.equal(fuzzySearch(searchEntries, 'acc', { limit: 10 })[0].word, 'access');
assert.ok(scoreWord('accommodate', 'acommodate') < Infinity);
assert.equal(fuzzySearch(searchEntries, '', { limit: 10 }).length, 0);

// Source and seed invariants.
const sourceOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'AWL', 'AVL'];
const expectedRawCounts = { A1: 901, A2: 872, B1: 809, B2: 1427, C1: 1315, AWL: 549, AVL: 548 };
const parserDuplicates = { A1: 2, A2: 5, B1: 2, B2: 2, C1: 2, AWL: 1, AVL: 0 };
const globalSourceWords = new Map();
for (const name of sourceOrder) {
  const source = read(`data/source/${name}.txt`);
  const parsed = parseImportContent(`${name}.txt`, source);
  assert.equal(parsed.errors.length, 0, `${name} 不应有解析错误`);
  assert.equal(parsed.entries.length, expectedRawCounts[name] - parserDuplicates[name]);
  for (const entry of parsed.entries) {
    const key = normalizeWord(entry.word);
    if (!globalSourceWords.has(key)) globalSourceWords.set(key, { word: entry.word, pos: [...entry.pos] });
    else globalSourceWords.get(key).pos = mergePos(globalSourceWords.get(key).pos, entry.pos);
  }
}
assert.equal(globalSourceWords.size, 5005);

const seed = JSON.parse(read('data/seed.json'));
assert.equal(seed.schemaVersion, 1);
assert.equal(seed.categories.length, 7);
assert.equal(seed.entries.length, 5005);
assert.equal(new Set(seed.entries.map((entry) => entry.normalizedWord)).size, seed.entries.length);
assert.equal(seed.entries.filter((entry) => entry.categoryId === 'cat_avl').length, 0);
assert.equal(seed.entries.filter((entry) => entry.categoryId === 'cat_awl').length, 53);
for (const entry of seed.entries) {
  assert.ok(entry.id && entry.word && entry.normalizedWord);
  assert.ok(seed.categories.some((category) => category.id === entry.categoryId));
  assert.ok(Object.keys(entry.sources).length >= 1);
  assert.ok(entry.pos.length >= 1);
  assert.equal(normalizeWord(entry.word), entry.normalizedWord);
}
assert.equal(validateBackup({ ...seed, pins: [], annotations: [] }), true);
assert.equal(parseImportContent('backup.json', JSON.stringify(seed)).format, 'backup');

// Backup validation rejects inconsistent canonical state instead of importing corruption.
{
  const invalid = clone(seed);
  invalid.entries[0].categoryId = 'cat_avl';
  assert.throws(() => validateBackup(invalid), /归属/);
}
{
  const invalid = clone(seed);
  invalid.entries[0].pos = ['adv.'];
  assert.throws(() => validateBackup(invalid), /显示词性/);
}
{
  const invalid = clone(seed);
  invalid.settings = { ...(invalid.settings ?? {}), numberMode: 'broken' };
  assert.throws(() => validateBackup(invalid), /序号模式/);
}


// Canonical backup normalization is deterministic and rejects structural attack/corruption cases.
{
  const reordered = clone(seed);
  reordered.entries[0].pos = [...reordered.entries[0].pos].reverse();
  for (const source of Object.values(reordered.entries[0].sources)) source.pos = [...source.pos].reverse();
  const canonicalA = canonicalizeBackup({ ...reordered, pins: [], annotations: [], exportedAt: 'fixed' });
  const canonicalB = canonicalizeBackup({ ...canonicalA, exportedAt: 'fixed' });
  assert.deepEqual(canonicalA, canonicalB);
  assert.equal(formatPos(canonicalA.entries[0].pos), formatPos(seed.entries[0].pos));
}
{
  const invalid = clone(seed);
  invalid.categories[0].id = '__proto__';
  assert.throws(() => validateBackup(invalid), /ID 无效/);
}
{
  const invalid = clone(seed);
  const firstSource = Object.keys(invalid.entries[0].sources)[0];
  invalid.entries[0].sources[firstSource].word += 'x';
  assert.throws(() => validateBackup(invalid), /显示词形|来源词形/);
}
{
  const valid = clone(seed);
  valid.annotations = [{
    entryId: valid.entries[0].id,
    categoryId: valid.entries[0].categoryId,
    createdAt: new Date(0).toISOString(),
    spelling: null,
    pos: { incorrect: true, suggestion: [] },
    reason: '词性需要人工核对',
  }];
  assert.equal(validateBackup(valid), true);
  assert.deepEqual(canonicalizeBackup(valid).annotations[0].pos.suggestion, []);
}
{
  const valid = clone(seed);
  const first = valid.entries[0];
  const second = valid.entries[1];
  valid.pins = [
    { id: 'pin_b', entryId: second.id, categoryId: second.categoryId, order: 9, createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'pin_a', entryId: first.id, categoryId: first.categoryId, order: 9, createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  const canonical = canonicalizeBackup(valid);
  const grouped = new Map();
  for (const pin of canonical.pins) {
    if (!grouped.has(pin.categoryId)) grouped.set(pin.categoryId, []);
    grouped.get(pin.categoryId).push(pin.order);
  }
  for (const orders of grouped.values()) assert.deepEqual(orders, orders.map((_, index) => index));
}

{
  const valid = clone(seed);
  valid.categories[0].unexpected = { nested: true };
  valid.entries[0].unexpected = 'drop-me';
  valid.pins = [{
    id: 'pin_missing_time', entryId: valid.entries[0].id, categoryId: valid.entries[0].categoryId, order: 0,
  }];
  const canonical = canonicalizeBackup(valid);
  assert.equal(Object.hasOwn(canonical.categories[0], 'unexpected'), false, '规范化备份必须丢弃未知词表字段');
  assert.equal(Object.hasOwn(canonical.entries.find((item) => item.id === valid.entries[0].id), 'unexpected'), false,
    '规范化备份必须丢弃未知词条字段');
  assert.equal(typeof canonical.pins[0].createdAt, 'string', '缺失的书签时间必须被规范化，避免排序崩溃');
}

// Deterministic category view model: every category and every letter is built from data,
// with no special-case behavior for A1 or for the letter A.
const categoriesById = new Map(seed.categories.map((category) => [category.id, category]));
for (const category of seed.categories) {
  const entries = seed.entries.filter((entry) => entry.categoryId === category.id);
  const model = buildCategoryViewModel(entries);
  const rows = model.sections.flatMap((section) => section.rows);
  assert.equal(rows.length, entries.length, `${category.name} 的视图行数必须等于词条数`);
  assert.equal(new Set(rows.map((row) => row.entry.id)).size, entries.length);
  for (const section of model.sections) {
    assert.equal(section.count, section.rows.length);
    section.rows.forEach((row, index) => {
      assert.equal(groupForWord(row.entry.word), section.letter);
      assert.equal(row.groupIndex, index + 1);
      assert.ok(row.globalIndex >= 1 && row.globalIndex <= entries.length);
    });
  }
  if (entries.length) {
    assert.ok(model.availableLetters.length > 0, `${category.name} 应有可用字母`);
    const first = resolveExpandedLetters({ availableLetters: model.availableLetters });
    assert.deepEqual([...first], [], `${category.name} 普通进入时必须全部收起`);
  }
}
assert.equal(categoriesById.get('cat_a1').name, 'A1');

// Export -> parse round trips preserve every displayed word and merged POS for each category.
for (const category of seed.categories) {
  const owned = seed.entries.filter((entry) => entry.categoryId === category.id);
  const markdownRoundTrip = parseMarkdownOrText(exportCategoryMarkdown(category, owned));
  assert.equal(markdownRoundTrip.errors.length, 0);
  assert.equal(markdownRoundTrip.entries.length, owned.length, `${category.name} Markdown 往返数量不一致`);
  const csvRoundTrip = parseCsv(exportCategoryCsv(owned));
  assert.equal(csvRoundTrip.errors.length, 0);
  assert.equal(csvRoundTrip.entries.length, owned.length, `${category.name} CSV 往返数量不一致`);
  const expected = new Map(owned.map((entry) => [normalizeWord(entry.word), formatPos(entry.pos)]));
  for (const item of markdownRoundTrip.entries) assert.equal(formatPos(item.pos), expected.get(normalizeWord(item.word)));
  for (const item of csvRoundTrip.entries) assert.equal(formatPos(item.pos), expected.get(normalizeWord(item.word)));
}
const seedCanonical = canonicalizeBackup({ ...seed, pins: seed.pins ?? [], annotations: seed.annotations ?? [], exportedAt: 'fixed' });
const reparsedBackup = parseImportContent('roundtrip.json', JSON.stringify(seedCanonical)).backup;
assert.equal(validateBackup(reparsedBackup), true);
assert.deepEqual(canonicalizeBackup(reparsedBackup), seedCanonical);


// Navigation restoration is explicit and never mixes stale A/B state.
const fakeB = { word: 'benefit' };
assert.deepEqual(
  [...resolveExpandedLetters({ previous: ['A'], availableLetters: ['A', 'B'], navigationEntry: fakeB, focusNavigation: true })],
  ['B'],
);
assert.deepEqual(
  [...resolveExpandedLetters({ previous: ['A', 'Z'], availableLetters: ['A', 'B'] })],
  ['A'],
);
assert.deepEqual([...resolveExpandedLetters({ previous: [], availableLetters: [] })], []);
assert.deepEqual(
  [...resolveExpandedLetters({ previous: [], availableLetters: ['A', 'B'], defaultWhenEmpty: false })],
  [],
);

// 50k data model stress invariant.
const stressEntries = Array.from({ length: 50000 }, (_, index) => ({
  id: `stress-${index}`, word: `alpha ${String(index).padStart(5, '0')}`,
  normalizedWord: `alpha ${String(index).padStart(5, '0')}`,
}));
const stressModel = buildCategoryViewModel(stressEntries);
assert.equal(stressModel.sections.length, 1);
assert.equal(stressModel.sections[0].letter, 'A');
assert.equal(stressModel.sections[0].rows.length, 50000);

// HTML, resources, CSP and icon integrity.
const indexHtml = read('index.html');
assert.ok(!/on(?:click|change|input|submit)\s*=/i.test(indexHtml), 'HTML 不应包含内联事件处理器');
assert.ok(indexHtml.includes("script-src 'self'"));
assert.ok(indexHtml.includes('./js/app.js'));
assert.ok(!/user-scalable\s*=\s*no/i.test(indexHtml));
const ids = [...indexHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML id 必须唯一');

const uiText = read('js/ui.js');
const referencedElementIds = new Set([
  ...[...uiText.matchAll(/elements\[['"]([^'"]+)['"]\]/g)].map((match) => match[1]),
  ...[...uiText.matchAll(/elements\.([A-Za-z_$][\w$]*)/g)].map((match) => match[1]),
]);
for (const id of referencedElementIds) assert.ok(ids.includes(id), `ui.js 引用了不存在的 HTML id：${id}`);
assert.ok(!/<details|\.open\s*=|addEventListener\(['"]toggle|currentRenderedGroups/.test(uiText), '不得恢复原生 details/toggle 状态机');
assert.ok(!/getExpandedGroups|saveExpandedGroups/.test(uiText), '展开状态不得跨导航持久化并污染其他渲染');
assert.ok(uiText.includes("summaryButton.className = 'letter-summary'"));
assert.ok(uiText.includes('renderId !== uiState.renderId'));
assert.ok(uiText.includes('uiState.currentRender === context'));
assert.ok(uiText.includes('defaultWhenEmpty: false'), '普通进入和重绘均不得自行展开首字母');
assert.ok(uiText.includes("uiState.searchController?.abort();"), '修改搜索输入时必须取消陈旧 AI 响应');
assert.ok(uiText.includes("elements['ai-add-query'].addEventListener('input'"), 'AI 新增输入变化必须使旧候选失效');
const appendRowsAt = uiText.indexOf('container.replaceChildren(fragment);');
const markPopulatedAt = uiText.indexOf("sectionElement.dataset.populated = '1';");
assert.ok(appendRowsAt >= 0 && markPopulatedAt > appendRowsAt, '只有成功插入词条后才能标记分组已填充');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function/.test(read('js/ui.js')));

const componentsCss = read('css/components.css');
assert.match(componentsCss, /\.mobile-action-bar\s*\{[\s\S]*?display:\s*none;/, '桌面端默认必须隐藏移动操作栏');
assert.match(componentsCss, /\.word-list\[hidden\]\s*\{\s*display:\s*none\s*!important;/);

assert.deepEqual(pngSize('assets/icons/apple-touch-icon.png'), [180, 180]);
assert.deepEqual(pngSize('assets/icons/icon-192.png'), [192, 192]);
assert.deepEqual(pngSize('assets/icons/icon-512.png'), [512, 512]);

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.ok(manifest.icons.every((icon) => icon.src.startsWith('./')));

const swText = read('sw.js');
assert.ok(swText.includes("const CACHE_PREFIX = 'gual-vocabulary-index-'"));
assert.ok(swText.includes('`${CACHE_PREFIX}v2.2.1`'));
assert.ok(swText.includes('./js/category-view-model.js'));
assert.ok(swText.includes('./js/entry-model.js'));
assert.ok(swText.includes("cache: 'no-store'"));
assert.ok(swText.includes('if (response.ok) return response;'));
assert.ok(swText.includes('key.startsWith(CACHE_PREFIX)'), '只能清理本应用命名空间内的旧缓存');
assert.ok(!/caches\.match\(/.test(swText), '缓存回退必须限定到本应用当前缓存，不能跨项目命中');
assert.ok(!/['"]\/(?!\/)/.test(swText), 'Service Worker 不应使用站点根绝对路径');


assert.ok(indexHtml.includes('id="home-export-backup-button"'));
assert.ok(indexHtml.includes('id="home-restore-backup-button"'));
assert.ok(indexHtml.includes('id="home-initialize-seed-button"'));
assert.ok(!/GitHub 私人备份|cloud-sync|latest\.json|Fine-grained|Personal Access Token/i.test(indexHtml));
assert.equal(ids.filter((id) => id === 'ai-check-scope').length, 1, 'AI 核查范围控件不得重复');
assert.ok(uiText.includes("dialog.returnValue = '';"), '确认框每次打开前必须清空旧 returnValue');
assert.ok(uiText.includes('restorePosition: false'), '普通进入词表不得恢复并展开上次位置');
const dbText = read('js/db.js');
const storeText = read('js/store.js');
assert.ok(dbText.includes("'dataRevision'"), 'IndexedDB 写入必须使用全局数据修订号防止多实例旧状态覆盖');
assert.ok(dbText.includes("[...changes.map((change) => change.store), 'settings']"), '无历史写入事务必须包含 settings 以原子更新修订号');
assert.ok(storeText.includes('INSTANCE_CHANNEL_NAME'));
assert.ok(storeText.includes('BroadcastChannel'));
assert.ok(storeText.includes('expectedUpdatedAt'));
assert.ok(storeText.includes('state.settings.dataRevision'));
assert.ok(dbText.includes('purgeRetiredCloudSettings'), '升级到本地稳定版时必须清除旧云状态');
assert.ok(dbText.includes('repairLegacyManualWordSources'), '升级时必须修复旧版人工改名留下的来源词形不一致');
const appText = read('js/app.js');
assert.ok(appText.includes('purgeRetiredCloudStorage'), '升级时必须清除浏览器中遗留的 GitHub Token 与仓库设置');
assert.ok(appText.includes('file.size > MAX_IMPORT_BYTES'), '启动失败恢复入口也必须限制备份文件大小');
assert.ok(!fs.existsSync(path.join(root, 'js/cloud-sync.js')), '本地稳定版不得残留云同步模块');
for (const file of fs.readdirSync(path.join(root, 'js'))) {
  assert.ok(!/github|cloud/i.test(file), `本地稳定版不得残留云功能文件：${file}`);
}
const allRuntimeText = ['index.html', ...fs.readdirSync(path.join(root, 'js')).map((name) => `js/${name}`)]
  .map(read).join('\n');
assert.ok(!/api\.github\.com|GITHUB_TOKEN|cloudBaseRevision|cloudPending|syncTail/.test(allRuntimeText), '运行时代码不得残留云备份耦合');

const requiredFiles = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'data/seed.json',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/responsive.css',
  'js/app.js', 'js/constants.js', 'js/utils.js', 'js/db.js', 'js/store.js',
  'js/search.js', 'js/import-export.js', 'js/ai.js', 'js/ui.js', 'js/category-view-model.js', 'js/entry-model.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
];
for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), `缺少 ${file}`);

// Every local named import must exist in the target module. This directly prevents
// another getExpandedGroups-style runtime ReferenceError.
const moduleFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js'));
const exportMap = new Map();
for (const file of moduleFiles) {
  const text = read(`js/${file}`);
  const names = new Set();
  for (const match of text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of text.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  exportMap.set(file, names);
}
for (const file of moduleFiles) {
  const text = read(`js/${file}`);
  for (const match of text.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/([^'"]+\.js)['"]/g)) {
    const target = match[2];
    const exports = exportMap.get(target);
    assert.ok(exports, `${file} 引用了不存在的模块 ${target}`);
    const imported = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    for (const name of imported) assert.ok(exports.has(name), `${file} 从 ${target} 导入了不存在的 ${name}`);
  }
}

// Syntax-check every executable module.
for (const file of [...moduleFiles.map((name) => `js/${name}`), 'sw.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} 语法检查失败：${result.stderr}`);
}

console.log('All tests passed.');
