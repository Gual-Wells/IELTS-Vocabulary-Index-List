# Vocabulary Index 5.0.0-alpha.8 发布说明

本版针对 Collins 官方 API 对 Cloudflare Worker 子请求触发 Challenge 的问题做最小修复。Worker 主请求现在明确声明为 VIX 服务端客户端；只有收到可确认的 Cloudflare Challenge 时，才使用备用的 `Cloudflare-Workers` 服务端标识再试一次。

这两个标识都已在同一正式 Collins 查词端点和真实授权密钥下完成本地网络探针验证。密钥仍只存在于 Cloudflare Secret 与上游 `accessKey` 请求头中；VIX 不把密钥放入 URL，不模拟浏览器，不跟随重定向，也不保存 Collins HTML Challenge。

本版不改变固定 `vix-private` Worker、单一 Cloudflare Access 边界、用户管理、Pages 公共壳、PWA 数据库、Seed revision 或 Session Bridge。
