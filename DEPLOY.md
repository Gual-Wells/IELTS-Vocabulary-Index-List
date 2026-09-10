# VIX 5.1.0 部署

## 1. 部署 Personal Mirror Site

Site 源码位于 `mirror-site/`，托管声明位于 `mirror-site/.openai/hosting.json`。生产发布前必须：

```powershell
cd mirror-site
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vinext/dist/cli.js build
```

在 Sites 环境中设置随机高强度的 secret `VIX_GROQ_MASTER_KEY`。它不得提交仓库、打印或写入前端。随后把验证过的精确源码 commit 推送到 Site source repository，保存 Site version 并私有部署。

部署后验证 `/`、`/picker`、`/pair`、`/api/mirror/capabilities`，以及配对后的 snapshot、files、Groq settings/models/chat/speech 路由。

## 2. 部署 VIX PWA

```powershell
npm run test:all
npm run build
```

将 `dist/` 作为 GitHub Pages 产物发布。确认页面与 manifest 显示 5.1.0，Service Worker cache 标识为 5.1.0，并允许 frame 到正式 Personal Mirror Site。

## 3. 配置 VIX Function

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\integration\vix-function\VIX-Function.ps1 -Action Configure
```

填写正式 Site URL 与配对写入 token。Function 使用 DPAPI 保存 token；不要将其写入仓库。Function 依赖协议 capability，不跟随 VIX 或 Seed 版本重新配置。

## 4. 上线验证

1. Site 私有会话能打开文件管理器；数据库快照不出现在文件列表。
2. VIX 配对后手动同步，Site capability 与最新 snapshot 可读。
3. VIX 调用 `/picker` 并接收合法 `vix-mirror-selection`。
4. 执行一次 `VIX:` 语义提取，Function 只接受合法 `vix-mirror-file/1`。
5. 在 VIX 选择 Layer 2 候选，事务成功后自动同步快照与文件状态。
6. Groq 查询和单独语音模型/voice 可用；iOS 失败时只由系统 TTS 兜底。
7. 离线重开、冷启动恢复、PIN、学习日期、关系与显示偏好不回退。

Cloudflare Bridge、WebMCP 与 Google TTS 不再部署。
