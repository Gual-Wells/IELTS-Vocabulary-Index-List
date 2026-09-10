# Vocabulary Index 5.0.0-alpha.10.4

本补丁修复 Bridge 到 Groq 的 Cloudflare 运行时兼容问题。

- 移除 Worker 子请求中 `workerd` 不支持的 `redirect: "error"`。
- 模型目录刷新、Groq 查询和保存前 Key 验证共用兼容的出站请求。
- Bridge“测试”会验证当前输入的 Key，但不会写入或覆盖 Durable Object；留空则测试已保存 Key。
- 传输异常写入不含凭据的运行时日志。

Bridge 版本为 1.0.4。Mirror 协议、数据库、Seed、用户词汇与学习状态不变。
