# Vocabulary Index 5.0.0-alpha.6 发布说明

- 根因修复：Cloudflare Workers Static Assets 的内部路由器会执行 Access，但不会把 `ctx.access` 传给用户 Worker；alpha.5 的重复检查因此会拒绝所有已登录 API 请求。
- 删除 Worker 内部 Access 会话检查，认证只由 Worker-level Cloudflare Access 在边缘执行。
- 保持单一、版本无关的 `vix-private` Worker 与 Access 应用。
- Collins Key 继续只存于 `COLLINS_ACCESS_KEY` Secret；固定词典、单请求、月度硬限额与安全渲染不变。
- Pages 自动静态降级、Cloudflare `dist/` 发布边界、首次 Seed 分批恢复与轻量 Service Worker 缓存策略保持不变。

