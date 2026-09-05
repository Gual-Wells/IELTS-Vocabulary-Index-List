# Vocabulary Index 5.0.0-alpha.8 迁移说明

- 从 alpha.7 更新时，只需把完整包内容覆盖到 GitHub 仓库并等待 `vix-private` 自动部署成功。
- 不需要重建 Cloudflare Worker 或 Access 应用，不需要重新填写 `COLLINS_ACCESS_KEY`，也不需要修改 Durable Objects。
- 不需要删除并重装主屏幕 PWA；重新打开后让 Service Worker 获取新版本即可。
- 登录后访问 `/api/health`，确认版本为 `5.0.0-alpha.8` 且状态为 `ok`，再进行 Collins 真实查词。
- 如果仍显示 `upstream_challenge`，请从 Worker Observability 日志保存失败记录中的 `cfRay`；该记录不包含密钥、查询词或响应正文。
