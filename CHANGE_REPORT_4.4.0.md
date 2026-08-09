# Vocabulary Index 4.4.0 变更报告

4.4.0 从正式 4.3.0 完整源码建立独立工作树，不改变 Schema6 / DB5 / Seed4 / VIX2。

## Runtime

- 新增 `js/v3-runtime-geometry.js`：纯函数 `computeStickyCollapseTarget()`，以真实 flow anchor/visual heading/body/document geometry 计算 targetY 与 bottom clamp。
- Alphabet / Date section 新增 `.section-flow-anchor`；4.3 的 parent border-box natural-top 假设退出。
- Sticky collapse 改为 scroll-settle → collapse；支持时通过无动画 View Transition rendering suppression 隐藏中间状态；无 VT 时也不恢复同步 shrink+scroll。
- 新增 `js/v3-navigation-runtime.js`：纯函数 classifier，以 generation+token 解析 root/back/forward/stale；depth 仅诊断。
- Navigation model 升为 `destructive-v2`；session key 升至 4.4.0。
- snapshot persistence 不再调用 `history.replaceState()`，避免 scroll/persist 路径污染 browser entry identity。
- Back 恢复改为同步 runtime hydration + 单次 render；settings persistence 延后并恢复真实 `historyRestoreInProgress` transaction guard。
- Navigation API legal Back 使用 `intercept({scroll:'after-transition'})`；fallback popstate 仍可用 VIX snapshot scroll。
- Home 删除 `history.go(-depth)`，改为新 generation root PUSH。
- right-edge guard 从粗 `discardedForwardAvailable` 升级为优先检查 `navigation.entries()` 实际右邻 destination。
- 已提交 stale/forward 不再 history bounce；只允许收敛到新 root，绝不 render dead page。

## Presentation

- 删除 `index.html` 的永久 `navigation-underlay`；4.4 CSS 取消 `#app/.boot-screen` whole-app stacking context。
- Modal root lock 不再给 html/body 添加 `modal-open` class；旧版本 CSS 保留为历史层但当前 runtime 不触发。
- VisualViewport geometry 拆为 `updateModalViewportGeometry()` 与 `updatePageViewportGeometry()`；Modal 生命周期不再重算背景 Sticky top。
- `#app.inert` 与 nested retained modal inert 暂时保留，等待目标机 A/B；未无证据删除 accessibility/modality 语义。

## Tests

- 新增 `tests/runtime-behavior-tests.mjs`，执行 Sticky target math 与 destructive-v2 classifier 的纯行为测试。
- `test:all` 新增 `test:behavior`。
- Service Worker precache 新增 4.4 CSS 与两个纯 runtime module。
- iPhone reduced tests 改为 displacement matrix、token identity、Modal geometry invariant。
