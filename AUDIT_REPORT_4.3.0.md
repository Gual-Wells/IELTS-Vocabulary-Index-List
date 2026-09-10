# Vocabulary Index 4.3.0 审计报告

## 1. 审计方法与证据分级

本轮先对 4.2.0 正式源码、3.x–4.2 生命周期文档和关键注释做回溯，再用标准/WebKit issue/社区框架问题核对平台行为。结论分三类：

- **源码确定**：可由当前源码调用链直接证明；
- **平台资料支持**：WebKit/WHATWG/W3C 已记录相同机制；
- **目标机待证**：涉及 iOS 26.5.2 standalone 的 gesture/compositor 首帧，只能真机确认。

## 2. Sticky collapse：真正的问题不是 native Sticky

4.2.0 Date 与 Alphabet 都执行同一模式：记录 heading top，立即移除 body，等待 rAF，再读取 heading rect 并 `scrollBy()`，下一 rAF 才恢复 overflow-anchor。用户反馈两种模式都闪，因此源码已经把故障范围缩到共同 collapse transaction，而不是 LetterNav 或 alphabet mirror。

WebKit Bug 261692 记录了 DOM mutation 与 scrollTop correction 可能被显示为两次 UI update 的 glitch；动态列表社区（React Virtuoso #945）也记录 iOS Safari 对未知高度/动态挂载的可见 glitch，并最终通过新的 state/rendering approach 而非简单延迟修复。因此 4.3.0 删除“先 mutation、下一帧再补偿”的结构。

新事务先读 `headingRect/sectionRect/currentScrollY`，计算最终目标；下一帧只做 collapse + `scrollTo` 两个 write，不再 mutation 后测量。Alphabet/Date 共用算法但 target 由真实 heading/section 几何得出；Alphabet 上方 LetterNav 已经体现在 heading 当前 sticky top 中，因此没有硬编码差异。

**仍未声称已知**：第一次 collapse 比之后更严重的具体 WebKit compositor 内部原因。4.3.0 只消灭可证的 two-phase transaction；若目标机仍闪，再从 reduced test/trace 决定是否需要 visual freeze Plan B。

## 3. View mode：状态层级设计错误

4.2.0 Store key 明确使用 `${collectionId}:${section}`，所以同一 A1 可同时保存 word=date、phrase=alphabet。这个问题与浏览器无关，是状态 ownership 错层。

4.3.0 将 mode 提升到 Collection key；只统一 alphabet/date，不把 scroll/calendar/expanded/snapshot 错误合并。用户明确不要求旧模式数据兼容，因此不构造“word 优先/phrase 兜底”等无法证明的迁移规则。

## 4. Navigation：4.2.0 的 epoch 不是清栈

4.2.0 Root Home 使用 `history.go(-depth)` 回根，再以 epoch 让旧状态失效。浏览器 forward entry 仍物理存在，所以 iOS forward gesture 可以尝试展示旧 entry；epoch 只能在 App 处理 state 时拒绝复活，不能删除 session history slot。

4.3.0 改为双 ownership：Safari history 负责 traversal/原生合法 Back 轨道；VIX `navigationStack` 负责页面生命。完整 snapshot 不再进 `history.state`。POP commit 后离开 frame 删除并 token discarded；Home 统一 clear all recursive frames。

实现审计额外补上 root-render 门禁：`renderApp()` 在任何同文档 hash/外部路由要直接显示 Home 时，若 `appNavigationDepth/navigationStack` 仍非空，会先收敛到 `enterHomeRoot()`，因此“Home 视觉状态”与“递归栈已清空”成为同一硬不变量，而不是只覆盖 Home 按钮路径。

WHATWG History/Navigation 模型没有任意 `deleteEntry()`；Navigation API 能观察/拦截 traverse，而 Safari 26.2 已正式提供该 API。社区 Ionic #25819/#20904 也显示 Safari 原生 swipe 与 SPA 自己的 page transition 叠加会造成 double animation，因此合法 iOS Back 不再叠 VIX page transition。

## 5. 为什么 Underlay 不是 History 空白页

Web 平台没有为单个 history entry 设置“禁止 iPhone gesture”的属性；W3C Web App Manifest issue #1041 仍在请求这类能力。WebKit Bug 240183 也表明 `overscroll-behavior-x:contain` 不能可靠禁止 Safari history navigation。WebKit 的 anti-history-hijacking 行为还使 synthetic entries 不是可靠 sentinel。

因此 4.3.0 的 `navigation-underlay` 是从启动即常驻的 visual layer：无 route、无 data、无 scroll、无 history identity。非法 edge gesture 不创建任何 DOM 页面，只阻止 navigation 并最多显示常驻 edge feedback。

`touchstart/touchmove` guard 显式 `{passive:false}`，符合 WebKit Bug 182521 对 root touch listener passive 默认值的说明；但它是否能在 iOS 26.5.2 standalone 每一次 forward edge preview 之前抢到控制权仍标记为 **待真机**。

