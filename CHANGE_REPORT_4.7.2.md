# Vocabulary Index 4.7.2 变更报告

## 核心变更

1. App/package/SW 升级到 4.7.2；cache generation：`v4.7.2-switch-contract-repair-20260811-1`。
2. 新增 `css/v4.7.2.css` 作为 runtime-only release marker；视觉规则继续继承 4.7.1，无新增视觉参数。
3. 删除 active manual switch 对 `transientModeSwitchAnchor()` / `transientViewSwitchTarget()` 的依赖，并移除相关 nearest-group helper。
4. Word/Phrase 手动切换恢复目标 TOP + collapsed；Date 使用目标 view 自身 calendar month。
5. Alphabet/Date 手动切换恢复目标 TOP + collapsed；进入 Date 使用目标数据 latest-valid-month。
6. same-Collection target跨 Word/Phrase 只在 hidden buffer 中执行一次 Entry semantic landing；删除 buffer 后第二次 `jumpToEntry()`。
7. 抽取 `entryJumpSemanticPosition()`，统一普通 Entry jump 与 hidden target 的阅读锚点几何。
8. 增加 `enqueuePresentationIntent()`，Collection navigation、Back、Home、View/Mode toggle串行执行；删除 busy-time silent return。
9. View toggle执行时计算 next kind，连续点击不使用陈旧闭包 target。
10. Buffer期间仅 Collection content + 非切换底栏工具 inert；View/Mode toggle保持可排队。
11. View/Mode commit加入失败回滚。
12. runtime tests从“要求 transient anchor / 禁止 TOP”反转为“要求 TOP + collapsed / 禁止 transient anchor / 禁止 same-target double jump”。
13. 生命周期文档明确：Single Browser Slot继续保留，但其相对4.6 destructive-v3的差异为独立待决项。

## 未变更

- Schema6 / IndexedDB5 / Seed4 / VIX2；
- 4.7.0 Push；
- 4.7.1 Pop / Root Buffer / LetterRail / Modal / Relation reveal；
- Search/Relation 数据模型与 Provider/PIN/StudyStamp/Annotation规则；
- 当前 Single Browser Slot implementation。
