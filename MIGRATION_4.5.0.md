# Vocabulary Index 4.5.0 迁移

4.4.0 → 4.5.0 **无业务数据库迁移**。

- Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

4.4 `destructive-v2` navigation session/generation 不迁移。4.5 runtime 每次新启动从 Home 建立 `destructive-v3` root/browser key；这只影响页面递归历史，不影响词库、PIN、学习日期、标注、设置或 Undo/Redo。

Service Worker cache generation：`v4.5.0-navigation-rail-20260810-1`。部署必须完整覆盖文件树并等待新 SW 激活。
