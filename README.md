# Vocabulary Index 5.0.0-alpha.3

本包是以 VIX 4.7.3 为稳定交互基线完成的统一架构升级，不再是单独的 D3 试验包。D、A、C、B、E 五条路线已经在同一版本中兼并：Provider、Mirror/抑制、Seed5、Session Capsule/后端桥接，以及发布权威收口。

## 当前版本权威

- App：`5.0.0-alpha.3`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`6`
- VIX JSON：`2`
- Navigation：`single-slot-vix-v1`
- Session Capsule：`vix-session-capsule/2`
- Runtime Seed：`vix-seed-runtime/1`

版本常量集中在 `js/v5-version.js`；`package.json`、页面元数据、Service Worker 和数据报告必须与其一致。

## 五条路线的正式状态

| 路线 | 已交付内容 |
|---|---|
| D | 统一 Provider Runtime；Groq 维持浏览器直连；Collins 固定二选一 Registry，浏览器只请求同源 Worker Bridge，正式 Key 仅存 Worker Secret；临时结果不进入词库/备份。 |
| A | Structural Projection 先生成，Mirror/逻辑抑制再形成 Effective Projection；`suppressionRevision` 独立；CURRENT 持久化、ACTIVE 仅内存，CURRENT 到达不会热替换 ACTIVE。 |
| C | Seed5 的 13 个通用英语集合：A1/A2/B1/B2/C1/C2/NAWL/COCA 5000/COCA 10000/CET 4/CET 6/TEM 4/TEM 8；质量合格的社区材料广泛纳入，来源、许可和 SHA-256 保留。 |
| B | slot-only Session Capsule；Entry ID 不离开本机；可下载离线交换，也可经同源 Durable Object Bridge 发布/回收；capability token 只以 hash 存储。 |
| E | alpha.2 单一版本权威、Seed 分片、部署安全边界、自动/人工闸门、迁移与回滚说明。 |

## Seed5 策略

Seed5 采用“质量门槛后多多益善”，而不是“只有官方资料才能进入”：

- 规范化、空值/明显无效项过滤、同域精确去重；
- 同一个词可保留多个集合归属，不把交叉来源压成单一标签；
- 官方、发布方认可镜像、社区转录、社区汇编明确区分；
- 原始来源 pin、SHA-256 与许可记录在 `data/sources/seed5/SOURCE_MANIFEST.json`；
- 面向部署者的来源、署名与使用边界汇总见 `SEED5_ATTRIBUTIONS.md`；
- 构建结果为 22,910 Entry、60,857 Membership，详见 `data/seed-report.json`。

完整 `data/seed.json` 用于构建和审计。线上运行读取 `data/seed5-runtime/manifest.json` 及其 SHA-256 分片，单个文件约 4 MiB，避免 Cloudflare 25 MiB 静态资源上限。

## 数据升级

已有 Seed4 设备启动 alpha.2 时执行 Seed4 → 当前设备 → Seed5 三方合并：

- 用户新增的域、词表、词条和 Membership 保留；
- 用户改过的内置字段优先于 Seed5；
- 用户明确删除的旧内置记录不会被重新添加；
- PIN、批注、学习日期和有效上次位置保留；
- 写主库前在独立 IndexedDB 中保存迁移快照；主库写入是单事务，失败自动回滚；
- 匹配的旧记录保持本机 ID，避免引用断裂。

详见 `MIGRATION_5.0.0-alpha.3.md`。

## 部署边界

推荐使用 Cloudflare Worker + Static Assets。纯 GitHub Pages 可以测试本地词库、Mirror 文件交换和 Groq，但无法提供 `/api/collins/lookup` 与远程 Session Bridge，因此 Collins 在纯 Pages 上失败是预期行为。

不要把 Collins Key 写进仓库、浏览器设置、URL 或普通 Wrangler `vars`。使用 `COLLINS_ACCESS_KEY` Secret，并在生产域前配置 Cloudflare Access。Worker 会验证 Access JWT 的 RS256 签名、team-domain issuer 与 Application Audience；伪造同名请求头不能通过。完整步骤见 `DEPLOY.md`。

## 验证

```bash
npm run test:all
```

本包还提供 Seed5 三方迁移、分片篡改拒绝、Worker capability/预算、Mirror/Session 和真实 Chromium 402×874 布局测试。iPhone 与真实外部账号闸门见 `tests/MANUAL_CHECKLIST.md`。

旧 `PROVIDER_RUNTIME_D1.md`、`D2`、`D3` 以及 4.x 文档保留为历史证据，不再描述当前运行架构。
