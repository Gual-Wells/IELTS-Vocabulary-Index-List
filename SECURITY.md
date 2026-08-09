# Vocabulary Index 4.4.0 安全与数据边界

## 数据

- 业务数据与 API Key 继续本地保存；GitHub Pages 静态部署不拥有服务器端用户数据库。
- Oxford 为外部跳转；Collins/Groq 调用沿用既有 session/cancel/stale-response 约束；ChatGPT context 只带必要条目上下文。
- 完整备份/VIX 继续按既有 schema 校验。

## Navigation

- VIX token/generation 只是本地 session identity，不是认证凭证。
- dead/stale destination 永不 render；Forward guard 只保护产品导航语义，不承诺控制 iOS 私有 history preview surface。
- root edge guard 不替代浏览器安全边界，也不拦截普通网页外链权限。

## Modal / Accessibility

- root App `inert` 当前保留，使 modal 外内容不可交互/聚焦；nested modal parent 继续 inert。
- 4.4 不再通过 root overflow mutation 锁背景；物理手势由 overlay/touch-action/non-passive touch boundary 处理。
- 如果目标机证明 root inert 与 Sticky compositor 冲突，fallback 必须同时补齐 pointer/touch/focus containment，不能只删除 inert 后放任背景交互。
