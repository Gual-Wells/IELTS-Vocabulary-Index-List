# Vocabulary Index 5.0.0-alpha.5 发布说明

- 修复 Collins Bridge 被内部 AUD 校验误判为 401 的问题；防御性检查改用 Worker-level Access 提供的 `ctx.access`。
- 新增 `/api/capabilities` 与 `/api/health`。
- Pages 与私域 Worker 自动识别，Pages 不显示不可用的 Collins 入口。
- Worker 名固定为 `vix-private`；移除版本号、Team domain 与 Application AUD 配置。
- Cloudflare 静态发布改为 `dist/` 明确允许列表。
- 全新 Seed 导入改为 1000 条一批、带进度、可恢复。
- Service Worker 改为仅预缓存应用壳，Seed 分片按需缓存。
- Seed 内容与 revision 7 保持一致，仅同步应用版本元数据。
