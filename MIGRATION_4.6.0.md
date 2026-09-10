# Vocabulary Index 4.6.0 迁移说明

## 数据迁移

无。4.6.0 继续使用 Backup Schema 6 / IndexedDB 5 / Built-in Seed revision 4 / VIX 2。

4.5.0 的用户数据库、PIN、StudyStamp、Annotation、Undo/Redo、Provider 设置与同世代完整备份直接沿用。

## Runtime 迁移

4.6 只更换运行时 ownership：

- recursive Navigation runtime 仍不跨 PWA process 恢复；cold launch 从 Home 建新 root；
- measured virtual-layout cache 仅属于当前 live VIX frame，POP/Home/kill 即销毁；
- semantic position 属于 runtime frame snapshot，不进入 Full Backup/VIX/Seed；
- Service Worker cache generation 升级，cache bridge 会清旧 shell，避免 4.5/4.6 资源混装。

## 回滚

由于数据世代未变，回滚到同 Schema6 世代的 4.5.0 不需要数据 conversion；但 4.6 runtime-only semantic position / measured cache 会自然丢失。发布前仍建议保留完整备份，并关闭同源旧 standalone/tab，避免旧 SW shell 并存。
