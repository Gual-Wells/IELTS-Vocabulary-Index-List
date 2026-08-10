# Vocabulary Index 4.7.0 迁移说明

## 数据迁移

无。4.7.0 继续使用 Backup Schema 6 / IndexedDB 5 / Built-in Seed revision 4 / VIX 2。

4.6.0 的用户词库、Membership、PIN、StudyStamp、Annotation、Undo/Redo、Provider 设置与同世代 Full Backup 可直接沿用。

## Runtime 迁移

4.7 发生的是 presentation/navigation runtime 断代：

- 4.6 `destructive-v3 + Safari History Rail` 不再恢复；
- cold launch 仍从 Home 建一个新的 single browser root slot；
- recursive VIX stack、semantic position、measured virtual-layout cache 仍全部 runtime-only；
- 4.6 浏览器 history slots 即使仍存在于旧 process，也不会被 4.7 active runtime继续映射为 VIX page identity；重新关闭/启动 PWA 即进入新 single-slot runtime；
- 4.7 motion epoch / semantic axis / LetterRail manual lock 都不进入数据库或备份。

## 状态语义迁移

不迁移隐藏 Word/Phrase/Alphabet/Date 页面状态。普通切换永远重新初始化目标 TOP+collapsed；只有当前页面在递归离页时形成 Back Frame。

## 回滚

数据世代未变，理论上可回滚到同 Schema6 世代源码；但 4.7 runtime navigation/motion state 会自然丢失。发布/回滚前仍应关闭旧 standalone process 并重新打开，避免旧 Service Worker shell 与新源码混装。
