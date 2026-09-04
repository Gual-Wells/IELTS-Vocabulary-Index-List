# Vocabulary Index 5.0.0-alpha.7 迁移说明

- 从 alpha.6 更新：只上传仓库内容并等待 `vix-private` 自动部署。
- 不要删除或重建现有 Worker、Cloudflare Access 应用、Durable Objects 或 `COLLINS_ACCESS_KEY` Secret。
- PWA 会通过新的 Service Worker cache generation 自动更新；不需要删除主屏幕图标或清空本地词库。
- 更新后先确认 `/api/health` 显示 `5.0.0-alpha.7` 与 `status: ok`，再测试 Collins。
- 如果 Collins 显示“官方防护拦截”，说明 VIX 与私域认证均已工作，但 Collins 上游拒绝了服务器请求；重复刷新不能修复该状态。
