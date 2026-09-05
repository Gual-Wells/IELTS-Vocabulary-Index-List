# Vocabulary Index 5.0.0-alpha.8 测试报告

## 自动测试范围

- Worker Collins 主请求标识、Header 鉴权与禁止自动重定向。
- 正常成功路径只请求一次。
- 仅 Challenge 路径执行一次备用标识重试。
- 两次上游尝试只扣减一次月度配额。
- Challenge、恢复与失败日志不包含查询词、密钥或响应正文。
- Collins 401、重定向、非 JSON、配额和固定词典 Registry 回归。
- 静态资源、版本、Seed 运行时分片、PWA 缓存、数据模型与浏览器回归套件。

## 仍需部署后人工核验

- Cloudflare 实际子请求还会自动携带平台的 `CF-Worker` 信息，因此本地网络探针不能替代正式 Worker 出口测试。
- 部署后应先确认 `/api/health` 为 `5.0.0-alpha.8` / `ok`，再分别查询两个固定词典中的常见词。
- 如果仍收到 `upstream_challenge`，从 Observability 日志取得 `cfRay`，不要重复刷新消耗配额。

## 本地验收结果

- 全部源码自动套件通过：核心模型、静态约束、运行时行为、压力、集成、Provider、Mirror、Worker、Seed、性能与布局。
- Collins Worker 回归共 10 项通过，包括主请求、Challenge 后单次备用重试、一次配额扣减和日志脱敏。
- 首次初始化浏览器测试通过：在写入 9,027 条记录时中断，恢复后得到 23,917 Entry、61,905 Membership 和 20,793 Relation Component。
- Wrangler 4.128.0 `deploy --dry-run` 通过：读取 `dist` 中 71 个部署文件，并识别两个 Durable Object、静态资源及月度限额绑定。
