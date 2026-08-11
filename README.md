# Vocabulary Index 4.7.2

Vocabulary Index 是仅面向 **iPhone 17 / iOS 26.5.x Home Screen standalone PWA** 的本地英语学习索引。4.7.2 不改变 4.0 内容世代；本版在 4.7.1 Buffered State Commit 基础上修复 **Switch Action Contract 回归、Same-Collection 双 semantic commit 与 busy-time 输入丢失**。

## 当前世代

- App：`4.7.2`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX JSON：`2`
- Navigation：`single-slot-vix-v1`（相对4.6 `destructive-v3`为独立待决架构差异）
- Virtual chunk：42 Entry / 960px prefetch

## 4.7.2 Runtime

- `js/v3-motion-runtime.js`：DOM-free semantic axis、easing/duration、safe-zone LetterRail camera primitive。
- `js/v3-scroll-runtime.js`：ScrollCoordinator / root-scroll geometry helpers。
- `js/v3-ui.js`：VIX recursive stack、Push/Pop、Buffered State Commit、Root Buffer、**4.6-compatible manual switch semantics**、presentation intent queue、single semantic Entry target、discrete LetterRail、retained Modal/Relation lifecycle。
- `js/v3-runtime-geometry.js`：4.4 Sticky collapse pure geometry；仍只经 ScrollCoordinator lease。
- `css/v4.7.0.css`：4.7 历史 motion 基础层。
- `css/v4.7.1.css`：Pop retiming、Letter active、transparent backdrop、Modal retiming/`@starting-style` corrective layer。
- `css/v4.7.2.css`：runtime-only release marker；无新增视觉参数。
- `js/v3-navigation-runtime.js`：4.5/4.6 历史源码，不由 active runtime import/precache。

## 当前架构原则

1. **One Browser Slot**：当前4.7.x实现中 Safari 不保存 VIX 内部 recursive pages；该选择不宣称等价于4.6历史导航合同。
2. **VIX Owns Navigation**：Back POP / Home clear 由 runtime stack 完成。
3. **One Root Scroll Owner**：只有 ScrollCoordinator adapter 可移动 root viewport。
4. **Semantic Motion Gate**：只有真实空间/层级/局部来源关系才使用运动。
5. **Semantic Contract Owns Result**：切换完成态由产品合同决定；Presentation wrapper不得重新定义 target。
6. **Manual Switch = TOP + Collapsed**：Word/Phrase、Alphabet/Date恢复4.6完成态；不保持transient letter/date邻域。
7. **Buffered State Commit**：上述切换仍使用 `old → hidden commit → new`，禁止 old/new overlap。
8. **One Semantic Position per Target**：Same-Collection精确 Entry target只执行一次 authoritative landing。
9. **Serialized Presentation Intent**：Collection/Back/Home/View/Mode不因busy flag静默丢输入；View/Mode toggle在执行时求值。
10. **Alphabet Semantic Axis**：真实 flow-anchor 决定物理位置，相邻逻辑字母等权；作为内部定位数学模型保留。
11. **Discrete LetterRail**：唯一 active cell + safe-zone camera；无 continuous locus / raw velocity chase。
12. **Date Calendar Query-Only**：Calendar 不承担动态阅读 rail。
13. **DOM 可以虚拟，位置不能虚拟**：42 Chunk 只 materialize/measure，不拥有 viewport。
14. **Reduced Motion 是统一 runtime policy**：CSS motion与JS semantic scroll/camera同时降级。

## 生命周期文档

当前权威约束：

- `REQUIREMENT_BASELINE_4.7.2.md`
- `SEMANTIC_IMPACT_MATRIX_4.7.2.md`
- `UX_SPEC_4.7.2.md`
- `PRODUCT_MANUAL_4.7.2.md`
- `AUDIT_REPORT_4.7.2.md`
- `TECHNICAL_RESEARCH_4.7.2.md`
- `CHANGE_REPORT_4.7.2.md`
- `TEST_REPORT_4.7.2.md`
- `MIGRATION_4.7.2.md`
- `tests/IPHONE_REDUCED_TESTS_4.7.2.md`

历史版本文档保留为生命周期事实，不回写成当前行为。4.7.1 的 transient-neighborhood switch 规范已被4.7.2明确覆盖。
