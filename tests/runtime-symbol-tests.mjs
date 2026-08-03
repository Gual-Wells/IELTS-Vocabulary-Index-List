import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiPath = path.join(root, 'js', 'v3-ui.js');
const ui = fs.readFileSync(uiPath, 'utf8');

const criticalFunctions = [
  'openDialog',
  'renderAlphabetContent',
  'setLetterSectionOpen',
  'toggleLetterSectionWithAnchor',
  'updateActiveLetter',
  'syncActiveAlphabetHeading',
  'renderEntryRow',
  'switchCollectionMode',
  'bindBrowseAnchorButton',
  'calendarForSection',
];

for (const name of criticalFunctions) {
  const declarations = [...ui.matchAll(new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g'))];
  assert.equal(declarations.length, 1, `${name} 必须且只能定义一次`);
  const references = [...ui.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))];
  assert.ok(references.length >= declarations.length, `${name} 必须可被运行时引用`);
}

const setOpenReferences = [...ui.matchAll(/\bsetLetterSectionOpen\s*\(/g)].length;
const toggleReferences = [...ui.matchAll(/\btoggleLetterSectionWithAnchor\s*\(/g)].length;
assert.ok(setOpenReferences >= 4, 'setLetterSectionOpen 必须连接字母导航、目标展开与标题切换');
assert.ok(toggleReferences >= 2, 'toggleLetterSectionWithAnchor 必须被字母标题点击链调用');
assert.ok(ui.includes("setLetterSectionOpen(section, letter, true);"), '字母导航必须能展开对应分组');
assert.ok(ui.includes("toggleLetterSectionWithAnchor(section, letter, event.currentTarget)"), '字母标题必须绑定展开/收起');

assert.equal((ui.match(/setLastPosition\(/g) || []).length, 1, '浏览锚点只允许长按保存路径写入');
assert.ok(ui.includes("const entryId = firstVisibleEntryId() || '';"), '长按锚点必须保存当前真实可见词条');
assert.ok(ui.includes("className: 'entry-action-placeholder relation-placeholder'"));
assert.ok(ui.includes("pendingJumpReason = validAnchor ? 'mode-anchor' : 'home'"));

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
const tsc = spawnSync('tsc', [
  '--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ES2022',
  '--moduleResolution', 'Bundler', ...jsFiles, '--skipLibCheck', '--lib', 'ES2022,DOM,DOM.Iterable',
], { cwd: root, encoding: 'utf8' });
if (!tsc.error || tsc.error.code !== 'ENOENT') {
  assert.equal(tsc.status, 0, `TypeScript checkJs 未通过：\n${tsc.stdout}${tsc.stderr}`);
}

console.log('runtime-symbol-tests: OK');
