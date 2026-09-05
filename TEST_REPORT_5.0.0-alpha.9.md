# Vocabulary Index 5.0.0-alpha.9 测试报告

自动化范围：

- Collins 标准单请求成功。
- challenge 后备用身份成功与最终失败。
- 未标注 challenge 的 HTML 403 后备用身份成功与最终失败。
- JSON 403 不重试，并与 HTML 边缘拦截分开分类。
- 401 的安全诊断与浏览器端诊断显示。
- Secret、查询词与上游正文不进入诊断或日志。
- 原有数据、升级、镜像会话、Provider、Worker、性能和布局回归测试。
- Wrangler 自定义构建与 dry-run，确认 71 个静态资产及两个 Durable Object 绑定可部署。

真实 Collins 结果仍须部署后验证；本报告不把本地模拟响应当作官方服务成功。
