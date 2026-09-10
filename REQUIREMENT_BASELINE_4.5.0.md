# Vocabulary Index 4.5.0 需求基线

## 1. 更新性质

4.5.0 是 4.4.0 真机导航失败后的 **Navigation Architecture Correction**。不扩大产品边界，不改变业务数据世代，不重做已经通过真机的 Sticky/Modal。

冻结世代：Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 真机已确认事实

4.4.0 在目标 iPhone standalone PWA 中出现：

- 左上 Back 完全无效，只有按压触感/UI反馈；
- 左边缘可拖出上一页静态视觉面，但慢拖不会进入，快拖会进入后数秒再次回当前页；
- 多次回撤后 preview 会逐步指向更老 history surface，深链最终可出现纯背景页；
- preview 期间页面完全不可交互，符合 UA history visual surface 而非 live VIX DOM；
- Home 可以稳定进入首页，但 4.4 Home 的新 root PUSH 导致物理 rail 与逻辑栈继续分裂；
- 同 Collection Search 也错误创建 browser history；
- 新跨页跳转偶尔出现明显整页/字母栏闪现；
- kill PWA 后重新启动应从 Home 开始，不要求跨进程恢复 recursive stack。

## 3. 页面身份

**Collection 是递归 page/frame 的唯一边界。**

以下都不是新 page：

- word ↔ phrase；
- alphabet ↔ date；
- calendar month；
- expanded groups / relations；
- current scroll；
- Search / Relation / PIN / Annotation 在当前 Collection 内的定位；
- 同 Collection 内因目标 Entry 类型而发生的 word/phrase 切换。

只有跨 Collection 才允许 `PUSH_PAGE`。

## 4. 三层 ownership

### VIX Automaton

拥有业务语义：

- `PUSH_PAGE`
- destructive `POP_PAGE`
- `HOME_CLEAR`
- `VIEW_CHANGE`
- `POSITION_JUMP`

Root 不属于 recursive frames。

### Browser Rail Adapter

仅拥有：

- 建立一个 same-document history slot；
- 保存该 slot 的 UA identity `NavigationHistoryEntry.key`；
- `traverseTo(key)` 精确 traversal；
- 对 dead Forward / root-left gesture 做最早可行 guard。

### Renderer

只消费 Navigation Controller 已提交状态。Renderer 无权 PUSH/POP/CLEAR，也不得根据 URL/hash 反向销毁栈。

## 5. Identity Contract

每个 frame：

```text
{
  token,       // VIX immutable logical identity
  browserKey,  // UA session-history slot identity
  collectionId,
  viewKind,
  snapshot
}
```

禁止：

- 用 `depth` 作为身份；
- 用 `history.state` 与 `NavigationHistoryEntry.getState()` 交叉读取同一 identity；
- identity mismatch 后退化猜 `stack[depth-1]`；
- runtime 中持续 `replaceState()` 改 live entry。

## 6. PUSH Contract

真实跨 Collection PUSH 必须在明确用户导航命令的同步调用栈内创建 browser entry。

禁止在 PUSH 前：

- `await` IndexedDB/settings；
- 等 Modal 退出；
- `setTimeout()`；
- 70ms page transition；
- 其他异步 presentation work。

Home→Collection 的 alphabet reset 必须先同步 hydrate memory，PUSH/render 后再持久化。

## 7. Back Contract

App Back：

```text
C -> traverseTo(B.browserKey)
A -> traverseTo(rootBrowserKey)
```

不得再用 `history.back()` 作为目标平台主实现。

Native iOS Back 可以由 Safari 启动；只有 destination key 对应 live ancestor/root 才是合法 traversal。

**destructive POP 只能在 navigation commit 后发生。** 半拖取消不得改变 VIX stack。

## 8. Home Contract

Home 从任意深度精确 traverse 到启动时 root key。

commit 后：

- 清空全部 recursive frames；
- 将旧 frame browser keys 标记为 dead Forward；
- 不清业务数据、PIN、StudyStamp、Annotation、Undo/Redo、设置；
- Home presentation 回到 structured + top。

不允许再 PUSH 新 root。

下一次 Home→D fresh PUSH 由浏览器自然截断旧 dead Forward branch。

## 9. Forward Contract

逻辑保证：dead page 永远不得重新成为 VIX live frame。

视觉保证受 Safari system gesture 能力限制：

- right-edge non-passive touchstart guard 是第一层；
- cancelable `navigate` event `preventDefault()` 是第二层；
- 若 UA 发起不可取消 traversal，只允许恢复当前 live key，不得 render dead snapshot。

不得把“绝不出现一帧 UA preview”写成产品可证明保证。

## 10. Scroll Contract

合法 Navigation API Back 使用 `intercept({scroll:'after-transition'})`：

1. VIX 同步 hydrate 目标 frame presentation；
2. render 一次；
3. UA 恢复该 history slot 的物理 scroll。

Home 使用 manual scroll 并回 top。

## 11. 4.4 Freeze

4.5 不改变：

- Flow-anchor Sticky；
- View Transition rendering suppression Sticky path；
- Modal root geometry ownership；
- `#app.inert` 当前策略；
- whole-app stacking context 已撤销状态；
- PIN/Review Dock；
- Provider/Search/Relation业务语义；
- Entry视觉体系。

## 12. 验收边界

桌面自动化验证逻辑/静态契约；iPhone 真机验证：

- interactive swipe Back 的连续视觉；
- half-cancel 不改栈；
- `entry.key`/`traverseTo` 在目标 standalone 的真实 rail 行为；
- dead Forward guard 的系统 preview 边界；
- UA after-transition scroll restoration。
