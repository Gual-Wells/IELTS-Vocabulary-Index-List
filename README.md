# Vocabulary Index 4.7.0

Vocabulary Index 是仅面向 **iPhone 17 / iOS 26.5.x Home Screen standalone PWA** 的本地英语学习索引。4.7.0 不改变 4.0 内容世代；本版把 4.6 已建立的 Scroll/Semantic Position/Virtual Layout ownership 升级为 **Single-Slot Navigation + Semantic Motion + Continuous LetterRail**。

## 当前世代

- App：`4.7.0`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX JSON：`2`
- Navigation：`single-slot-vix-v1`
- Virtual chunk：42 Entry / 960px prefetch（继续作为 tuning parameter）

## 4.7 Runtime

- `js/v3-motion-runtime.js`：DOM-free semantic axis、easing、duration、LetterRail camera primitives。
- `js/v3-scroll-runtime.js`：ScrollCoordinator / root-scroll geometry helpers。
- `js/v3-ui.js`：VIX recursive stack、single browser slot、semantic page/scroll motion、target prewarm、current-page-only state、continuous LetterRail。
- `js/v3-runtime-geometry.js`：4.4 Sticky collapse pure geometry；仍只经 ScrollCoordinator lease。
- `css/v4.7.0.css`：Push/Pop/Home/Sibling/Reindex、Letter locus、Modal spring presentation。
- `js/v3-navigation-runtime.js`：保留为 4.5/4.6 历史源码，不再由 4.7 active runtime import/precache。

## 当前架构原则

1. **One Browser Slot**：Safari 不再保存 VIX 内部 recursive pages。
2. **VIX Owns Navigation**：Back POP / Home clear 全部由 runtime stack 完成。
3. **One Root Scroll Owner**：只有 ScrollCoordinator adapter 可移动 root viewport。
4. **Semantic Motion**：运动类型由行为语义决定，不用统一 fade 伪装。
5. **Prepare Before Motion**：目标 DOM/Chunk/geometry 先稳定，再开始可见运动。
6. **Alphabet Semantic Axis**：真实 flow-anchor 决定物理位置，相邻逻辑字母等权。
7. **LetterRail One-Way Sync**：页面驱动自动跟随；手动横拖不动页面并保持到下一次页面运动。
8. **Current Page Only**：普通 View/Mode 切换 TOP+collapsed；只有 Back 恢复离开页快照。
9. **Date Calendar Query-Only**：Calendar 不承担 LetterNav 式动态阅读跟随。
10. **DOM 可以虚拟，位置不能虚拟**：42 Chunk 只 materialize/measure，不拥有 viewport。

## 生命周期文档

当前权威约束：

- `REQUIREMENT_BASELINE_4.7.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.7.0.md`
- `UX_SPEC_4.7.0.md`
- `PRODUCT_MANUAL_4.7.0.md`
- `AUDIT_REPORT_4.7.0.md`
- `TECHNICAL_RESEARCH_4.7.0.md`
- `CHANGE_REPORT_4.7.0.md`
- `TEST_REPORT_4.7.0.md`
- `MIGRATION_4.7.0.md`
- `tests/IPHONE_REDUCED_TESTS_4.7.0.md`

历史版本文档保留为生命周期事实，不回写成当前行为。