## 6. Presentation：为什么必须重构而不是加动画

4.2.0 同时存在：Query fixed popover、Relation fixed menu、retained custom Modal、native Search/Confirm `<dialog>`、PIN/Review Dock、Toast/Task transient。它们在 document geometry、focus、scroll lock、DOM identity、enter/exit 时序上没有共同 owner。

最强证据是 Modal scroll lock：当前历史实现把 body 改为 fixed、top=-scrollY，close 后恢复并 scrollTo。WebKit Bug 259568 对 iOS/iPadOS Home Screen PWA 明确记录：`overflow:hidden` 锁 document 不可靠，而这一常见 fixed-body workaround 会带来 page flicker。继续在其上调 animation 参数不能解决根因。

4.3.0 因此做“Presentation Layer bounded refactor”：

- Popover：只管轻浮层 show/hide/motion；
- Modal：一个 retained custom stack；
- Dock：PIN/Review 持久 DOM。

业务 caller 不再自行选择 `showModal()`、double-rAF、body-fixed、display hard toggle 或 whole-row rerender。

## 7. 保住了哪些历史设计意图

### 4.0.1 retained modal stack
父层必须是原 DOM 而不是 snapshot。4.3.0 继续 parent.inert + child independent layer；child close 后 parent onRestore/DOM/input/scroll 保留。

### 4.0.1 first-frame stabilization intent
当时 double-rAF 是为避免 card 在未稳定 geometry 下抖动。4.3.0 不是简单删除稳定化：完整 layer 先构建，VisualViewport vars 在 first modal 打开前同步更新，然后一次 append；首帧由 CSS opacity/transform 隐式过渡，而不是 visibility hard gate 两帧后突现。

### 3.5.x / 4.x VisualViewport intent
Card 继续使用 `--visual-*` 几何；keyboard 不把 backdrop 裁成卡片大小。没有把整个 App 改成新 scroll container，避免破坏 Sticky、browse anchor、recursive snapshot 等既有坐标系。

### 4.2 full-Web backdrop / shell boundary
48% first +20% child、inset:0 和 top card 正常 surface 保留；不复活 4.1 system shell tint experiment。

### PIN context dock
PIN 仍是 context dock，不被强行改成 Modal。只是去掉与 PIN 语义无关的 Entry whole-row rerender，并让 dock box 常驻以消除 first-display cold path。

## 8. 被明确拒绝的替代方案

- Sticky：继续增加 rAF/timeout；默认加遮罩掩 bug；恢复 mirror。
- View mode：为旧 word/phrase mode 猜迁移优先级。
- Navigation：每层插 blank/dummy history sentinel；把 Safari history 继续当业务 stack；自制一套替代 Apple 合法 Back 动画。
- Modal：继续 body-fixed scroll lock；保留 native Search/Confirm 第二 lifecycle；为了 modal 直接把全 App 改为自建 scroll container。
- PIN：用动画遮住 whole Entry rerender。

## 9. 主要资料

官方/标准：

- WebKit Bug 261692 — DOM mutation + scrollTop 两阶段 UI glitch：https://bugs.webkit.org/show_bug.cgi?id=261692
- WebKit Bug 259568 — iOS/iPadOS PWA body overflow/position-fixed workaround flicker：https://bugs.webkit.org/show_bug.cgi?id=259568
- WebKit Bug 299084 — Safari 26 body/html `overflow:hidden` 仍有独立回归记录，不能把 CSS overflow 当成唯一 modal background lock：https://bugs.webkit.org/show_bug.cgi?id=299084
- WebKit Safari 26.2 Navigation API：https://webkit.org/blog/17640/webkit-features-for-safari-26-2/
- WHATWG Navigation/History API：https://html.spec.whatwg.org/multipage/nav-history-apis.html
- WebKit Bug 240183 — overscroll-behavior-x 不禁 history navigation：https://bugs.webkit.org/show_bug.cgi?id=240183
- WebKit Bug 240892 — iOS 已知 workaround 是在发起手势的 `touchstart` 上 `preventDefault()`；仅在目标机 reduced test 通过后才能把它当作视觉前置防线：https://bugs.webkit.org/show_bug.cgi?id=240892
- WebKit Bug 182521 — root touch listener passive 默认行为：https://bugs.webkit.org/show_bug.cgi?id=182521
- W3C Pointer Events：https://www.w3.org/TR/pointerevents/

社区工程反馈：

- React Virtuoso #945 — iOS Safari 动态高度 reverse-scroll glitch：https://github.com/petyosi/react-virtuoso/issues/945
- Ionic #25819 / #20904 — iOS native swipe 与 App transition 双动画：https://github.com/ionic-team/ionic-framework/issues/25819 / https://github.com/ionic-team/ionic-framework/issues/20904
- W3C Manifest #1041 — Home Screen Web App 缺少禁用系统导航手势能力：https://github.com/w3c/manifest/issues/1041
