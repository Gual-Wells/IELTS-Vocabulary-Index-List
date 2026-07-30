import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPos, groupForWord, mergePos, normalizeWord, parsePos } from '../js/utils.js';
import { parseCsv, parseImportContent, parseMarkdownOrText, validateBackup } from '../js/import-export.js';
import { fuzzySearch, scoreWord } from '../js/search.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');

assert.equal(normalizeWord('  Can’t   wait  '), "can't wait");
assert.equal(groupForWord('apple'), 'A');
assert.equal(groupForWord(' according to'), 'A');
assert.equal(groupForWord('123'), '#');
assert.deepEqual(parsePos('n., v., noun'), ['n.', 'v.']);
assert.deepEqual(parsePos('det./pron./adv.'), ['adv.', 'pron.', 'det.']);
assert.equal(formatPos(mergePos(['v.'], ['n.', 'v.'])), 'n., v.');

const md = parseMarkdownOrText('# Demo\n## A\naccess n., v.\naccess v.\naccording to prep.\n');
assert.equal(md.errors.length, 0);
assert.equal(md.entries.length, 2);
assert.equal(formatPos(md.entries.find((item) => item.word === 'access').pos), 'n., v.');

const csv = parseCsv('word,pos\n"access","n., v."\n"according to","prep."\n');
assert.equal(csv.entries.length, 2);
assert.equal(csv.errors.length, 0);

const invalidCsv = parseCsv('word,pos\naccess,\n');
assert.equal(invalidCsv.entries.length, 0);
assert.equal(invalidCsv.errors.length, 1);

const entries = [
  { id: '1', word: 'access', normalizedWord: 'access' },
  { id: '2', word: 'accommodate', normalizedWord: 'accommodate' },
  { id: '3', word: 'according to', normalizedWord: 'according to' },
];
assert.equal(fuzzySearch(entries, 'acc', { limit: 10 })[0].word, 'access');
assert.ok(scoreWord('accommodate', 'acommodate') < Infinity);


const sourceOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'AWL', 'AVL'];
const expectedSourceCounts = { A1: 901, A2: 872, B1: 809, B2: 1427, C1: 1315, AWL: 549, AVL: 548 };
const globalSourceWords = new Map();
for (const name of sourceOrder) {
  const source = fs.readFileSync(path.join(root, 'data/source', `${name}.txt`), 'utf8');
  const parsed = parseImportContent(`${name}.txt`, source);
  assert.equal(parsed.errors.length, 0, `${name} 不应有解析错误`);
  assert.equal(parsed.entries.length, expectedSourceCounts[name] - ({ A1: 2, A2: 5, B1: 2, B2: 2, C1: 2, AWL: 1, AVL: 0 }[name] ?? 0));
  for (const entry of parsed.entries) {
    const key = normalizeWord(entry.word);
    if (!globalSourceWords.has(key)) globalSourceWords.set(key, { word: entry.word, pos: [...entry.pos] });
    else globalSourceWords.get(key).pos = mergePos(globalSourceWords.get(key).pos, entry.pos);
  }
}
assert.equal(globalSourceWords.size, 5005);

const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
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
validateBackup({ ...seed, pins: [], annotations: [] });

const parsedBackup = parseImportContent('backup.json', JSON.stringify(seed));
assert.equal(parsedBackup.format, 'backup');
assert.ok(parsedBackup.backup);

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(!/onclick\s*=|onchange\s*=|oninput\s*=/i.test(indexHtml), 'HTML 不应包含内联事件处理器');
assert.ok(indexHtml.includes("script-src 'self'"));
assert.ok(indexHtml.includes('./js/app.js'));


const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
const swText = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.ok(!/['"]\/(?!\/)/.test(swText), 'Service Worker 不应使用站点根绝对路径');

const requiredFiles = [
  'index.html', 'manifest.webmanifest', 'sw.js', 'data/seed.json',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/responsive.css',
  'js/app.js', 'js/db.js', 'js/store.js', 'js/ui.js', 'js/ai.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png',
];
for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), `缺少 ${file}`);

console.log('All tests passed.');
