# Vocabulary Index 4.4.0 需求基线

## 0. 版本定位

4.4.0 是 4.3.0 真机反馈后的 **Runtime Correctness** 更新。它不扩大 Vocabulary Index 的产品边界，不改变 4.0 内容世代，只修正三个已经能够由源码、平台资料和真机现象共同约束的运行时 ownership 问题：Sticky collapse、destructive navigation、retained Modal。

固定数据世代：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

除本文件明确覆盖的行为外，4.3.0 及此前已经稳定的 Entry / Domain / Collection / Projection / Search / Relation / Provider / PIN / Review / Home 视觉 / 58px toolbar / longpress 语义继续有效。

## 1. 总原则

1. 产品语义优先，实现手段可替换。历史 workaround、selector、timeout、RAF、underlay、inert 等只有在仍满足当前产品不变量时才保留。
2. 能由源码证明的错误必须直接修；不得把应用几何/状态错误归咎于 WebKit。
3. 能由官方平台资料确认的 WebKit 机制用于约束实现，但不能把“可能的内部原因”写成已经真机证明的事实。
4. 自动测试证明源码/数据/布局/纯状态机契约；iOS interactive history surface、compositor frame 与 standalone gesture 仍必须真机验收。
5. 不因本轮运行时修正触碰业务数据世代或学习内容。

## 2. Sticky Collapse

### 2.1 产品不变量

- Alphabet / Date 均继续使用真实 DOM heading 的 native `position:sticky`；不得恢复 mirror。
- 收起时用户当前看到的 Sticky heading 应在最终 collapsed 画面中保持同一阅读锚点，不得累计漂移。
- Alphabet 最终边界由真实 LetterNav 下缘决定；Date 由 Top Chrome 下缘决定；不得写模式高度 magic number。
- 长位移收起不得使用“首次预热”“启动时隐藏执行一次”“默认截图遮罩”等 one-shot workaround。

### 2.2 几何所有权

每个可收起 section 必须拥有一个零高度、真实 in-flow、非 Sticky 的 `.section-flow-anchor`。收起目标只由浏览器实测几何计算：

`rawTargetY = currentY + flowAnchor.top - stickyHeading.top`

然后按收起后的真实最大滚动范围 clamp。不得再以 section border-box 顶部推断 heading natural top；不得以 `+1px` 修补父边框。

### 2.3 渲染事务

- `|delta| <= 0.5px`：直接 collapse，不调用 root scroll。
- 需要 root scroll 且支持 View Transition：仅使用其 rendering-suppression 生命周期，不提供产品动画。旧完整布局仍存在时先滚到目标位置，等待 programmatic scroll settle，再 collapse body。
- 不支持 View Transition：按同样顺序拆为 scroll settle → collapse，禁止恢复 4.3.0 的同步 `layout shrink + scrollTo`。
- transaction 生命周期内临时 `overflow-anchor:none`；结束后恢复，并只持久化最终 snapshot。
- production path 不允许 collapse 后再读取 layout 计算补偿量。

## 3. Destructive Navigation v2

### 3.1 产品语义

- VIX logical stack 唯一拥有 `PUSH / destructive POP / HOME CLEAR`。
- 合法 Back 回到上一 live frame，离开的 frame 在 commit 后永久死亡；Forward 不得复活。
- Home 清空 VIX recursive stack，但不清 PIN、StudyStamp、Annotation、业务数据、API Key、数据 Undo/Redo、手动浏览锚点。
- Browser session history 是 traversal/gesture transport，不是业务 state store。

### 3.2 Identity

- `navModel = destructive-v2`。
- Browser entry 只存 immutable transport identity：`{vix, navModel, generation, navToken, routeKind, depth}`。
- `navToken` 创建后不得由 scroll/snapshot 持久化路径改写；`depth` 只作为诊断元数据，不是 frame identity。
- frame/snapshot 存在 VIX `navigationStack` + session-scoped cache 中。
- 正常 `persistCurrentHistorySnapshot()` 不调用 `history.replaceState()`。

### 3.3 Back restore

