# Vocabulary Index 4.7.0 变更报告

4.7.0 从正式 4.6.0 源码世代继续构建。Schema6 / DB5 / Seed4 / VIX2 不变。

## Single-Slot Navigation

- `NAVIGATION_MODEL` 升为 `single-slot-vix-v1`。
- 启动期唯一 `history.replaceState()` 把 standalone runtime 归一到 root URL。
- 删除 active `history.pushState()`、Navigation API `traverseTo()`、browserKey/rootBrowserKey/deadBrowserKeys、Navigation API/popstate traversal owner、edge-history guard。
- `navigationStack` 继续保存 VIX recursive frames；Back 直接 POP，Home 直接 clear。
- Back 的目标 frame 在 View Transition update 阶段 hydrate/render/prewarm/semantic restore；Safari UA History 不再参与。

## Semantic Motion Runtime

新增 `js/v3-motion-runtime.js`：

- DOM-free cubic Bézier timing；
- Alphabet ordinal / continuous semantic axis；
- physical↔semantic piecewise mapping；
- logical-distance-aware scroll duration；
- physical scroll duration；
- LetterRail velocity-biased continuous camera；
- exponential camera approach。

## Continuous Same-Page Scroll

- Letter/Entry/PIN/Date/Return Top 从 hard reposition 升级为 rAF-driven continuous root scroll；
- Alphabet jump 使用 semantic progress，真实 flow-anchor mapping 每帧提供 physical Y；
- 目标 geometry 在 motion 前先 prewarm，结束后只做 final exact semantic restore；
- explicit X target 采用 target-neighborhood materialization，减少 W 尾部 estimated→measured 造成的 visible reconvergence。

## LetterNav

- 新增 `.letter-nav-locus` 连续视觉 locus；离散 active/ARIA identity 保留业务/可访问性语义；
- 删除 first/second cell guard、reversal hard-follow 思路；
- camera 由 continuous semantic locus + velocity 求最小必要位移；
- 用户横向拖动只锁 LetterRail，绝不移动页面；pointerup/cancel 不复位；只有实际 page Y 后续变化才自动重新接管；
- 点击 Letter cell 属显式 navigation，直接释放 manual lock。

## Presentation Motion

新增 `css/v4.7.0.css`：

- Page Push / Page Pop：root hierarchy surface；
- Home：独立 hierarchy reset；
- Word/Phrase：`vix-content-plane` sibling projection swap，product chrome 不整页横移；
- Alphabet/Date：`vix-content-plane` reindex morph，真实 Sticky geometry 只在 update callback 切到最终状态；
- Modal：克制 scale/fade/spring-like open，close 更快且不 bounce。

## Current-Page-Only State

- ordinary Word/Phrase switch 清 source 与 target transient expanded state，目标 TOP+collapsed；
- ordinary Alphabet/Date switch 目标 TOP+collapsed；
- Date target calendar month按目标当前数据重新初始化，不读取未打开 view 的旧 calendar page state；
- recursive Back 仍恢复离开 source frame 的完整 snapshot；
- explicit target jump 仍只展开目标组并连续到目标。

## Date Calendar

- 保持 query/jump-only；Calendar→Date section 可以定位；不存在 page-scroll→Calendar active/month follow。

## Service Worker / Assets

- cache generation：`gual-vocabulary-index-v4.7.0-single-slot-motion-20260810-1`；
- precache 新增 `css/v4.7.0.css`、`js/v3-motion-runtime.js`；
- retired `v3-navigation-runtime.js` 文件保留在完整源码生命周期中，但不再属于 active Service Worker precache/runtime import。
