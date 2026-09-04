# Vocabulary Index 5.0.0-alpha.6 迁移说明

- 替换尚未正式可用的 alpha.5，不改变 Schema 6、IndexedDB 5 或 Seed revision 7。
- Cloudflare 仍固定使用 `vix-private`，只保留一个 Worker-level Access 应用并保护 All traffic。
- 不再要求或读取 `ctx.access`、Team domain、Application AUD 或 Access JWT；Collins Secret 仍只保存在 Worker 中。
- 已按 alpha.5 新建 Worker 的用户只需上传 alpha.6 触发重新部署，不需要重建 Access 应用或重新填写 Secret。
- 尚未迁移的用户直接按 `DEPLOY.md` 清理旧 `vix-5-alpha2` 后创建稳定 Worker。

