# Vocabulary Index 4.7.3

Vocabulary Index 是仅面向 **iPhone 17 / iOS 26.5.x Home Screen standalone PWA** 的本地英语学习索引。4.7.3 不改变 4.0 内容世代；本版修正 4.7.2 真机暴露的 **opacity-blink Presentation、Relation Row 重建闪烁与 VirtualEntryList 单向 materialization resident-set 回归**。

## 当前世代

- App：`4.7.3`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX JSON：`2`
- Navigation：`single-slot-vix-v1`（4.7.x 已继承现行架构）
- Virtual chunk：42 Entry / 960px prefetch + dynamic park resident window

## 4.7.3 Runtime

- `js/v3-motion-runtime.js`：DOM-free semantic axis、easing/duration、safe-zone LetterRail camera primitive。
- `js/v3-scroll-runtime.js`：ScrollCoordinator / root-scroll geometry helpers。
- `js/v3-ui.js`：VIX recursive stack、Push/Pop、**Atomic Visual Commit**、Root Commit、4.6-compatible manual switch semantics、presentation intent queue、single semantic Entry target、Stable Relation Row、双向 VirtualEntryList lifecycle、discrete LetterRail、retained Modal。
- `js/v3-runtime-geometry.js`：4.4 Sticky collapse pure geometry；仍只经 ScrollCoordinator lease。
- `css/v4.7.0.css`：4.7 历史 motion 基础层。
- `css/v4.7.1.css`：Pop retiming、Letter active、transparent backdrop、Modal corrective layer。
- `css/v4.7.2.css`：4.7.2 runtime marker。
- `css/v4.7.3.css`：Relation slot reveal与parked chunk lifecycle样式。
- `js/v3-navigation-runtime.js`：4.5/4.6历史源码，不由active runtime import/precache。

## 当前架构原则

1. **One Browser Slot / VIX Owns Navigation**：Safari不保存内部recursive pages；Back POP/Home clear由VIX runtime stack完成。
2. **One Root Scroll Owner**：只有ScrollCoordinator adapter可移动root viewport。
3. **Semantic Contract Owns Result**：Word/Phrase、Alphabet/Date完成态继续TOP+collapsed；Presentation不得改写target。
4. **Atomic Visual Commit First**：无运动语义状态变化优先在一个paint前提交，禁止把大型文字面fade-to-zero当Buffer。
5. **One Semantic Position per Target**：same-Collection精确Entry target只执行一次authoritative landing。
6. **Stable Object Identity**：Relation展开保持Entry Row shell，动态变化只发生在child slot。
7. **Product State ≠ DOM Lifetime**：expanded letter/relation可长期存在，远端Entry-row DOM可以park并按需恢复。
8. **Bounded Virtual Resident Set**：42/960 lazy path保留；远端measured chunk退休为等高placeholder，programmatic scroll与scrollend持续sweep。
9. **Discrete LetterRail**：唯一active cell + safe-zone camera；无continuous locus/raw velocity chase。
10. **Reduced Motion统一降级**：Atomic commit天然无额外motion；Relation/Push/Pop/semantic scroll/LetterRail/Modal按统一policy处理。

## 生命周期文档

当前权威约束：

- `REQUIREMENT_BASELINE_4.7.3.md`
- `SEMANTIC_IMPACT_MATRIX_4.7.3.md`
- `UX_SPEC_4.7.3.md`
- `PRODUCT_MANUAL_4.7.3.md`
- `AUDIT_REPORT_4.7.3.md`
- `TECHNICAL_RESEARCH_4.7.3.md`
- `CHANGE_REPORT_4.7.3.md`
- `TEST_REPORT_4.7.3.md`
- `MIGRATION_4.7.3.md`
- `tests/IPHONE_REDUCED_TESTS_4.7.3.md`

历史版本文档保留为生命周期事实，不回写成当前行为。4.7.2 的 switch semantic repair继续有效；4.7.3只替换其presentation/lifecycle实现。
