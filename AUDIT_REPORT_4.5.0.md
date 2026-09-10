# Vocabulary Index 4.5.0 审计报告

## 1. 4.4 Navigation 判定

4.4.0 `destructive-v2` 整体判为失败实现，不继续叠加条件分支。主要问题不是一个 Safari 小毛病，而是 browser rail、VIX stack 和 presentation page identity 三个模型同时错位。

## 2. 4.4 P0 根因

### Classic state / Navigation state 混用

4.4 用 `history.pushState()` 写 `history.state.navToken`，却用 `event.destination.getState()` 判断目标。两者不是同一状态面，合法 Back 被 stale classifier 错判并 `preventDefault()`。

### Home 方向错误

在 C 上 PUSH 新 ROOT 得到 `ROOT-A-B-C-ROOT2`，不会把 A/B/C 变成 Forward，因此没有实现 destructive Home。

### 双 traversal owner

`navigate` + `popstate` 同时处理一次 traversal，再靠 token + 1200ms timeout 消重，属于竞态抑制，不是状态机。

### Renderer 越权

4.4 `renderApp()` 根据 root URL/hash 反向执行 destructive root convergence。Renderer 不应拥有导航状态修改权。

### Identity fallback 猜测

4.4 current frame token 匹配失败后可回退 `stack[depth-1]`，会把 snapshot 写入错误 frame。

### Page identity 过细

同 Collection Search / word-phrase 目标被当成新递归页，真机明确暴露额外 history slot。

### PUSH 过晚

Home 入口先 await setting；Search 先等待 Modal exit timer，再 PUSH。对 iOS history anti-hijacking 语义不可靠。

### Orphaned 70ms page transition

CSS 已关闭 page opacity transition，但 JS 仍延迟 70ms 才重建 Collection，制造 stale visual commit 窗口。

## 3. 4.5 修正

- Navigation model：`destructive-v3`。
- Root key 在 runtime boot 后捕获。
- Frame 记录 `browserKey`；Back/Home 通过 `traverseTo(key)`。
- browser destination classifier 只读 `destination.key`，不读 `getState()`。
- `history.state` 仅服务 classic fallback；目标 Safari 不用它判断 destination。
- runtime `replaceState()` 只保留 boot root 初始化一次。
- same Collection 定位与 view change 不建 browser slot。
- Navigation API / popstate 二选一注册。
- destructive POP/CLEAR 只发生在 committed handler。
- Search 选择移除 140ms 后导航；真实跨页 PUSH 保留在点击 activation。
- page transition 70ms timer 删除。

## 4. 仍属平台边界

Web App 无法证明 Safari interactive history preview 永远不显示 dead surface；4.5 只保证 dead surface 不被 VIX 重新激活。该视觉边界必须真机验收。
