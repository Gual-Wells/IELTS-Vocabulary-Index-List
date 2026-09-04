# Vocabulary Index 5.0.0-alpha.7

alpha.7 将 Collins 上游连接、授权、重定向、非 JSON 响应与 Cloudflare Challenge 分开报告，并在日志中只记录脱敏后的状态类别。它不会尝试绕过 Collins 的服务防护。

alpha.6 修正 Cloudflare Access 与 Workers Static Assets 的真实运行边界：Access 继续在 Cloudflare 边缘保护整个私域 Worker，但应用代码不再读取不会被内部静态资源路由器转发的 `ctx.access`。全新设备仍使用分批、带进度、可续传的 Seed 导入。

## 两种发布形态

- GitHub Pages：公开静态壳、本地词库、Groq、文件式 Mirror。
- Cloudflare Worker：同一套前端，加上私有 Collins Bridge 与远程 Session Bridge；整个 Worker 只由一个 Cloudflare Access 应用保护。

前端会读取 `/api/capabilities` 自动判断当前形态。Pages 不提供 API 时，Collins 入口自动隐藏。

## 当前版本

- App：`5.0.0-alpha.7`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`7`
- VIX JSON：`2`
- Session Capsule：`vix-session-capsule/2`
- Runtime Seed：`vix-seed-runtime/1`

## 构建与验证

```bash
npm run build
npm run test:all
```

`npm run build` 只把运行必需文件复制到 `dist/`。Cloudflare 不再上传 `worker/`、`tools/`、`tests/`、源数据、审计 Seed 或文档。

完整部署步骤见 `DEPLOY.md`，架构边界见 `LOCAL_ARCHITECTURE.md`。
