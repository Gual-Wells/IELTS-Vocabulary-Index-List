# Vocabulary Index 4.7.2 技术核验记录

## 1. 本轮证据类型

4.7.2 的核心问题是版本合同回归，不需要为结论引入新的外部动画理论。主要证据来自同一仓库的历史源码：

- 4.6.0 commit：`4e6714062520e199806dae1893b2395312814c7b`；
- 4.7.0 commit：`afbd387554e14e95f398a1ab88bbe927ed3203ea`；
- 4.7.1 commit：`7878ec4ddd2fdfeae530db4504178a9eccb5132a`。

4.6 `js/v3-ui.js` 明确给出手动 View/Mode fresh snapshot 的 `position:top`、`scrollY:0`、`expandedGroups:[]`；4.7.1 则把它替换为 transient semantic neighborhood mapping。

## 2. Presentation 与 Semantic State 分层

本版采用一个更严格的工程分层：

- **Semantic Transition Core** 决定目标 view/mode/month/expanded state/position；
- **Buffered Presentation Wrapper** 只决定什么时候隐藏 old、什么时候 reveal new；
- Buffer 不拥有重新定义 semantic target 的权限。

这一分层允许继续利用 4.7.1 解决 snapshot overlap 的成果，同时恢复 4.6 既定完成态。

## 3. One Semantic Position

same-Collection target 跨 Word/Phrase 时，4.7.1 同时存在 hidden `restoreTransientSemanticPosition()` 与 buffer 后 `jumpToEntry()`。4.7.2 将 Entry 标准 reading anchor 抽成 `entryJumpSemanticPosition()`：

- 普通 `jumpToEntry()` 使用它；
- hidden buffered target 也使用它；
- 一个用户 target action只执行一次 root semantic landing。

## 4. Intent serialization

简单 `busy → return` 会把输入吞掉。4.7.2 使用 Promise tail 形成单进单出 intent queue：

- 前一个 presentation 完成后才执行下一个；
- rejection不会破坏后续 queue；
- View/Mode toggle在执行时读取实时 current state，避免陈旧目标；
- queue只解决并发/丢意图，不把多次用户点击合并成一个隐式动作。

## 5. Failure containment

手动切换把核心状态写入尽量集中到 hidden update 内。View switch 无持久层写入，失败时恢复 previous frame；Mode switch涉及 store mode/month，失败时 best-effort 写回 previous state。

## 6. 未裁决架构项

`single-slot-vix-v1` 与 4.6 `destructive-v3` 的差异不属于本次工程补丁。4.7.2 文档将其从“默认等价”改为“显式待决”，避免生命周期再次把后续实现自动合法化为旧合同的延续。
