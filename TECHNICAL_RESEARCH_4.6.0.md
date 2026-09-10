# Vocabulary Index 4.6.0 技术研究记录

本文件固化 4.5→4.6 研讨使用的外部技术依据。项目真机证据决定产品结论；标准、WebKit 源码、社区案例与研究文献用于约束可行实现，不替代真机验收。

## 1. Navigation scroll timing

WHATWG Navigation API 允许 intercepted navigation 使用 `scroll:'manual'`，随后由 handler 中的 `event.scroll()` 触发该 traversal 通常的 history scroll behavior；`after-transition` 则把 UA scroll 放到 handler 后的 finishing path。4.6 因此不再在 handler 结束时提前宣告整个 VIX restore transaction 已完成。

参考：`https://html.spec.whatwg.org/multipage/nav-history-apis.html`

## 2. WebKit History scroll layout race

WebKit `HistoryController::restoreScrollPositionAndViewState()` 明确记录：若旧位置超过当前已经 layout 的文档，恢复可静默失败，后续 layout/load 再尝试；iOS 使用 platform client 的独立 view-state restore 路径。动态重建 + provisional virtual height 因此不适合把 UA absolute scroll 当作产品语义真值。

参考：WebKit `Source/WebCore/loader/HistoryController.cpp`

## 3. Intersection/Resize observation 与多帧提交

IntersectionObserver 与 ResizeObserver 属于 rendering update 中的异步观察机制。DOM materialization、geometry read、下一帧 correction 会跨 rendering phases；不能假设“函数里很快发生”就不会被用户看到。

参考：
- `https://www.w3.org/TR/intersection-observer/`
- Resize Observer / HTML rendering integration（WHATWG/W3C）

## 4. Semantic anchor 模型

CSS Scroll Anchoring 的核心目标是动态内容改变时保持 anchor node 与 viewport 的关系，而不是保存一个绝对文档像素。Chrome 的 infinite-scroller 工程实践同样使用 visible anchor + offset 维持未知高度内容替换时的位置。4.6 据此把 Entry/Section identity + offset/bottomGap 设为 VIX semantic position。

参考：
- `https://www.w3.org/TR/css-scroll-anchoring/`
- `https://developer.chrome.com/blog/infinite-scroller`

## 5. WebKit Scroll Anchoring 工程经验

Safari 27 才正式加入 Scroll Anchoring；WebKit 在实现中加入 rubberband/user-scroll 抑制和高频 adjustment 防振荡 heuristic，说明“观察滚动→改 DOM→再补滚动”的反馈环必须有 ownership。目标 Safari 26.5 不能依赖该新能力，因此 VIX 自己实现受控 coordinator，但遵循用户自然滚动优先原则。

参考：
- `https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/`
- `https://results.webkit.org/commit?id=310545%40main&repository_id=webkit`
- `https://results.webkit.org/commit?id=311686%40main&repository_id=webkit`

## 6. iOS DOM layout + synchronous root scroll 闪白

WebKit 2026 修复记录表明，在 iOS 上 DOM layout change 与同步 root `scrollTo()` 同提交可产生 composited blank/flicker；该修复进入比目标 26.5 更后的线。4.6 因此采用 Prepare Geometry → Position Commit，而不是 materialize 大量 DOM 后同一同步调用中大跨度 scroll。

参考：WebKit Bug 310087 / 对应 WebKit changeset；Safari 27 Beta release notes。

## 7. Native Back visual surface

当前 WebKit `ViewSnapshotStore.cpp` 在 iOS 把 navigation snapshot image cache 上限设为 50 MiB，超出后清较老 image。`ViewGestureControllerIOS.mm` 使用不可交互 `SwipeSnapshot`；有 image 时显示 bitmap，无 image 时仍使用 snapshot background，并在 render/repaint/load/subresource/scroll restore 条件后移除。4.6 因此把深历史纯背景 preview 划为 browser-owned visual boundary。

参考：
- WebKit `Source/WebKit/UIProcess/ViewSnapshotStore.cpp`
- WebKit `Source/WebKit/UIProcess/ios/ViewGestureControllerIOS.mm`

## 8. History snapshot capture timing

WebKit `WebBackForwardList::addItem()` 在加入新 item 前调用 `recordAutomaticNavigationSnapshot()`。因此 cross-Collection PUSH 前仍留在 DOM 的 closing Search/Popover 可成为未来 Back preview 的冻结画面。4.6 先完成 navigation-specific transient surface cleanup，再创建新 browser slot。

参考：WebKit `Source/WebKit/UIProcess/WebBackForwardList.cpp`

## 9. WebKit recent user activation

当前 WebKit `Document::hasRecentUserInteractionForNavigationFromJS()` 接受正在处理的 user gesture，或最近 activation 时间不超过 10 秒。4.6 cross-Collection Search 只等待一个 presentation frame 后 PUSH，以清洁 snapshot；10 秒只是 WebKit adapter 的当前实现事实，不写入 VIX navigation semantic contract。

参考：WebKit `Source/WebCore/dom/Document.cpp`

## 10. Dynamic-height virtual list 社区经验

TanStack Virtual / React Virtuoso 的 iOS dynamic-height 案例显示，未知高度、重新测量、momentum 与 viewport correction 的组合会产生 glitch；成熟解法仍保留 virtualization，但把估算、测量、anchor/scroll ownership 分层，而不是回到全量 DOM。

参考：
- `https://github.com/TanStack/virtual/issues/884`
- `https://github.com/petyosi/react-virtuoso/issues/945`
- `https://tanstack.com/virtual/latest`

## 11. content-visibility 的边界

Safari 已支持 `content-visibility`，但它主要减少离屏 layout/paint，不免除 5k+ Entry 的 JS/DOM 创建成本；本项目又高度依赖几何测量、Sticky、programmatic positioning。4.6 不把它作为 correctness foundation，只保留后续 isolated benchmark 可能性。

参考：
- `https://webkit.org/blog/15865/webkit-features-in-safari-18-0/`
- `https://www.w3.org/TR/css-contain-2/`

## 12. Navigation history model

Brewster / Jeffrey 的 Web Navigation History 形式模型支持把 browser history 视为独立 transport/history structure，而非 VIX 整数 depth 的镜像。4.6 继续冻结 4.5 browser-key rail，不让 Scroll 重构重新污染 Navigation identity。

参考：`https://arxiv.org/abs/1608.05444`
