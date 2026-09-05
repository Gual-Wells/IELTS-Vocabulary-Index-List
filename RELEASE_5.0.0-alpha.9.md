# Vocabulary Index 5.0.0-alpha.9 发布说明

本版针对 Collins 在线查词加入可直接在 VIX 中读取的安全诊断，并扩展一次有界边缘拦截重试。

- 首次请求沿用带产品标识的服务端身份。
- `cf-mitigated: challenge` 或 HTML 403 才会触发一次 `Cloudflare-Workers` 备用身份请求。
- JSON 401/403 不盲目重试。
- 失败类型区分为授权、权限拒绝、边缘拦截、challenge、格式、网络、重定向与限流。
- 每次用户查词仍只扣一次 VIX 月度账本额度。
- Secret 只在 Worker 的 `accessKey` 请求头中使用；诊断只含状态、MIME、尝试次数、策略、challenge 标记和 Cloudflare Ray ID。
- Cloudflare Workers Logs 的持久化、全量采样与查询串脱敏写入版本无关的仓库配置。
- Wrangler 部署前自动执行前端构建，避免未提交 `dist/` 时 Worker 已更新而 PWA 仍停留在旧版本。
