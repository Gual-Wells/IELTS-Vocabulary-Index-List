# Vocabulary Index 4.5.0 技术研究记录

本文件记录 4.5 导航设计依赖的外部技术结论；外部资料用于约束平台能力，不替代本项目真机证据。

## WHATWG Navigation API

HTML Navigation API 将 classic `history.state` 与 `NavigationHistoryEntry.getState()` 定义为不同 state surface；`NavigationHistoryEntry.key` 是 session-history entry 的稳定 slot identity，并提供 `navigation.traverseTo(key)` 精确 traversal。4.5 因此不再跨两套 state 做 identity classifier。

参考：`https://html.spec.whatwg.org/multipage/nav-history-apis.html`

## WebKit pushState / user interaction

WebKit 当前 `HistoryController::pushState()` 会检查 `hasRecentUserInteractionForNavigationFromJS()`，无近期用户交互的 JS-created entry 可被标记；WebKit Bug 248303 记录 browser UI Back 对此类 entry 的 skip 行为。4.5 因此要求真实 recursive PUSH 在用户导航命令的同步调用链内发生。

参考：
- `https://bugs.webkit.org/show_bug.cgi?id=248303`
- WebKit `Source/WebCore/loader/HistoryController.cpp`

## History API 与 Navigation API 互操作

WebKit 的 `pushState()` 在 Navigation API 开启时会更新 `Navigation` entry list，因此 4.5 采用保守混合：classic `pushState()` 创建 slot，Navigation API `currentEntry.key`/`traverseTo()` 管理 rail identity/traversal。

## Safari 26.x replaceState/key 风险

WebKit Bug 310321 记录 traversal 后 `history.replaceState()` 可错误改变 `NavigationHistoryEntry.key`；修复进入更后的 Safari 技术预览/27 世代。4.5 仅在 boot 建立 root 时允许一次 replaceState，并在其后捕获 root key；runtime live slot 不再 rewrite。

参考：`https://bugs.webkit.org/show_bug.cgi?id=310321`

## Safari Navigation API 支持

Safari 26.2 引入 Navigation API；Safari 26.4 又修复 intercepted traverse 的 ordering / committed timing。目标 26.5.x 位于这些修复之后。

参考：
- `https://webkit.org/blog/17640/webkit-features-for-safari-26-2/`
- `https://webkit.org/blog/17862/webkit-features-for-safari-26-4/`

## Forward/edge gesture 能力边界

WebKit 的 overscroll-behavior 对 history swipe 仍存在公开缺口，iOS 侧早期 `touchstart.preventDefault()` 是工程社区常见保护层。Navigation API 事件也并非所有 UA traversal 都保证可取消。因此 4.5 的绝对保证只到“dead VIX frame 永不复活”。

参考：
- `https://bugs.webkit.org/show_bug.cgi?id=240183`
- `https://bugs.webkit.org/show_bug.cgi?id=240892`

## SPA 原生 swipe 社区经验

Ionic 等移动 Web 框架长期报告 Safari 原生 swipe surface 与 SPA 自定义 transition 叠加造成双动画/错页。4.5 不实现 retained previous DOM，不叠加自定义 page transition，尽量让 Safari 独占 interactive visual surface。

参考：`https://github.com/ionic-team/ionic-framework/issues/25819`

## Navigation History 形式化研究

Brewster / Jeffrey 对 Web Navigation History 的形式模型说明 browser history 不应被简单等同为应用整数 depth 栈；这支持 4.5 用 VIX logical relation + UA entry key bridge，而不再做 `depth == history delta` 假设。

参考：`https://arxiv.org/abs/1608.05444`
