# Vocabulary Index 5.0.0-alpha.7 测试报告

自动化覆盖：

- Collins 规范 `search/first` 路径与单请求约束；
- Secret 不跟随意外重定向；
- `upstream_challenge`、授权、网络、格式与限流错误分类；
- Challenge HTML 不进入客户端响应；
- Worker 日志不包含查询词、请求 URL、响应正文或 Secret；
- 既有 Provider、Mirror、Seed、PWA 与 Worker 契约回归。

真实 Collins 可用性不能由本地 fixture 证明；部署后必须以官方 API 实测结果为准。
