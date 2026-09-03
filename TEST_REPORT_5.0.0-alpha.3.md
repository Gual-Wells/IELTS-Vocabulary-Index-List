# Vocabulary Index 5.0.0-alpha.3 测试报告

## 自动测试范围

- 数据模型、导入导出、搜索与关系投影；
- Seed revision 5 → 6 三方合并与运行时分片完整性；
- Cloudflare Access assertion、应用域 Cookie、平台上下文、错误 Audience 和无认证请求；
- Collins Bridge 固定词典、Secret 隔离、额度与错误分类；
- 管理词库拖动的直接子项约束、逐帧调度与触摸样式；
- Service Worker cache、静态资源清单、Worker 配置和布局契约。

## 结果

- 核心、静态、运行时、行为、压力、集成、Mirror/Session、Provider、Worker、Seed 与性能闸门：PASS。
- Provider/Worker/Seed 重点套件：35/35 PASS。
- Chromium 402×874 布局与生产拖动函数嵌套排序测试：PASS。
- Wrangler 4.128.0 `deploy --dry-run`：PASS；识别 366 个资源、Static Assets、两个 Durable Objects 和现有环境变量。
- Seed runtime：23,486 Entries、61,445 Memberships、19,634 Relation Components；每个分片低于 25 MiB 且 SHA-256 校验通过。

iPhone standalone、真实 Cloudflare Access 和 Collins 官方账号仍属于人工端到端闸门。当前截图中的 401 修复必须在本版本部署后由真机再次查询确认。