- 目标首先按 `generation + navToken` 分类；state.depth 错误不得把合法 token 误炸回 Home。
- Navigation API 可用时，合法 same-document Back 使用 `navigate` pre-commit classification + `intercept()`；VIX 在 handler 中同步 hydrate target presentation state 并只 render 一次。
- mode/calendar 的递归恢复先写 runtime memory，不等待 IndexedDB；持久化在视觉恢复之后异步 reconciliation，并由 `historyRestoreInProgress` 抑制中间 Store emit 重绘。
- Navigation API legal traversal 使用 UA `after-transition` physical scroll restoration；VIX `snapshot.scrollY` 继续作为 session/process fallback。
- 不再用 `history.go(oldDepth-targetDepth)` 对已提交非法 Forward 做 bounce recovery；无法证明的已提交 stale traversal收敛到新 generation Home，绝不 render dead page。

### 3.4 Home / Forward

- 深层 Home 使用新 generation + 新 root PUSH；不再 `history.go(-appNavigationDepth)`。
- 新 root 自然截断当前 browser forward branch；旧 generation entry 即使仍物理存在，也不再具备 VIX 语义。
- Navigation API pre-commit guard 拒绝 Forward/stale destination。
- standalone right-edge guard 仅在真实右邻 history entry 为 forbidden 时启用；不得用永久粗布尔状态制造无意义右缘死区。
- root left-edge 继续作为非法离开 VIX 的保护方向。

## 4. Navigation Visual Surface

- 4.3.0 `navigation-underlay` 退出 DOM。
- `#app/.boot-screen` 不再为了 underlay 建立 whole-app stacking context。
- 永久安全底色由 `html/body` canvas 自身承担。
- 合法 iOS Back 不叠 VIX 自定义 page transition。
- 如果真机证明 Safari 在任何 JS 可接管事件之前仍展示 UA 私有 blank/history preview，本版不得以 retained duplicate page、假 History sentinel 或永久截图层伪装“完全解决”；必须记录为平台视觉边界。

## 5. Modal

### 5.1 Background geometry invariant

Modal open/close 生命周期不得改变：

- `window.scrollY`；
- `document.scrollingElement`；
- html/body computed overflow；
- Sticky containing environment；
- `--sticky-base-top / --chrome-bottom / --content-sticky-top`；
- 背景 Entry DOM identity。

### 5.2 实现

- `lockPageForModal()` 只拥有 modal 状态，不再给 html/body 增删 `modal-open` 类。
- VisualViewport 更新拆为 page geometry 与 modal geometry；Modal open/keyboard 只更新 card 所需 viewport 变量，不触发 background Top Chrome/Sticky remeasure。
- 根 App `inert` 暂时保留；retained parent modal 的 nested inert 继续保留。
- 背景物理滚动由 full-screen modal layer、non-passive touch boundary guard、`touch-action`、focus trap 共同阻止。
- 若目标机仍证明 `#app.inert` 本身会触发 Sticky compositor 异常，再进入 4.4 fallback B：root app inert 改为 custom modality；未经真机证据不得提前删除。

## 6. 明确不变

Schema6 / DB5 / Seed4 / VIX2；Collection-level alphabet/date；各 view 独立 scroll/expanded/calendar/browse anchor；native Sticky containing-block；PIN/Review persistent Dock；Popover；Search/Relation；Provider；Home wordmark/Global Index Rule；Entry layout；StudyStamp；58px toolbar；longpress；Import/Export/VIX。

## 7. 发布门禁

1. `npm run test:all` 全通过。
2. `node --check` 全 JS/MJS/SW；全部 JSON/WebManifest parse。
3. `FILE_MANIFEST.txt` 与 `SHA256SUMS.txt` 基于最终树重建。
4. 正式 ZIP 全新解压后再次 `sha256sum -c SHA256SUMS.txt` 和 `npm run test:all`。
5. 自动测试 PASS 不得表述为 iPhone 真机 PASS；真机矩阵见 `tests/IPHONE_REDUCED_TESTS_4.4.0.md`。
