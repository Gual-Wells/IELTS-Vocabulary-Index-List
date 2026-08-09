# Vocabulary Index 4.4.0 审计报告

## 1. 审计范围

基线：正式 4.3.0 完整源码。审计聚焦 4.3 真机后反馈：Sticky 大位移闪白/累计漂移、合法 Back/Forward/Home destructive stack、Modal 打开后背景 Sticky/scroll geometry。

## 2. 已锁定源码缺陷

### A. Sticky natural-top 假设错误 — P0

4.3 `collapseNativeStickySection()` 以 `sectionRect.top` 代表 heading natural top；但 `.letter-section` / `.date-*-section` 均存在 1px border。重复开合因此产生确定性约 -1px scroll drift。4.4 以真实 `.section-flow-anchor` rect 替代父 border-box 推断，不写 `+1px` 补丁。

### B. Sticky transaction 与 WebKit 已确认缺陷同型 — P0

4.3 在同一 rAF 中 `collapse()` 后立刻 root `scrollTo()`。WebKit 2026 官方修复记录说明 iOS 在 DOM layout change 与同步 programmatic scroll 组合下可能提交旧 exposedContentRect，造成 composited backing store 短暂缺失。4.4 将两次写操作顺序分离，并在支持时使用 View Transition rendering suppression。

### C. Browser navToken 被 snapshot persistence 污染 — P0

4.3 `navigationHistoryState(depth = ..., token = navigationRootToken)` 带危险默认 token，而 `persistCurrentHistorySnapshot()` 无参调用，因此 collection entry 可被改写为 root token。4.4 删除该默认构造，root/page state 分开，snapshot persistence 不再改 browser history state。

### D. `historyRestoreInProgress` 失去 transaction assignment — P0

4.3 只保留变量与 Store-event 检测，恢复过程未 `true → finally false`，导致 mode/calendar restore 可通过 Store emit 触发额外 render。4.4 在后台 persistence reconciliation 周期恢复真实 guard；视觉 restore 改为同步 runtime hydration。

### E. Back restore 被 IndexedDB 阻塞 — P0

4.3 `popstate → await setViewMode → await setCalendarMonth → renderApp`。4.4 首先同步 hydrate runtime state + render，一次可见提交后再异步写 settings。

### F. Home 仍把 VIX depth 当 browser delta — P1

4.3 `history.go(-appNavigationDepth)` 与“browser history 仅 transport”设计矛盾。4.4 Home 创建新 generation root PUSH，不再猜 browser delta。

### G. 永久 underlay + whole-app stacking context — P1

4.3 为纯色 underlay 把 `#app` 整体置于 `z-index:1`。该层可能正是 iOS interactive Back 揭露的直接底层。4.4 从 DOM 删除 underlay，并撤销 whole-app stacking context；安全底色由 html/body canvas 提供。

### H. Modal 仍改变 root geometry path — P1

4.3 `lockPageForModal()` 增加 root class，旧 CSS 将 html/body `overflow-y:auto!important`；同时 modal open 调用 `updateVisualViewportVars()`，间接重算背景 `--content-sticky-top`。4.4 root class mutation 退出，Modal viewport geometry 与 page Sticky geometry拆分。

## 3. 有意保留

- native Sticky 本体；
- Collection-level mode；
- PIN/Review persistent Dock；
- retained parent Modal Stack 与 nested inert；
- Query/Relation Popover；
- non-passive standalone edge guard；
- Schema6/DB5/Seed4/VIX2。

## 4. 仍需真机证明

1. View Transition rendering-suppression 在 iOS 26.5.2 standalone 是否完全消除 100–3000px collapse blank frame。
2. `#app.inert` 在已去 root overflow/stacking 后是否仍与 Sticky compositor 发生组合缺陷。
3. Safari interactive Back 在 JS 可接管前实际展示的 previous-page surface；Web API 无法从源码保证。
4. right-edge touchstart 是否始终早于 system preview。
