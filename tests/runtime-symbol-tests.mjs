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
  'showModalStable',
  'renderAlphabetContent',
  'renderDateContent',
  'setLetterSectionOpen',
  'toggleLetterSectionWithAnchor',
  'setDateSectionOpen',
  'toggleDateSectionWithAnchor',
  'updateActiveLetter',
  'syncActiveAlphabetHeading',
  'renderEntryRow',
  'switchCollectionView',
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

const setLetterOpenReferences = [...ui.matchAll(/\bsetLetterSectionOpen\s*\(/g)].length;
const toggleLetterReferences = [...ui.matchAll(/\btoggleLetterSectionWithAnchor\s*\(/g)].length;
const setDateOpenReferences = [...ui.matchAll(/\bsetDateSectionOpen\s*\(/g)].length;
const toggleDateReferences = [...ui.matchAll(/\btoggleDateSectionWithAnchor\s*\(/g)].length;
assert.ok(setLetterOpenReferences >= 4, 'setLetterSectionOpen 必须连接字母导航、目标展开与标题切换');
assert.ok(toggleLetterReferences >= 2, 'toggleLetterSectionWithAnchor 必须被字母标题点击链调用');
assert.ok(setDateOpenReferences >= 4, 'setDateSectionOpen 必须连接日历、目标展开与标题切换');
assert.ok(toggleDateReferences >= 3, '日期和未标注标题必须绑定展开/收起');
assert.ok(ui.includes("setLetterSectionOpen(section, letter, true);"), '字母导航必须能展开对应分组');
assert.ok(ui.includes("toggleLetterSectionWithAnchor(section, letter, event.currentTarget)"), '字母标题必须绑定展开/收起');
assert.ok(ui.includes("toggleDateSectionWithAnchor(section, dateKey, event.currentTarget)"), '日期标题必须绑定展开/收起');
assert.ok(ui.includes("toggleDateSectionWithAnchor(section, 'unmarked', event.currentTarget)"), '未标注标题必须绑定展开/收起');

assert.equal((ui.match(/setLastPosition\(/g) || []).length, 1, '浏览锚点只允许长按保存路径写入');
assert.ok(ui.includes("const entryId = firstVisibleEntryId() || '';"), '长按锚点必须保存当前真实可见词条');
assert.ok(ui.includes('window.getSelection?.()?.removeAllRanges()'), '长按完成后必须清理 iOS 文本选择');
assert.ok(ui.includes("className: 'entry-action-placeholder relation-placeholder'"));
assert.ok(ui.includes("pendingJumpReason = 'home';"), '普通模式/视图切换必须初始化到顶部');
assert.ok(!ui.includes("pendingJumpReason = validAnchor ? 'mode-anchor' : 'home'"), '不得保留模式间 Entry 映射');
assert.ok(!ui.includes('viewStateSnapshots'), '不得保留目标视图旧状态缓存');
assert.ok(ui.includes('expandedGroups: [...expandedLettersFor'), '返回快照必须保存当前页展开组');
assert.ok(ui.includes("calendarMonth: mode === 'date'"), '返回快照必须保存日期月份');
assert.ok(ui.includes('manualLocked: false'), '字母轨道必须具有人工横滑锁定状态');
assert.ok(ui.includes('allowManualRelease: Boolean(activeChanged || stickyBoundaryNewlyEngaged)'), '只有活动字母变化或标题首次进入真实 sticky 边界后才允许自动接管字母轨道');
assert.ok(ui.includes('stickyBoundaryNewlyEngaged'), '标题首次抵达真实 sticky 边界时必须能够释放人工锁');
assert.ok(!ui.includes('scheduleLetterTrackSync(205)'), '不得再用固定延迟恢复自动跟随');
assert.ok(ui.includes("className: `entry-control-stack${sourceDomainLabel ? ' has-source' : ''}`"));
assert.ok(!ui.includes('entry-gloss-placeholder'), '独立域来源不得通过伪繁体占位扩张左侧');

const jsFiles = fs.readdirSync(path.join(root, 'js')).filter((name) => name.endsWith('.js')).map((name) => `js/${name}`);
const tsc = spawnSync('tsc', [
  '--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ES2022',
  '--moduleResolution', 'Bundler', ...jsFiles, '--skipLibCheck', '--lib', 'ES2022,DOM,DOM.Iterable',
], { cwd: root, encoding: 'utf8' });
if (!tsc.error || tsc.error.code !== 'ENOENT') {
  assert.equal(tsc.status, 0, `TypeScript checkJs 未通过：\n${tsc.stdout}${tsc.stderr}`);
}

console.log('runtime-symbol-tests: OK');
