# Vocabulary Index 4.5.0 数据格式

> 4.5.0 runtime note：Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2 与 4.4.0 完全相同。本版只重建 Navigation runtime；Seed、完整备份和 VIX 内容交换格式无迁移。

## 版本

- Backup Schema：6
- IndexedDB：5
- Built-in Seed revision：4
- VIX JSON：2

`schemaVersion` 必须为 6。4.5.0 可读取同一 Schema6 世代完整备份；不同 schema 世代继续拒绝隐式导入。

## Runtime state 不进入数据格式

以下均不属于 Seed / Full Backup / VIX：

- `destructive-v3` navigation token；
- `NavigationHistoryEntry.key`；
- `rootBrowserKey` / `deadBrowserKeys`；
- Sticky compositor transaction；
- Modal presentation stack。

4.5 不再跨进程恢复 recursive navigation stack；PWA runtime restart 从 Home 建新 root，不影响业务数据库。
