# Vocabulary Index 4.0.1 迁移说明

4.0.1 是 4.0.0 的无数据迁移运行时更新：Schema 6、IndexedDB 5、Seed revision 4、VIX 2 全部保持。

- 4.0.0 → 4.0.1：直接升级 Service Worker/App shell，不清除内容或个人状态。
- 3.5.x → 4.0.1：仍执行 4.0.0 建立的内容世代替换流程；旧 VIX v1/旧 Full Backup 不导入。
- 4.0.1 导出的 Full Backup 仍为 Schema 6；VIX 仍为 v2。
