# Bridge Groq 保存故障复盘（2026-09-06）

## 现象

- Bridge 测试通过。
- 填入 Groq API Key 后界面提示保存成功。
- 再次打开 Bridge 时输入框为空。
- 设置页刷新模型返回“Bridge 无法完成请求”。

## 根因

1. Groq 输入框被固定初始化为空，因为产品不应把后端保存的 API Key 再传回浏览器；界面没有显示后端保存状态，导致“安全不回显”看起来像“没有保存”。
2. Bridge 1.0.1/1.0.2 的 `PUT /v1/settings/groq` 只完成加密和 Durable Object 写入就返回 `configured: true`，没有先验证 Groq Key，也没有在写入后读回解密。因此“保存成功”只代表写操作结束，不代表 Key 可用于模型请求。
3. Bridge 连接测试与 Groq 能力测试曾是两条分离链路，前者成功不能证明 `/v1/groq/models` 成功。

## 修复

- 保存前用待保存的 Key 请求 Groq `/openai/v1/models`；鉴权失败或模型目录无效时拒绝保存。
- 只有 Groq 验证成功后才写入密文；写入后立即从 Durable Object 读回并解密比对。
- 替换 Key 失败时保留原密文，不再破坏已可用配置。
- `/v1/status` 实际解密密文后才报告 `groq: true`，并区分缺失、Master Key 不匹配和不可读。
- Bridge 页面不回显 API Key，但会显示“已保存在 Bridge；留空不变”。
- PWA 只在 Bridge、Groq 模型目录和 Mirror Context 全链路成功后提交本机 URL 与 Device Token。

这次故障与 Device Token 长度无关，也不是用户复制错误。
