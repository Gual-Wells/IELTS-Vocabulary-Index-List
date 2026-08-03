# Vocabulary Index 3.5.1 测试报告

## 测试对象

- App version：3.5.1
- 代码基线：3.5.0 清洁解压副本
- Backup Schema：5
- IndexedDB version：4
- Seed revision：3
- VIX version：1

## 新增防截断测试

`tests/runtime-symbol-tests.mjs` 检查核心运行时函数各定义一次，并验证字母导航、标题点击和目标展开仍连接到完整链路。特别覆盖：

- `setLetterSectionOpen`
- `toggleLetterSectionWithAnchor`
- `renderAlphabetContent`
- `updateActiveLetter`
- `syncActiveAlphabetHeading`
- `switchCollectionMode`
- `bindBrowseAnchorButton`
- `calendarForSection`

同时使用 TypeScript `checkJs` 检查全部 `js/*.js` 的未定义名称。该检查用于阻止两份已撤回 3.5.1 中“函数调用存在但定义被截断”的事故再次发生。

## 合成布局契约

`tests/layout-contract-check.py` 使用 Chromium 布局引擎和 320／375／390px 视口，加载实际四层 CSS 并检查：

- Dialog 卡片不越界；
- 标题物理中心误差在阈值内；
- 输入框受 Body 宽度约束；
- 释义与英文左边缘对齐；
- 释义、来源、二者同时存在的表项高度一致；
- 来源位于表项边界内的右下区域；
- 五段日历标题不超出视口。

## 自动测试结果

各套件以独立进程执行并通过：

```text
run-tests: OK
static-tests: OK
runtime-symbol-tests: OK
stress-tests: OK (126 entries, 156 memberships, 45 study stamps)
integration-tests: OK (largest tested URL 30636 chars)
performance-tests: OK (27.7 ms / 25 searches; 2509.9 ms collection preflight)
layout-contract-check: OK
```

语法与格式：

```text
node --check：通过
TypeScript checkJs（全部 js/*.js）：通过
JSON parse：通过（13 项）
CSS parse：通过（4 项）
```

当前容器中将多套长测试串入同一 Shell 命令会触发外层命令时限，因此验收证据采用每套测试独立启动、独立完成。`npm run test:all` 仍保留；`test:layout` 独立运行，以避免用户环境未安装 Playwright 时阻断基础测试。

## 测试边界

当前执行环境禁止 Chromium 直接导航本地 HTTP／file 页面，因此合成布局测试采用 `page.set_content`，没有声称完成整个 PWA 的真实浏览器端到端运行。真实 iPhone standalone PWA 仍必须按 `tests/MANUAL_CHECKLIST.md` 验收。
