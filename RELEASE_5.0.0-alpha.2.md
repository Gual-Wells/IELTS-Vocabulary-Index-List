# 5.0.0-alpha.2 交付报告

D/A/C/B/E 已兼并为一个可部署候选包。自动闸门覆盖模型、迁移、分片完整性、Provider、Worker、Mirror/Session、导航、压力、性能与 Chromium 布局。Cloudflare 真实账号、Collins 真实授权和 iPhone standalone 是外部人工闸门，状态为 `NOT_RUN`，不能伪报通过。

## 指标

- Seed5：3 Domain、24 Collection、22,910 Entry、60,857 Membership、18,168 RelationComponent。
- 通用英语：21,739 Entry，其中 15,644 word、6,095 phrase。
- 13 个通用集合全部具有来源 Membership。
- Runtime Seed：1 个 meta + 9 个数据分片，最大约 4 MiB，逐片 SHA-256。
- VIX collection import preflight：本机约 3.9 秒（Seed5 全量背景）。

## 安全边界

- Collins Key 仅在 Worker Secret；浏览器旧 Key 会被清除。
- 生产 Collins/Session 创建受 Cloudflare Access 保护；Worker 进一步验证 JWT 的 RS256 签名、team-domain issuer、AUD 与有效期，不能用伪造头绕过。
- Collins 有 Registry、输入上限、一次上游请求、月度硬预算。
- Session capability 只存 hash；write token 一次性；过期 alarm 删除数据。
- `/api/*` 不进 Cache Storage；响应 `no-store`。

## 外部闸门

- `NOT_RUN`：真实 Worker 部署与 Access 会话。
- `NOT_RUN`：真实 Collins 两本授权词典查询与配额行为。
- `NOT_RUN`：iPhone 17 Home Screen standalone 全清单。
- `NOT_RUN`：两台设备远程 Session Capsule 往返。

自动闸门及实测数据见 `TEST_REPORT_5.0.0-alpha.2.md`。
