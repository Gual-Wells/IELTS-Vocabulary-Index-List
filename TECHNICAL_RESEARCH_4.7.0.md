# Vocabulary Index 4.7.0 技术研究记录

本文件固化 4.6→4.7 工程决策使用的标准、WebKit 实现、平台文档、社区工程案例与 HCI 依据。项目真机证据优先；外部资料用于限定实现边界。

## 1. Session History：push 与 replace

WHATWG History/Navigation API 把新增 session-history entry 与替换当前 entry 明确区分。4.7 standalone runtime 不需要浏览器保存内部 recursive page，因此启动期只 normalize 一个 root slot，内部 routing 不再 push/traverse。

参考：`https://html.spec.whatwg.org/multipage/nav-history-apis.html`

W3C Web App Manifest 关于关闭系统导航手势的开放讨论同时记录：installed web app 缺少与原生 WKWebView 等价的正式 disable API，使用 `replaceState()` 避免建立可遍历内部 entries 是现有 workaround 方向之一。

参考：`https://github.com/w3c/manifest/issues/1041`

## 2. WebKit native Back snapshot 与 50 MiB image cache

前序源码审计确认当前 WebKit iOS `ViewSnapshotStore.cpp` 对 navigation snapshot image cache 使用有限预算（目标源码线为 50 MiB）；`ViewGestureControllerIOS.mm` 的 `SwipeSnapshot` 是独立不可交互 UIView，有 bitmap 就显示 image，没有 bitmap 时可只剩 snapshot background。

这直接解释多层 native Back 后“先纯色、提交后才出现 live VIX”。Web 平台没有接口把真实 VIX DOM 注入该 SwipeSnapshot。4.7 因此不是扩大缓存，而是让 VIX 内部递归不建立 Safari history slots。

参考：
- WebKit `Source/WebKit/UIProcess/ViewSnapshotStore.cpp`
- WebKit `Source/WebKit/UIProcess/ios/ViewGestureControllerIOS.mm`

## 3. View Transitions：Prepare / capture / presentation

CSS View Transitions Level 1 定义 same-document old-state capture、update callback、new-state capture 与 transition presentation。该模型允许 VIX 在新状态 capture 前完成 DOM/geometry/scroll 准备，而用户只看到 old→new 的受控 surface 运动。

参考：`https://www.w3.org/TR/css-view-transitions-1/`

WebKit 自 Safari 18 起支持 same-document View Transitions；后续 Interop 工作持续提高实现一致性。4.7 只在 page/sibling/reindex/home 级别使用粗粒度 surface，不为 5k Entry 建 transition-name。

参考：
- `https://webkit.org/blog/15865/webkit-features-in-safari-18-0/`
- `https://webkit.org/blog/17818/announcing-interop-2026/`

## 4. iOS 26.5 同步 layout + root scroll 风险

WebKit 后续 Safari 27 release notes 才明确列出 scroll anchoring、programmatic scroll、DOM layout change + synchronous `window.scrollTo()` compositing blank/flicker、Sticky flicker 等修复。目标 iOS 26.5 不能假设已具备这些修复。

因此 4.7 的规则是：可见程序性运动前先 Target Geometry Prewarm；运动过程中尽量避免大结构 mutation；运动结束只允许一次 final exact commit。

参考：`https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/`

## 5. 动态高度虚拟列表社区证据

Mobile Safari 上动态 item height / measurement 与 momentum/scroll position 冲突是主流 virtual-list 实现长期需要处理的问题。TanStack Virtual、React Virtuoso 都有 iOS 动态高度/未知高度导致跳动或 glitch 的工程报告。

4.7 不放弃 virtualization，而复用 4.6 measured chunk cache + bounded target-neighborhood prewarm；42/960 tuning 不同时改变。

参考：
- `https://github.com/TanStack/virtual/issues/884`
- `https://github.com/petyosi/react-virtuoso/issues/945`

## 6. Motion 不是固定匀速

Apple Fluid Interfaces 强调空间一致、可中断/重定向、进入退出对称与自然 timing，而不是每个动作统一固定 duration/linear rate。UIKit 的 animation timing 模型也支持 cubic timing / spring parameters。

参考：
- `https://developer.apple.com/videos/play/wwdc2018/803/`
- UIKit animation timing / property animator documentation

4.7 将该原则转译为产品语义：Page Push/Pop、Sibling Swap、Reindex、Home Reset、Semantic Scroll、Modal Spring 各自有独立 motion token。

## 7. Animated transition 与空间理解

HCI 对 zooming/animated transitions 的研究支持：适度动画可以帮助用户保留不同视图/位置间的空间对应关系；收益不要求漫长动画。4.7 因此强调“正确的运动类型 + 有界 duration”，而不是用慢动画装饰所有操作。

参考：`https://hci.cs.umanitoba.ca/publications/details/the-effect-of-animated-transitions-in-zooming-interfaces`

## 8. Alphabet Semantic Axis

该部分是 VIX 自身算法，不声称来自平台私有 API：

- 真实 flow anchor 定义 physical knots；
- A…Z/# ordinal 定义 semantic knots；
- piecewise linear mapping/逆映射保证相邻逻辑字母等权；
- overall cubic timing 只调制整次 semantic progress；
- LetterRail camera 由 semantic locus + velocity 连续求目标位置。

纯函数位于 `js/v3-motion-runtime.js`，可脱离 DOM 做 property test。
