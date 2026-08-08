# Vocabulary Index 4.1.0 测试报告

## 结论

4.1.0 最终工作树自动化测试通过。自动化用于验证源码、数据、运行时符号、压力、集成、性能与 402×874 布局契约；**不等同于 iPhone 17 主屏幕 PWA 真机验收**。真机项目见 `tests/MANUAL_CHECKLIST.md`。

## 自动化结果

执行：`npm run test:all`

- `run-tests`: PASS — 6176 Seed Entries；1240 Relation Components。
- `static-tests`: PASS — 26 个 Service Worker precache resources。
- `runtime-symbol-tests`: PASS。
- `stress-tests`: PASS — 125 Entries；158 Memberships；31 Relation Components。
- `integration-tests`: PASS — 最大 ChatGPT Shortcut URL 8042 chars（data case）。
- `performance-tests`: PASS — 25 次 Search 26.7ms；Relations 6.1ms；VIX preflight 2910.1ms。
- `layout-contract-check`: PASS — 402×874。

附加校验：

- `node --check`：全部 `js/*.js`、`tests/*.mjs`、`tools/*.mjs` PASS。
- JSON/WebManifest parse：16 个文件 PASS。
- `data/seed.json` 与 4.0.2 baseline SHA-256 相同：`a2a1c5ba78c67fcaa8bf6b9d5f83f4155f31e7014285c8589038759dd84bfc84`。
- `data/relation-low-level-lexemes.json` 与 4.0.2 baseline SHA-256 相同：`962a20764af2112f2d8a70bb1aa929fd06987aefa742699fef1956f905b2e335`。
- `data/vix-json.schema.json` 与 4.0.2 baseline SHA-256 相同：`82a2de2ee1b599b139578002ef2e7e636b8066f67d8e839859963eedac253eb4`。

## 4.1.0 专项覆盖

1. Top Chrome 不再使用 `visualViewport.offsetTop + 72` 硬下限；字母栏 attached 后才 engage alphabet sticky mirror。
2. alphabet cell：top/right/bottom + first-child left；disabled/empty 不再整体 opacity 灰化结构线。
3. 字母 Sticky mirror 有不透明背景与结构边界。
4. 日期 StudyStamp 刷新保持原 scrollY，不设置 `study-date` jump reason。
5. Query chooser 有 viewport edge inset；Oxford 使用用户参考图几何重绘的闭合书本 SVG。
6. Entry secondary line 左右共用 2px bottom metric 与 10px secondary padding。
7. Home switch 为上→/下←平行开放箭头，位于“管理”左侧；Home topbar/PWA 名称统一 `Vocabulary Index`，大字“词汇索引”保留。
8. `全局非结构总表` 仅更新显示名，稳定 ID 不变。
9. System Shell Surface Controller 按实际 Modal 层累计 48% / 20% alpha，统一 `theme-color` / root / fixed topbar；真实 backdrop 从实测 topbar bottom 以下开始，避免 topbar 二次蒙版。

## 真机未替代项

必须在 iPhone 17 标准版、iOS WebKit、Home Screen standalone 环境继续验证：

- alphabet/date 顶部零镂空与 fling/rubber-band；
- global/domain/normal + word/phrase/content Sticky；
- 字母按钮边框连续性和 disabled `#`；
- Query 右边距及 Oxford 实际视觉；
- Entry row 视觉密度；
- PWA 重装后的 `Vocabulary Index` 名称；
- retained Modal depth 1/2 的 topbar/system tint；
- 若最顶部 system strip 不随动态 tint，记录 viewport 指标后判定 WebKit 平台边界，而不是把自动化结果称为真机通过。
