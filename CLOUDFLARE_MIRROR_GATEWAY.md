# VIX 5.1.1 Cloudflare Mirror Gateway

## 目标

恢复 5.0.0-alpha 系列已经验证过的 PWA-first 拓扑：VIX 静态资源与浏览器侧 API 共用同一个 Cloudflare origin。Personal Mirror Site 继续作为远端存储/Provider 后端，但不再承担 VIX PWA 内的登录页、文件选择器或会话 UI。

```text
VIX PWA
  ├─ static assets
  ├─ /api/mirror/* ─┐
  └─ /api/groq/*   ─┴─ Cloudflare Worker + Access
                           │ server-side capability
                           ▼
                 Personal Mirror Site
```

浏览器不再向 `chatgpt.site` 发送 capability，也不再 iframe/popup 打开 Site picker。Worker 通过 Durable Object 保存旧 5.1.1 capability，并以 server-to-server 方式代理 Mirror/Groq API。

## 一次性迁移

升级前设备的 `localStorage['vix.personal-mirror.connection']` 已包含旧 `vixm_...` capability。新版首次启动时：

1. VIX 请求同源 `/api/mirror-gateway/status`；
2. Gateway 未初始化时，VIX 将旧 capability POST 到 `/api/mirror-gateway/bootstrap`；
3. Worker 先向上游 `/api/mirror/capabilities` 验证 capability；
4. 验证成功后写入单用户 Durable Object；
5. VIX 从 localStorage 删除 capability，只保留上游 origin、同步 revision 和本机启用状态。

此后重启 PWA、选择 Mirror 文件、同步、Groq 查询和语音都只访问同源 `/api/*`。

## 断开语义

设置中的“断开连接”只停用当前 PWA 设备，不撤销 Worker 中的上游 capability。这样不会同时破坏 VIX Function 或其他已授权设备，也不会发生导航到 Site/Safari 的副作用。真正重置 Gateway 使用 Access 保护的 `DELETE /api/mirror-gateway/reset`，不放在普通设置 UI 中。

## VIX Function

`integration/vix-function/VIX-Function.ps1` 暂不改协议。它仍可直接使用 Personal Mirror Site URL + protocol write token，与 Cloudflare Gateway 共享同一个上游数据空间。

## 部署约束

必须让用户安装的 VIX PWA 本身由该 Cloudflare Worker/custom domain 提供。只有这样 `/api/*` 才是真正 same-origin。

如果现有 iOS PWA 是从 `github.io` origin 安装的，而新 Worker 使用另一个 origin，iOS 会把它视为另一套 PWA；不能靠 Service Worker 把 GitHub Pages 变成 Cloudflare origin。若历史上使用的是自定义域名，应把同一个域名重新指向 Worker，以避免更换 PWA origin。

## 验收

- iPhone standalone PWA 启动后 Settings 显示 Cloudflare Gateway 连接状态；
- 首次迁移旧 5.1.1 capability 后，本机 localStorage 不再保存 `vixm_` token；
- 杀掉 PWA / 重开后仍为已连接；
- “选择 Mirror 文件”在 VIX 原生 dialog 内完成，不出现 iframe、popup 或 Safari；
- “断开连接”停留在 VIX Settings，不发生页面跳转；
- Groq model / chat / speech 仍通过同源 `/api/groq/*` 正常工作；
- 上游不可达时状态为 degraded，不误判为退出；
- Cloudflare Access 失效时明确显示 access-required，而不是清除 Mirror 数据。
