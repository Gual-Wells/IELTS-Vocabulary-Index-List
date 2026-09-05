# Vocabulary Index 5.0.0-alpha.8 架构

alpha.8 仅调整 Worker 到 Collins 的上游请求策略：主请求携带明确的 VIX 服务端标识；只有 `cf-mitigated: challenge` 才进行一次备用透明标识重试。配额在尝试前只扣减一次，鉴权仍只通过 `accessKey` 请求头传递，禁止查询参数密钥、浏览器伪装、自动重定向与无限重试。

Collins Bridge 只能转发 Collins 官方 REST API；若上游返回 `cf-mitigated: challenge`，Worker 会以 `upstream_challenge` 失败关闭并写入脱敏日志，不保留挑战页、不泄露 Secret，也不尝试绕过服务防护。

## 发布拓扑

```text
GitHub Pages                         Cloudflare Worker: vix-private
公开静态壳                           单一 Cloudflare Access 边界
├─ 本地 IndexedDB                    ├─ 同一静态壳与 IndexedDB
├─ Groq（用户自己的 Key）            ├─ Collins Secret + 月度额度
└─ 文件式 Mirror                     └─ Durable Objects Session Bridge
```

前端调用同源 `/api/capabilities`。有效 JSON 表示私域 Worker；404、HTML、超时或网络失败都安全降级为静态形态。

## Cloudflare 边界

- Worker 名固定为 `vix-private`，不包含版本号。
- 只创建一个 Worker-level Access 应用，并覆盖 All traffic。
- Access 在请求进入 Worker 前完成身份验证，是私域版唯一的认证边界。
- Workers Static Assets 会经过 Cloudflare 的内部资源路由器。该路由器会执行 Access，但不会把 `ctx.access` 传给用户 Worker；因此应用代码不再做第二次 `ctx.access`、JWT、JWKS 或 AUD 检查。
- 私有性由 Worker-level Access 配置保证。若关闭这个 Access 应用，Worker 与 API 都会变成公开状态，因此部署验收必须确认 Access 已启用且未登录窗口首先出现登录页。
- `COLLINS_ACCESS_KEY` 只存在于 Worker Secret；前端、Pages、备份和 Cache Storage 都不含该值。
- `/api/health` 与 `/api/capabilities` 位于同一个 Access 边界内，只返回布尔配置状态，不返回 Secret。

## 发布内容边界

`wrangler.jsonc` 的静态目录是 `dist/`。`tools/build-dist.mjs` 使用明确允许列表构建该目录：

- HTML、manifest、Service Worker；
- `css/`、`js/`、图标；
- Runtime Seed 分片、Seed4 迁移基线、低级词汇关联表。

源数据、报告、测试、工具、Worker 源码和本地环境文件不会作为静态资源发布。

## 首次初始化

- Runtime Seed 仍逐片校验字节数与 SHA-256。
- 约十万条 IndexedDB 记录按 1000 条一批提交。
- 每批把进度写入 `seedImportState`；页面被关闭后可从最后一个完整批次继续。
- 只有全部数据写完后才写入 `schemaVersion` 与 `initialized`，所以半成品不会被误认为可用数据库。
- Service Worker 只预缓存应用壳；Seed 分片在实际读取时按需缓存，不再用一次 `cache.addAll` 下载约 41 MiB 数据。

现有 alpha.4 设备的 Schema、DB 与 Seed revision 未变，不会重导 Seed；只更新应用壳与运行逻辑。
