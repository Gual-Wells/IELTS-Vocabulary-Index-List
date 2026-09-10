# Vocabulary Index 4.6.0 审计报告

## 1. 4.5.0 判定

4.5.0 `destructive-v3` Navigation Automaton 不判失败。真机已证明其 page identity / Back / Home / same-Collection / cross-Collection 主体成立。4.6 的缺陷集中在 Navigation 下面的 Scroll / Virtual Layout / Positioning / Visual Commit ownership。

## 2. P0/P1 根因

### 多个 root-scroll owner

4.5 同时存在 Letter jump、Virtual Chunk anchor restore、Entry/Section jump、Back UA restore、Sticky collapse 等写 root viewport 的路径；IO/RO/rAF 又把这些写拆到不同 rendering phase。一次用户意图可被旧异步 correction 覆盖。

### Sticky visual rect 被误作 Letter natural coordinate

LetterNav 使用 `.letter-heading.getBoundingClientRect()` 算目标，而 heading 是 `position:sticky`。其 rect 可能是 normal-flow、吸顶视觉位置或 section-bottom clamp 后的位置，因此不是稳定导航坐标。4.4 已存在的 `.section-flow-anchor` 才是正确 natural-flow coordinate。

### Active-letter 几何回归为双真值

CSS Sticky/reading viewport 使用 Top Chrome + LetterNav；4.5 active-letter 又依据 `alphabetNavAttached()` 决定是否计入 LetterNav，重新制造 4.0.2 已修过的 52px 级边界分叉。

### Virtual Chunk callback 越权

42-row chunk materialization 原来捕获 viewport anchor，并在下一帧调用 `scrollBy()`；合法性仅检查 `renderRevision`。W→X 属于同一 render revision，因此旧 W correction 可以覆盖新 X jump。用户的 direct-X 正常 / A→…→W→X 狂跳是高区分度真机证据。

### UA scroll restoration 被错误提升为最终权威

动态虚拟页面重建时，旧 history scroll 面对的 document height 可能仍是 estimated placeholder geometry。4.5 正常 Navigation-API Back 又跳过 VIX `scrollY` 最终验证，导致重复 traversal 后出现顶部/较早 Entry 错位并可能稳定在错误位置。

### Persistence transaction 边界过短

旧实现用时间抑制与普通 `scrollend` 防中间写入，无法证明 Virtual/UA correction 已经结束；错误中间位置可能成为下一轮 frame snapshot。

### Search history snapshot hygiene

Search 普通 close 保留 closing layer 140ms；cross-Collection history slot 却立即创建。WebKit 在新增 history item 前记录 navigation snapshot，因此 native Back 可冻结 closing Search surface。

### First-install double boot

`clients.claim()` 触发 `controllerchange`；旧页面对任何 `controllerchange` 都 reload，导致首次安装二次启动。

## 3. 4.6 修正

- 新增 DOM-free `v3-scroll-runtime.js`，提供 scroll transaction epoch、owner、phase 与纯几何 helper。
- `v3-ui.js` 中 root viewport 只有 `rootScrollToY/rootScrollByY` adapter 可直接写；stale epoch 写入拒绝。
- LetterNav 目标改为 flow anchor；active-letter 与 Sticky 共用 `topChromeBottom()`。
- 42 Chunk 保留，但 `materializeEntryChunk()` 不再捕获/恢复 viewport；IO materialization 批处理并受 ScrollCoordinator 协调。
- 每个 live navigation frame 增加 measured `virtualLayoutCache`，同 frame rebuild 优先复用真实 chunk height。
- frame snapshot 增加 semantic `position`；Back 改为 `scroll:'manual'`，目标几何准备后调用 `event.scroll()`，随后 semantic verify/correction。
- transaction commit 前禁止 authoritative snapshot persistence。
- Sticky collapse 获得 coordinator lease，几何/提交算法不改。
- Search cross-Collection 使用 immediate close + presentation fence，再进入已有 page PUSH 路径。
- Service Worker controllerchange 仅显式 update armed 时 reload。

## 4. 不在本版伪修的平台现象

当前 WebKit iOS snapshot store 的图片缓存有独立容量上限；native swipe 没有可用 bitmap 时会用 snapshot background。4.6 不恢复 underlay、retained previous page 或 whole-app stacking context。该阶段的纯背景只按平台 preview 边界验收；live VIX correctness 仍归本项目。
