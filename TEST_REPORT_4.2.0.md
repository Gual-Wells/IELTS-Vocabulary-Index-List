# Vocabulary Index 4.2.0 测试报告

## 结论

4.2.0 工作树自动化测试通过。自动化验证源码、数据、运行时符号、压力、集成、性能与 402×874 布局契约；**不等同于 iPhone 17 主屏幕 PWA 真机验收**。真机项目见 `tests/MANUAL_CHECKLIST.md`。

## 自动化结果

执行：`npm run test:all`

- `run-tests`: PASS — 6176 Seed Entries；1240 Relation Components。
- `static-tests`: PASS — 27 个 Service Worker precache resources。
- `runtime-symbol-tests`: PASS。
- `stress-tests`: PASS — 125 Entries；158 Memberships；31 Relation Components。
- `integration-tests`: PASS — 最大 ChatGPT Shortcut URL 8042 chars（data case）。
- `performance-tests`: PASS — 25 次 Search 27.4ms；Relations 6.2ms；VIX preflight 2646.0ms。
- `layout-contract-check`: PASS — 402×874。

附加校验：

- `node --check`：全部 `js/*.js`、`tests/*.mjs`、`tools/*.mjs` PASS。
- JSON/WebManifest parse：16 个文件 PASS。
- `data/seed.json` SHA-256：`a2a1c5ba78c67fcaa8bf6b9d5f83f4155f31e7014285c8589038759dd84bfc84`（与 4.1.0/4.0.x 同世代一致）。
- `data/relation-low-level-lexemes.json` SHA-256：`962a20764af2112f2d8a70bb1aa929fd06987aefa742699fef1956f905b2e335`。
- `data/vix-json.schema.json` SHA-256：`82a2de2ee1b599b139578002ef2e7e636b8066f67d8e839859963eedac253eb4`。
- 4.1.0 正式基线 ZIP SHA-256：`7d5b96a833ebe9a88552077f7dde4b193e3e883261c241e0c0cd8a27ee60ab18`。

## 4.2.0 专项覆盖

1. `sticky-letter-heading` DOM/renderer 从当前 runtime 删除；`.letter-heading` 恢复 native `position: sticky`，`top` 继续消费统一 `--content-sticky-top`。
2. Alphabet metrics/ResizeObserver/二分查找仍存在，但只负责 active letter；没有第二套视觉 Sticky renderer。
3. 字母/日期收起继续共用真实 heading anchor + `overflow-anchor:none` 补偿路径。
4. Root Home：新增独立按钮、depth>=2 可见、`history.go(-appNavigationDepth)`、`navigationEpoch`、旧 snapshot 失效和临时 expanded state 清理；Back aria-label 与 Home 语义分开。
5. Query chooser：relation-style `sourceRect.right - menuRect.width - 10`，edge inset 12px，vertical gap 13px。
6. Oxford 新 closed-book SVG optical bounds 收敛到与另外三枚 Provider 相近范围。
7. 4.1.0 `compositeShellSurface/syncSystemShellSurface` runtime 移除；custom/native backdrop 恢复 full Web viewport。
8. Home Product Wordmark、Global 15px/740 heading、Index Rule、parallel switch/管理顺序均有静态/layout 覆盖。
9. 日期 StudyStamp 原位刷新、Entry secondary Y、字母 cell-owned border、PWA name、`全局非结构总表`继续回归。

## 真机未替代项

必须在目标 iPhone 17 standalone 环境继续验证：

- native alphabet sticky 的 collapsed 自然退出、section-bottom push-off、快速 fling/rubber-band；
- 点吸顶字母 heading 收起后保持在字母栏正下方；
- global/domain/normal + word/phrase/content 全视图；
- Query/Oxford 最终视觉；
- Root Home 的 iOS History/forward 手势行为；
- Home wordmark/Global Index Rule 视觉；
- modal 真实 backdrop 的 depth 1/2 和 iOS system strip 平台边界；
- 日期刷新原位、Entry secondary gap、PWA 安装名等保留项。

## 正式 ZIP 全新解压复验

正式封装流程会在 `SHA256SUMS.txt` 生成后重新打包到全新目录，先执行 `sha256sum -c SHA256SUMS.txt`，再重复完整测试链。最终发布验证结果同时写入包外 `Vocabulary-Index-4.2.0-Release-Verification.txt`；只有该步骤通过的 ZIP 才作为正式交付。
