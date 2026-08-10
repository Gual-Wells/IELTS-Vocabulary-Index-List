# Vocabulary Index 4.6.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.6.0 不改变 4.0 内容世代，也不重新设计 4.5 已基本通过真机验收的 Navigation Automaton；本版集中校正 Scroll / Position / Virtual Layout / Visual Commit ownership。

## 当前世代

- App：`4.6.0`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX JSON：`2`
- Navigation：`destructive-v3`（冻结）
- Virtual chunk：42 Entry / 960px prefetch（4.6 首版冻结为 tuning parameter）

## 4.6 Runtime

- `js/v3-scroll-runtime.js`：DOM-free ScrollCoordinator / geometry helpers。
- `js/v3-ui.js`：唯一 root-scroll adapter、semantic position、measured virtual geometry、Letter flow-anchor、Back semantic verify、Search snapshot hygiene。
- `js/v3-navigation-runtime.js`：4.5 browser-key logical stack，4.6 不改语义。
- `js/v3-runtime-geometry.js`：4.4 Sticky collapse pure geometry，4.6 只接 coordinator lease。
- `sw.js`：首次 claim 不 reload；显式 update 才 reload。

## 架构原则

1. One Root Scroll Owner：只有 ScrollCoordinator adapter 可以移动根 viewport。
2. One Geometry Truth：Sticky/Letter/Back/Entry positioning 共用 ContentTop。
3. One Semantic Position：Entry/Section identity + offset/bottomGap 是 frame 阅读位置真值，`scrollY` 只是 fallback。
4. DOM 可以虚拟，位置不能虚拟：42 Chunk 只 materialize/measure，不拥有 viewport。

## 生命周期文档

当前约束与实现以以下 4.6 文件为准：

- `REQUIREMENT_BASELINE_4.6.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.6.0.md`
- `UX_SPEC_4.6.0.md`
- `PRODUCT_MANUAL_4.6.0.md`
- `AUDIT_REPORT_4.6.0.md`
- `TECHNICAL_RESEARCH_4.6.0.md`
- `CHANGE_REPORT_4.6.0.md`
- `TEST_REPORT_4.6.0.md`
- `MIGRATION_4.6.0.md`
- `tests/IPHONE_REDUCED_TESTS_4.6.0.md`

历史版本文档保留为生命周期事实，不应回写为当前实现。
