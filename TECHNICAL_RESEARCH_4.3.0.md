# Vocabulary Index 4.3.0 技术调研与决策记录

本文件保存本轮外部资料与源码决策之间的映射，避免以后只看到“改了什么”而忘记“为什么”。

| 议题 | 外部证据 | 对 4.3.0 的约束 | 置信度 |
|---|---|---|---|
| DOM mutation + scroll correction glitch | WebKit 261692 | 删除 collapse 的跨帧 mutation→measure→scroll 补偿 | 高：机制匹配；首次更严重内部原因未知 |
| iOS PWA body scroll lock | WebKit 259568；Safari 26 overflow issue 299084 | 不再 body fixed/top/restore scroll；改 inert+touch guard | 高；最终漏滚仍真机 |
| Navigation API | WebKit Safari 26.2；WHATWG | 用 navigate/destination 判断 forward/stale；History 仅 gesture rail | 高 |
| overscroll 不能禁 history gesture | WebKit 240183 | CSS 不能单独承担 Forward guard | 高 |
| iOS edge history gesture 抢占时机 | WebKit 240892；WebKit 182521 | edge guard 在手势起点预注册 `touchstart`，并以 `{passive:false}` 才有资格 `preventDefault()`；仍需目标机证明是否早于系统 preview | 高（机制）；最终视觉时机仅真机 |
| PWA 缺禁系统 gesture API | W3C Manifest #1041 | 不伪造“禁止 iPhone 手势属性”；需 reduced test | 高 |
| SPA + iOS swipe double animation | Ionic #25819/#20904 | 合法 Safari Back 不叠 VIX page transition | 中高：社区工程证据 |
| 动态高度列表 iOS glitch | React Virtuoso #945 | 优先重构 transaction/state ownership，而非更多 timeout | 中：类比证据，不当作直接 root cause |

## 目标机边界

以下不能从静态源码/规范推出，必须 iPhone 17 / iOS 26.5.2 / Home Screen standalone 验证：

- non-passive right-edge guard 是否永远早于 system forward preview；
- Sticky 首次 collapse 是否还暴露 compositor flash；
- 不使用 body-fixed 后 modal background pan 是否在所有 rubber-band/keyboard/nested 情况完全被 touch guard 阻断；
- fixed guard/dock 在 iOS 26 compositor 上是否出现 CSSOM 与实际 paint 不一致。
