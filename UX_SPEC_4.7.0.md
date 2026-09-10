# Vocabulary Index 4.7.0 UX 规范

## 1. Motion language

运动类型必须表达行为语义，不得使用统一 crossfade 替代：

- 同页定位：真实连续纵向 scroll；
- 新 Collection：Page Push；
- Back：Page Pop；
- Home：Hierarchy Reset；
- Word↔Phrase：Sibling Projection Swap；
- Alphabet↔Date：Reindex Morph；
- Modal：scale/fade + restrained spring；
- Sticky：真实 scroll 驱动 native sticky handoff。

所有可见 motion 只在目标 geometry/presentation 已准备后开始。

## 2. Alphabet continuous motion

### Programmatic jump

点击字母时：

1. 目标字母分组按显式导航语义展开；
2. 目标 viewport 周边 Chunk 预物化并测量；
3. 以所有真实 `.section-flow-anchor` 构建 Alphabet Semantic Axis；
4. 从当前 semantic position 连续滚到目标 ordinal；
5. LetterRail locus 与正文使用同一个 semantic progress；
6. 到达后只有标准 document-bottom clamp 允许目标不能贴 ContentTop，不允许额外 W/Y→X 可见二次 correction。

### Equal logical progress

展开关系导致 A→B 物理 3800px、B→C 物理 120px 时，两段仍各占 1 semantic unit。物理 px/s 自动变化；逻辑进度一致。整个 A→X 只使用一次自然速度曲线。

### Manual horizontal LetterNav

- 用户横向拖 LetterNav 只改变轨道 `scrollLeft`；正文完全不动；
- pointerup/pointercancel 后保持人工位置；
- 不允许自动 timeout/nearest/snap-back；
- 下一次页面发生任何纵向 scroll 后，manual lock 才解除；轨道从人工位置平滑重新跟随；
- 点击 Letter cell 是显式导航，可立即接管。

## 3. Same-page Entry/PIN/Date navigation

同一页面中的 Entry、PIN、Relation target、Browse Anchor、Return Top 与 Calendar date target 都用真实连续 vertical scroll。Date target不创建 Calendar active-follow 状态。

## 4. Cross-page target

Search/Relation 等目标位于其他 Collection：

`Source → Page Push → Target Collection @ TOP → Semantic Scroll → Target`

页面 Push 与纵向定位不得同时叠播。目标 geometry 可在 Page Push 后半段后台准备，但可见纵向运动必须在 Page Push 结束后开始。

## 5. View/Mode transitions

### Word ↔ Phrase

两者是同一 Collection 的 sibling projections。只让 Collection content plane 做浅水平换面；Topbar/Product Chrome 保持视觉稳定。目标始终 TOP+collapsed，不恢复 target view 历史位置。

### Alphabet ↔ Date

两者是同一内容的组织坐标切换。使用 content-plane Reindex Morph；真实 DOM/Sticky/LetterNav 几何在 View Transition update callback 一次切到最终形态，动画只表现 old/new presentation，不逐帧改变 Sticky top。目标始终 TOP+collapsed。

## 6. Back / Home

Back 直接 POP VIX frame，目标页在新 surface capture 前恢复原离页 snapshot；用户不应看到 target page 先 TOP 再跳回旧位置。

Home 清整个 recursive stack并用独立 reset motion回 root；不得播放多个 Back，也不得恢复任意 Collection hidden state。

## 7. Modal

Open：backdrop ease + card 轻 translate/scale + 克制 spring overshoot。Close：更短、更直接，不 bounce。Modal retained/inert/background geometry invariants继续冻结。

## 8. Date Calendar

Calendar 是查询/跳转工具，不是 Date 的动态阅读 rail。页面纵向滚动不改 Calendar month/selection；只有用户直接操作 Calendar 才改变 Calendar 自身显示和触发目标跳转。
