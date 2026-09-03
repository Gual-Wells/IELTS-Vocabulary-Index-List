# Vocabulary Index 5.0.0-alpha.2 架构

## 产品骨架

4.7.3 的 single-slot navigation、ScrollCoordinator、Atomic Visual Commit、Stable Relation Row、42 Entry / 960 px 双向虚拟化、LetterRail、retained Modal 与 iPhone 视觉体系继续作为 UI 基线。alpha.2 的新增 UI 使用已有颜色变量、圆角、边框、safe-area 和 motion policy。

## 数据投影

```text
Schema6 / DB5 / VIX2
          │
          ├─ Structural Projection（事实 Membership + 优先级占有）
          │          │
          │          └─ Suppression Runtime（OR reasons / 独立 revision）
          │                         │
          └─────────────────────────┴─ Effective Projection
                                      └─ UI / Search / Relation presentation
```

Mirror CURRENT 持久化，ACTIVE 只存在于当前运行会话。ACTIVE 开启后，新的 CURRENT 不会热替换；必须关闭再开启。有效空 Mirror 与缺失/损坏严格区分。

## Seed 与迁移

完整构建物是 `data/seed.json`；Seed4 公共祖先是 `data/seed-4.json`。运行时通过 `data/seed5-runtime/manifest.json` 加载分片，每片校验 byte length 和 SHA-256，重组后再做 Schema6 canonicalization。

升级使用字段级三方合并。Seed 只覆盖用户没有改动的内置字段；用户记录、删除和内容绑定状态优先。迁移快照存于独立数据库 `vix-seed-migration-backups-v1`。

## Provider 与 Session

- Groq：现有浏览器 Provider Runtime，用户 Key 保留在本地。
- Collins：固定两本词典；前端只提交 `{query,dictionaryCode}` 到同源 Bridge；Worker Secret 构造一次官方请求；无目录发现、自动换词典、重试或结果持久化。
- Session Capsule：外发 Corpus 只有连续 slot，不含 Entry ID；结果以 protocol、sessionId、两类 hash、sequence、expiry 绑定，本机才把 slot 映射回 ID。
- Bridge capability 只存 hash，write capability 一次性失效，过期 alarm 删除数据。

## Worker 与缓存

Worker 负责静态安全头、Collins Bridge、月度预算和临时 Session。`/api/*` 永不进入 Service Worker Cache；响应均为 `no-store`。生产由 Cloudflare Access 保护，Worker 使用 Team domain JWKS 验证 Access JWT 的 RS256 签名、issuer、AUD 与有效期；Secret 不下发浏览器。
