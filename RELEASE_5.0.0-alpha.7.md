# Vocabulary Index 5.0.0-alpha.7 发布说明

本版修正 Collins 故障诊断与上游请求边界：使用官方规范路径，不跟随携带 Secret 的重定向，并准确识别 Cloudflare Challenge。日志和前端均只显示脱敏后的类别，不包含 Collins Key、查询词或响应正文。

这不是对 Collins 防护的绕过。如果官方 API 对 Cloudflare Worker 出口持续返回挑战页，集成查询仍会失败；恢复需要 Collins 对正式 API 客户端放行，或提供其认可的服务端调用方式。
