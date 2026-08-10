# Vocabulary Index 4.7.0 审计报告

## 1. 4.6.0 真机判定

4.6.0 的 ScrollCoordinator / semantic position / flow-anchor / measured virtual geometry 被判定为正确方向：Back 位置与 X 最终位置已显著稳定，旧 W141 stale callback 现象明显缓解。但其 presentation 仍暴露中间帧，且 Safari History Rail 的 frozen snapshot / deep background preview 不受 VIX 控制。

因此 4.7 不再继续“给 4.6 多加 correction”，而把剩余问题拆成两层：

1. 删除不再有产品价值的 Browser History transport；
2. 在已经正确的 geometry/state 之上建立有语义的连续 Motion。

## 2. 退役 Safari History Rail

4.5/4.6 为获得 native Back gesture，把每个 recursive Collection frame 映射到 Safari session-history slot。这引入 browserKey、`traverseTo()`、UA scroll restore、history snapshot cache 与 snapshot/live handoff。

用户已明确：目标设备只使用 iPhone 17 standalone PWA，不需要 native swipe，也不需要自制 swipe，Back/Home 只走产品控件。因此 4.7 active runtime 删除内部 `pushState` / `traverseTo` / browserKey/dead-key 分类；启动仅 root `replaceState` 一次。

审计静态门：active `v3-ui.js` 中 `history.pushState(` = 0、`.traverseTo(` = 0、`history.back/go/forward` = 0、`history.replaceState(` = 1。

## 3. 4.6 X 残余跳动重新归因

4.6 顺序 A→…→X 时最终 X 正确但仍可轻度多次运动。源码与全局词汇结构说明：X 位于极端尾部，W 尾部含多个 42-row Chunk；X 下方可用内容不足，最终目标受 maxScroll clamp。若 W 尾部/目标 viewport 周边仍由 estimated placeholder 转为真实高度，`scrollHeight`、X natural Y 与 maxScroll 会变化。

4.7 因此新增目标 viewport prewarm，并在 motion 开始前多次 materialize/measure/recompute，而不是允许可见阶段再用旧 anchor correction 抢 root。

## 4. LetterNav 离散模型判定失败

3.5.x 的 instant-nearest、first/second guard、direction reversal timeout 是在旧硬切 UI 下的局部优化，无法表达：

- expanded relation 导致 section 高度巨差；
- 自然慢滚/快速滚；
- 程序性 A→X；
- 手动横向 LetterNav 持久浏览。

4.7 用真实 `.section-flow-anchor` 构造 physical→semantic piecewise axis，LetterRail 只消费连续 semantic locus 和 velocity。用户横向轨道仍是独立人工浏览，不反向控制 root page。

## 5. Current-page-only state 审计

旧历史中曾存在“Word/Phrase 分别保存状态”的阶段，但当前规则已明确覆盖：普通 view/mode 切换不是隐藏页面恢复。4.7 在可见切换前清 source/target transient expanded groups/relations；Date target calendar month按目标数据重新初始化；只有 recursive Back Frame 保存离开时 current page snapshot。

## 6. Date Calendar 边界

Calendar 没有被抽象为 Date LetterNav。源码只允许 Calendar button → `positionHeadingBelowChrome()`；不存在 page-scroll→calendar semantic camera/active selection 回路。

## 7. Motion correctness 边界

4.7 Motion 不拥有业务数据和导航判定，只消费已确定的 semantic intent：

- root semantic scroll 由 ScrollCoordinator 写；
- page/sibling/reindex/home 使用 View Transition presentation surface；
- modal 使用 retained DOM spring-like transform；
- Sticky 继续真实 native sticky；
- Virtualizer 只 DOM/measure。

因此 motion 不是 correctness mask。
