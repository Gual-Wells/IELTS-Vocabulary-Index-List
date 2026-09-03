# Vocabulary Index 5.0.0-alpha.4 迁移说明

本版保持 Schema 6、IndexedDB 5 与 VIX JSON 2，仅把 Built-in Seed revision 从 6 升到 7。

已有设备首次启动 alpha.4 时会执行三方合并：保留用户新增、编辑、删除、PIN、标注、学习日期与有效位置，同时补入 Seed 7 条目。迁移前仍会创建本地快照，失败时不提交半成品。

无需删除或重新安装 PWA。上传新版本并让 Cloudflare 构建成功后，打开现有 PWA；出现更新提示时确认更新，或彻底关闭后重新打开。

Cloudflare Worker 名仍为 `vix-5-alpha2`。不要新建版本号 Worker，也不要重新填写已经存在的 Secret 或 Access 配置。
