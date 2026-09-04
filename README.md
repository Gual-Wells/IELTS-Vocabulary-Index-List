# Vocabulary Index 5.0.0-alpha.5

alpha.5 修正了两项基础架构问题：Collins 不再被第二层、绑定具体 Access AUD 的重复鉴权阻断；全新设备导入 Seed 时改为分批提交、显示进度并可从已完成批次继续。

## 两种发布形态

- GitHub Pages：公开静态壳、本地词库、Groq、文件式 Mirror。
- Cloudflare Worker：同一套前端，加上私有 Collins Bridge 与远程 Session Bridge；整个 Worker 只由一个 Cloudflare Access 应用保护。

前端会读取 `/api/capabilities` 自动判断当前形态。Pages 不提供 API 时，Collins 入口自动隐藏。

## 当前版本

- App：`5.0.0-alpha.5`
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

