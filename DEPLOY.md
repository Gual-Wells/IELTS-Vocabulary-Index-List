# Vocabulary Index 5.0.0-alpha.4 部署

## 推荐拓扑

```text
iPhone / Browser
  ├─ 静态应用与 Seed5 分片
  ├─ Groq：浏览器直连（用户自己的 Key）
  ├─ Collins：POST /api/collins/lookup
  └─ Session：/api/vix/sessions/*
                 ↓
        Cloudflare Worker
          ├─ Collins Secret
          ├─ 月度硬预算 Durable Object
          └─ 临时 Session Durable Object
```

生产部署使用 `wrangler.jsonc`。`.assetsignore` 会排除工具、测试、原始 Seed5 来源和完整 43 MB `data/seed.json`；线上只上传 SHA-256 分片，最大约 4 MiB。

## 首次部署

1. 把本包完整解压到 GitHub 仓库根目录。
2. 安装 Node.js，在根目录执行完整测试。
3. 登录 Wrangler：`npx wrangler login`。
4. 在 Cloudflare Zero Trust 中为生产域建立 Access Application，并复制 Team domain 与 Application Audience (AUD) tag。
5. 把 `wrangler.jsonc` 中 `TEAM_DOMAIN` 改为完整的 `https://<team>.cloudflareaccess.com`，把 `POLICY_AUD` 改为该应用的 AUD tag。保留占位值时受保护 API 会失败关闭并返回 503。
6. 创建 Secret：`npx wrangler secret put COLLINS_ACCESS_KEY`。
7. 确认 `COLLINS_MONTHLY_LIMIT`；默认 1000 次/月，达到后在上游请求前返回 429。
8. 执行 `npx wrangler deploy`。
9. 在 Safari 打开生产域、完成 Access 登录，再添加到主屏幕。

不要把真实 Key 放进 `.dev.vars.example`。本地开发可复制为 `.dev.vars`，它已被 Git 与 Assets 排除。`ALLOW_UNPROTECTED_LOCAL=true` 只允许本地调试，生产保持 `false`。生产 Worker 不信任 `cf-access-authenticated-user-email` 或仅仅“存在”的 JWT 头：它会从 Team domain 的 `/cdn-cgi/access/certs` 获取并轮换缓存 JWK，验证 RS256 签名、issuer、AUD 与有效期。

## GitHub Pages 降级模式

GitHub Pages 不执行 Worker：本地词库、Seed5、搜索、PIN、Mirror 文件交换、Groq 可以工作；Collins 同源接口和远程 Session Bridge 不可用。不要改回浏览器直连 Collins，也不要使用公共 CORS 代理。完整验收应将同一 GitHub 仓库连接到 Cloudflare Workers。

## 发布前检查

- Seed runtime 每个资产小于 25 MiB，SHA-256 测试通过；
- Collins Key 只存在于 Secret；任何曾在聊天、截图或日志中出现的旧 Key 都应轮换；
- Access 占位配置返回 503；未登录、伪造头、错误 AUD 或无效签名返回 401；有效登录后允许请求；
- Collins 一次点击只产生一次上游请求；
- Session request 不含 Entry ID，write token 只能使用一次；
- Service Worker cache 名与 `js/v3-upgrade.js` 一致；
- iPhone standalone 执行 `tests/MANUAL_CHECKLIST.md`。

alpha.4 保持 Schema6/DB5/VIX2，Seed revision 升到 7。Worker 名仍为 `vix-5-alpha2`，因此继续覆盖同一 Cloudflare 项目；不要新建版本号 Worker。不要用旧 4.7.3 代码直接覆盖已升级站点作为数据回滚；先导出 Schema6 备份并在隔离环境验证。
