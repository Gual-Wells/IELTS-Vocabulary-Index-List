# 5.0.0-alpha.10.4 测试报告

## 根因回归

- Bridge 单元测试断言 Groq `/models` 与 `/chat/completions` 子请求不再携带 `redirect: "error"`。
- 候选 Key 验证端点通过 Device Token 鉴权，返回模型目录但不写入 `groqSecret`。
- Provider 测试验证未保存的 Bridge URL、Device Token 与候选 Groq Key 会用于本次测试，且不修改本机配置。
- Cloudflare `workerd` 本地运行时使用故意无效的假 Key 返回 Groq HTTP 401，而非本地构造请求产生的 502。

## 兼容边界

Bridge 为 1.0.4。Schema 6、DB 5、Seed revision 7、Mirror 3 及 IndexedDB 数据保持不变。
