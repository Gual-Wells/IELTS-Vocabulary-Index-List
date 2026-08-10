# Vocabulary Index 4.7.1

Vocabulary Index 是仅面向 **iPhone 17 / iOS 26.5.x Home Screen standalone PWA** 的本地英语学习索引。4.7.1 不改变 4.0 内容世代；本版在 4.7.0 Single-Slot Navigation / Semantic Motion 基础上完成 **Semantic Motion Gate + Buffered State Commit + Discrete LetterRail** 修订。

## 当前世代

- App：`4.7.1`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX JSON：`2`
- Navigation：`single-slot-vix-v1`
- Virtual chunk：42 Entry / 960px prefetch

## 4.7.1 Runtime

- `js/v3-motion-runtime.js`：DOM-free semantic axis、easing/duration、safe-zone LetterRail camera primitive。
- `js/v3-scroll-runtime.js`：ScrollCoordinator / root-scroll geometry helpers。
- `js/v3-ui.js`：VIX recursive stack、Push/Pop、Buffered State Commit、Root Buffer、transient semantic anchor、target prewarm、discrete LetterRail、retained Modal/Relation lifecycle。
- `js/v3-runtime-geometry.js`：4.4 Sticky collapse pure geometry；仍只经 ScrollCoordinator lease。
- `css/v4.7.0.css`：4.7 历史 motion 基础层。
- `css/v4.7.1.css`：Pop retiming、Letter active、transparent backdrop、Modal retiming/`@starting-style` corrective layer。
- `js/v3-navigation-runtime.js`：4.5/4.6 历史源码，不由 active runtime import/precache。

## 当前架构原则

1. **One Browser Slot**：Safari 不保存 VIX 内部 recursive pages。
2. **VIX Owns Navigation**：Back POP / Home clear 由 runtime stack 完成。
3. **One Root Scroll Owner**：只有 ScrollCoordinator adapter 可移动 root viewport。
4. **Semantic Motion Gate**：只有真实空间/层级/局部来源关系才使用运动。
5. **Buffered State Commit**：Word/Phrase、Alphabet/Date、Home global switch 使用 `old → hidden commit → new`，禁止 old/new overlap。
6. **Transient Semantic Anchor**：切换保持本次阅读邻域，但不维护四份 hidden page history。
7. **Prepare Before Visible**：目标 DOM/Chunk/geometry/anchor 在隐藏窗口稳定后再 reveal。
8. **Alphabet Semantic Axis**：真实 flow-anchor 决定物理位置，相邻逻辑字母等权；作为内部定位数学模型保留。
9. **Discrete LetterRail**：唯一 active cell + safe-zone camera；无 continuous 52px locus / raw velocity chase。
10. **Date Calendar Query-Only**：Calendar 不承担动态阅读 rail。
11. **DOM 可以虚拟，位置不能虚拟**：42 Chunk 只 materialize/measure，不拥有 viewport。
12. **Reduced Motion 是统一 runtime policy**：CSS motion与JS semantic scroll/camera同时降级。

## 生命周期文档

当前权威约束：

- `REQUIREMENT_BASELINE_4.7.1.md`
- `SEMANTIC_IMPACT_MATRIX_4.7.1.md`
- `UX_SPEC_4.7.1.md`
- `PRODUCT_MANUAL_4.7.1.md`
- `AUDIT_REPORT_4.7.1.md`
- `TECHNICAL_RESEARCH_4.7.1.md`
- `CHANGE_REPORT_4.7.1.md`
- `TEST_REPORT_4.7.1.md`
- `MIGRATION_4.7.1.md`
- `tests/IPHONE_REDUCED_TESTS_4.7.1.md`

历史版本文档保留为生命周期事实，不回写成当前行为。
