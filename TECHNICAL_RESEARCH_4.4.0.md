# Vocabulary Index 4.4.0 技术调研与最终决策记录

本文件记录 4.3 真机反馈后，源码审计与外部资料之间的决策映射。外部资料只约束平台行为，不替代目标机验证。

| 议题 | 资料 | 4.4 决策 | 证据等级 |
|---|---|---|---|
| iOS DOM layout change + sync `scrollTo()` blank composited layer | WebKit Bug 310087 / commit 46fb2414dbc9d58182d393b10571742b1e32d1d5；Safari 27 release notes | Sticky 不再 collapse+scrollTo 同 compositor commit | 直接官方同型机制 |
| Scroll Anchoring | CSS Scroll Anchoring spec；WebKit historical bugs 171099/298514 | `overflow-anchor:none` 只作为 transaction-local opt-out；不当作补偿算法 | 标准+实现历史 |
| View Transition rendering suppression | CSS View Transitions Level 1；WebKit Safari 18 feature notes | 支持时作为无动画 transaction；目标机仍 reduced-test | 标准能力，高；iOS具体 compositor 需真机 |
| View Transition iOS edge cases | WebKit 285400 等 | 不把 VT 写成万能修复；失败才进入 operation-local fallback | 官方实现缺陷 |
| Navigation API / `NavigateEvent.intercept()` | WHATWG HTML Navigation API；Safari 26.2 WebKit release | legal Back pre-commit classify，handler 同步 hydrate；scroll after-transition | 标准+官方实现 |
| `replaceState()` / Navigation entry key WebKit bug | WebKit 310321 | VIX 不依赖 UA key；snapshot persistence 不改 history state/token | 官方实现缺陷 |
| overscroll 不能可靠禁 History gesture | WebKit 240183 | CSS 不承担 Forward 安全；保留 pre-start touch guard + Navigation API | 官方 bug |
| PWA 无关闭 system swipe API | W3C Manifest #1041 | 不伪造 manifest 开关 | 标准社区开放问题 |
| iOS SPA swipe/double animation | Ionic framework #20904 等 | legal Back 不叠 VIX page transition | 社区工程证据 |
| dynamic-height iOS scrolling glitch | TanStack Virtual #884 / React Virtuoso community reports | 优先修 ownership/geometry，不叠 timeout | 类比工程证据 |
| incremental layout/cache behavior | Spineless Traversal for Layout Invalidation, arXiv:2411.10659 | 只能说明布局存在冷热成本；不支持“预热一次即可消灭首次闪”假说 | 研究文献，非直接根因 |

## 关键外部链接

- https://bugs.webkit.org/show_bug.cgi?id=310087
- https://commits.webkit.org/46fb2414dbc9d58182d393b10571742b1e32d1d5
- https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes
- https://www.w3.org/TR/css-view-transitions-1/
- https://html.spec.whatwg.org/multipage/nav-history-apis.html
- https://bugs.webkit.org/show_bug.cgi?id=310321
- https://bugs.webkit.org/show_bug.cgi?id=240183
- https://github.com/w3c/manifest/issues/1041
- https://github.com/ionic-team/ionic-framework/issues/20904
- https://github.com/TanStack/virtual/issues/884
- https://arxiv.org/abs/2411.10659

## 最终认知

“首次更严重”不再作为产品变量。4.3 的 observable pattern 更符合 **首次通常发生大 displacement、随后未再次滚深只剩极小 displacement**。4.4 的验收因此按 scroll delta 分组，而不是按 cold/warm 次数分组。
