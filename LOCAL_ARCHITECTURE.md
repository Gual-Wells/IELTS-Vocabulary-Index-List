# Vocabulary Index 4.6.0 本地架构

## Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与 runtime navigation/scroll/virtual-layout state 分离。

## Navigation Controller（冻结）

4.5 `destructive-v3`：Root 不是 recursive frame；`navigationStack` 只保存 live Collection frames；frame `token` 是 VIX identity，`browserKey` 是 UA session-history slot identity；dead key 只阻止 logical resurrection；runtime restart 从 Home。

Browser rail：真实跨 Collection user action 用 `history.pushState()` 建 slot，捕获 `navigation.currentEntry.key`；App Back/Home 用 `navigation.traverseTo(key)`；Navigation API `navigate` 是目标 Safari 唯一 traversal owner，`popstate` 只为 fallback。Runtime live slot 不持续 `replaceState()`。

## ScrollCoordinator

`js/v3-scroll-runtime.js` 持有 monotonically increasing epoch、owner、phase、semantic target。`v3-ui.js` 的 `rootScrollToY/rootScrollByY` 是唯一直接 root viewport adapter；旧 epoch write 被拒绝。

Owner 包括：`letter-jump`、`entry-jump`、`back-restore`、`home-clear`、`sticky-collapse`、`virtual-materialize`、`study-date-refresh`、`return-top` 等。Natural user touch/momentum 可取消 app transaction 并优先拥有 viewport。

## ChromeGeometry

`topChromeBottom()` / `readingViewportBounds()` 提供一个 ContentTop 真值。LetterNav 是否瞬时 attached 不改变语义坐标；active-letter/Sticky/positioning 共用同一边界。

## VirtualEntryList / Chunk layer

4.6 保持 42 Entry / 960px lazy materialization。Chunk descriptor 使用稳定 key，记录 estimated/measured block size；每个 live navigation frame 保存 `virtualLayoutCache`，宽度实质改变时失效。

Virtualizer 只生成/测量 DOM；不允许直接 root scroll。`ensureEntryRendered(entryId)` 对 Search/PIN/Relation 继续保持原外部合同。

## Semantic Position

Frame snapshot 除 `scrollY` 外保存 `position`：top / entry / section / bottom / scroll fallback。Entry/Section position 用 identity + offsetFromContentTop；bottom 用 bottomGap。Back 以 semantic position 为最终权威。

## Back Restore

Navigation API legal Back 使用 `intercept({scroll:'manual'})`：先 hydrate/render、恢复 measured placeholders、强制 target chunk；再 `event.scroll()` 作为 UA first pass；最后 verify/correct semantic position。只有 transaction settle 后才重新允许 authoritative persistence。

## Sticky / Modal / Visual

4.4 native Sticky + flow anchor、long displacement rendering suppression、retained Modal、Modal/Page viewport geometry 分离、whole-app stacking-context removal全部冻结。Sticky collapse 只通过 coordinator lease 写 root scroll。

Native iOS swipe snapshot 属 browser-owned visual surface；4.6 不自建 previous-page snapshot/underlay。
