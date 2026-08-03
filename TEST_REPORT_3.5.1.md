# Vocabulary Index 3.5.1 测试报告

## 版本信息

- App version：3.5.1；
- Backup schema：5；
- IndexedDB DB version：4；
- Seed revision：3；
- Service Worker cache：`v3.5.1-ios-shell-20260803-2`。

## 自动化范围

- 模型和 Schema；
- Seed 完整性；
- 范围搜索；
- VIX 和备份交换；
- AI、PIN、学习日期与投影；
- 3.5.1 静态契约：Dialog Shell、手动浏览锚点、模式切换、字母警戒区、一级表项元信息、日历年／月按钮；
- 压力、集成和 Node 环境性能。

## 真机边界

自动化不能证明：

- iOS Native Dialog 的完整视觉居中和底部遮罩；
- 长按锚点是否与 Safari 系统手势冲突；
- 字母栏在惯性滚动中的最终观感；
- 超长释义与来源标签在实际字体下的空间；
- 日历五按钮在最窄设备上的视觉比例。

最终实测结果应补充到 `tests/MANUAL_CHECKLIST.md`。

## 最终自动化结果

在完整包工作副本中分别执行：

- `node tests/run-tests.mjs`：通过；
- `node tests/static-tests.mjs`：通过；
- `node tests/stress-tests.mjs`：通过（126 entries、156 memberships、45 study stamps）；
- `node tests/integration-tests.mjs`：通过（最大测试 URL 30,636 字符）；
- `node tests/performance-tests.mjs`：通过。

本次性能结果：

- 25 次搜索：26.5 ms；
- 词表导入预检：2,856.7 ms。

同时完成：

- 17 个 JavaScript／ES Module 文件语法检查；
- 13 个 JSON 文件解析；
- 4 个 CSS 文件完整解析。

以上结果仍不能替代 iPhone Safari／主屏幕 PWA 真机验收。
