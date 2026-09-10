# Vocabulary Index 4.6.0 变更报告

4.6.0 从正式 4.5.0 完整源码工作树继续构建。Schema6 / DB5 / Seed4 / VIX2 不变。

## Scroll / Position

- 新增 `js/v3-scroll-runtime.js`：DOM-free ScrollCoordinator epoch/owner/phase 与 clamp/stability helper。
- root scroll direct write 收口到两个 UI adapter；旧 epoch 写入拒绝。
- frame snapshot 增加 semantic position：top / entry / section / bottom / scroll fallback。
- transaction active、Navigation traversal active、user root scroll active 时禁止 authoritative scroll snapshot overwrite。
- user touch/momentum 获得 viewport 优先权；普通 tap 不再错误锁死 user-scroll 状态。

## Chrome / LetterNav

- `topChromeBottom()` 成为 Sticky/Letter/reading/semantic restore 的统一 ContentTop。
- active-letter 不再根据 `alphabetNavAttached()` 切换语义边界。
- Letter jump 改用 `.section-flow-anchor` natural coordinate，不再用 Sticky heading visual rect。
- Letter jump 是显式 `letter-jump` transaction；active cell 立即更新，定位完成后统一持久化。

## Virtual Entry Layout

- `ENTRY_CHUNK_SIZE=42`、960px IO 预取、首块立即 materialize、目标 Entry 强制 materialize 保持。
- Virtual Chunk 删除自有 viewport capture/`scrollBy()`；materialization 只生成 DOM、测量、报告。
- IO 命中按 presentation frame 批量 flush。
- live navigation frame 增加 measured chunk-height cache；同 frame rebuild 优先复用真实高度作为 placeholder。
- `ensureEntryRendered(entryId)` 外部合同保持，Search/PIN/Relation 无需理解 chunk 内部实现。

## Back Restore

- 4.5 `destructive-v3`、browserKey/`traverseTo()` 保持。
- legal Navigation API traversal 改为 `intercept({scroll:'manual'})`。
- 先 hydrate/render/准备目标虚拟几何，再调用 `event.scroll()` 作为 UA first pass，最后按 semantic position verify/correct。
- `navigationTraversalInProgress` 延长到 semantic settle 完成，避免中间位置写回 frame。

## Sticky / Visual

- 4.4 Sticky collapse geometry 与无动画 rendering suppression 保持；只增加 ScrollCoordinator lease。
- `renderEntryList()` 的关键 overlay/letter metrics 在 DOM replace 后同步 seal，减少正文已变而 Letter/Sticky 晚一帧更新。
- 不恢复 navigation underlay、whole-app stacking context 或 retained previous page。

## Modal / Search Snapshot Hygiene

- same-Collection Search 仍为位置操作，不建 browser slot。
- cross-Collection Search 在 PUSH 前立即移除 Search layer、恢复 Page geometry，再等待一个 presentation frame，使 WebKit history snapshot 不再主动冻结 closing Search surface。

## Service Worker

- `controllerchange` 仅显式点击“立即更新”并 arm SKIP_WAITING 时 reload；首次 install + `clients.claim()` 不 reload。
- cache generation 升级为 `gual-vocabulary-index-v4.6.0-scroll-ownership-20260810-1`。

## Freeze

- Navigation Automaton、Modal ownership、Sticky collapse product semantics、PIN/Review、Provider/Relation、数据模型全部不重构。
