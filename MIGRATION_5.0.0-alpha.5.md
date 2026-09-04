# Vocabulary Index 5.0.0-alpha.5 迁移说明

- Schema 仍为 6，IndexedDB 仍为 5，Seed revision 仍为 7；已有设备不重建词库。
- Cloudflare 旧 `vix-5-alpha2` Worker、旧 Worker-level Access 应用和误建的 hostname Access 应用全部废弃。
- 新部署固定使用 `vix-private`，只保留一个 Worker-level Access 应用。
- Collins Secret 需在新 Worker 中重新保存一次；之后由 `keep_vars` 保留。
- 全新设备或此前初始化中断的设备会使用可续传的分批 Seed 导入。

