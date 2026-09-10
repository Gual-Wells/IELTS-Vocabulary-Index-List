# Vocabulary Index 4.7.3 技术核验记录

## 1. Presentation Boundary

真机共同症状不是四个独立动画参数问题，而是稳定对象生命周期边界错误：

- 大型Collection/Grid/App直接做极短opacity 1→0→1，持续时间不足以被读取为稳定fade，却足以形成亮度断裂；
- Relation的主体Row被销毁重建，小型child reveal被更大的DOM/raster/layout变化覆盖。

4.7.3因此把“Buffer”重新定义为**事务隔离原则**，而不是必须可见的特效。能在一个paint前完成的状态变化直接Atomic Commit；不再人为制造neutral blank frame。

## 2. Runtime / Durable State 分层

Alphabet/Date切换中，4.7.2把`setCalendarMonth()` / `setViewMode()`的IndexedDB路径放进不可见窗口。4.7.3改为：

`hydrateRuntimeViewState → render/TOP commit → durable setCalendarMonth/setViewMode`

持久层事件继续由`presentationMutationInProgress`抑制重复render；失败仍走previous state best-effort rollback。

## 3. Stable Relation Row

Relation采用稳定父对象 + 动态子对象：

`entry-row / entry-primary-shell`永久存在；`entry-relation-slot`在0fr与1fr之间改变，child内容被slot裁切。这样控件、文本viewport、事件处理器和Row raster identity不会因为展开动作整体重建。

## 4. Virtual Resident Set

4.6 virtualization解决“不要一次创建全部row”，但没有解决“创建后什么时候退休”。4.7.3补上park阶段：

- materialize得到真实chunk高度；
- layout cache记录真实高度；
- 超出resident window后清空row DOM，以min-height保持物理几何；
- Entry→chunk映射继续保留，因此Search/Relation/Last等精确target仍可主动materialize；
- IntersectionObserver负责回访再生。

该设计把**产品状态生命周期**与**DOM对象生命周期**分离：字母可以保持expanded，而远端row不需要常驻。

## 5. Resident Window

当前首轮参数：`max(1500px, 2.4×viewportHeight)`；程序化滚动resident sweep最短间隔72ms。参数目标不是追求最小DOM，而是在目标前后保留足够预热空间，避免park/rematerialize抖动。
