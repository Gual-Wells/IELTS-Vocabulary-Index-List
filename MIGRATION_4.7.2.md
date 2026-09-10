# Vocabulary Index 4.7.2 迁移说明

## 数据迁移

无。Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2 全部不变。

## Runtime 迁移

从 4.7.1 升级必须完整覆盖文件树。不能只替换 `js/v3-ui.js`，因为版本标识、Service Worker、测试契约与生命周期文档均同步变化。

Service Worker cache generation：`gual-vocabulary-index-v4.7.2-switch-contract-repair-20260811-1`。

## Presentation 迁移

- `css/v4.7.1.css`仍承载 Pop/LetterRail/Modal 等视觉修订；
- `css/v4.7.2.css`无新增视觉规则，只标记 4.7.2 runtime-only corrective layer；
- Buffered State Commit继续存在，但手动 View/Mode 的完成态重新为 TOP + collapsed；
- 不得继续使用 4.7.1 transient neighborhood 测试预期。

## 行为迁移

升级后用户应观察到：

- Word/Phrase 手动切换回顶部并收起目标组；
- Alphabet/Date 手动切换回顶部并收起；
- Date 初始月份重新按目标数据最新有效月份；
- 精确 Search/Relation target仍直接落到目标 Entry，但只执行一次 semantic landing；
- 快速 View/Mode 连点进入串行队列，不再因 busy flag静默丢失。

## 回滚

如回滚 4.7.1，必须完整回滚 JS / CSS / SW / tests / lifecycle docs。禁止保留 4.7.2 tests 却运行 4.7.1 transient-anchor实现。
