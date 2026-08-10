# Vocabulary Index 4.5.0 本地架构

## Runtime ownership

### Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与 Navigation runtime 完全分离。

### Navigation Controller

`destructive-v3`：

- Root 不是 recursive frame；
- `navigationStack` 只保存 live Collection frames；
- frame `token` 是 VIX logical identity；
- frame `browserKey` 是 UA session-history slot identity；
- `deadBrowserKeys` 记录 destructive POP/Home 后仍可能物理存在于 Forward rail 的旧 slot；
- restart 不恢复 recursive stack。

### Browser Rail Adapter

目标 Safari 使用：

- `history.pushState()`：只在真实跨 Collection user action 中同步创建 same-document slot；
- `navigation.currentEntry.key`：捕获新 slot identity；
- `navigation.traverseTo(key)`：App Back/Home；
- `navigate` event：唯一 traversal owner；
- `intercept({scroll:'after-transition'})`：合法 Back 在目标 DOM 建立后交给 UA 还原 scroll。

`popstate` 仅用于无 Navigation API fallback。

Runtime 不持续 rewrite slot。唯一 `history.replaceState()` 位于 boot：先把当前 runtime 归一为 Home root，再捕获 `rootBrowserKey`。

### Renderer

`renderApp()` 只消费 `currentCollectionId/currentViewKind/pendingPageSnapshot`。URL/hash 不得反向执行 PUSH/POP/Home。

### Presentation

4.4 已验证并冻结：

- native Sticky + flow anchor；
- long displacement rendering suppression；
- retained Modal 不改 root scroll geometry；
- whole-app stacking context 已撤销；
- PIN/Review persistent docks。

## Page identity

Collection = page。

word/phrase、alphabet/date、calendar、expanded state、scroll、Entry target = frame presentation state。
