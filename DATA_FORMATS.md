# Vocabulary Index 4.6.0 数据格式

> 4.6.0 runtime note：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2 与 4.5.0 完全相同。本版重构 Scroll/Position/Virtual Layout ownership；Seed、完整备份和 VIX 内容交换格式无迁移。

## 版本

- Backup Schema：6
- IndexedDB：5
- Built-in Seed revision：4
- VIX JSON：2

`schemaVersion` 必须为 6。4.6.0 可读取同一 Schema6 世代完整备份；不同 schema 世代继续拒绝隐式导入。

## Runtime state 不进入数据格式

以下均不属于 Seed / Full Backup / VIX：

- `destructive-v3` navigation token / browserKey / deadBrowserKeys；
- ScrollCoordinator epoch / owner / phase；
- frame `position` semantic reading snapshot；
- frame-local measured `virtualLayoutCache`；
- Sticky compositor transaction；
- Modal presentation stack。

4.6 不跨进程恢复 recursive navigation 或 measured virtual geometry；PWA runtime restart 从 Home 建新 root，不影响业务数据库。
