# Vocabulary Index 5.0.0-alpha.6 测试报告

## 修复针对性验证

- Worker API 在没有 `ctx.access` 的运行时调用中正常返回 health/capabilities，覆盖 Static Assets 内部路由器不转发上下文的生产行为。
- Worker 源码不再包含 `requireAccess`、JWT、JWKS、Team domain 或 Application AUD 依赖。
- Collins 仍只向固定词典发送一次服务端请求，Secret 不进入响应、前端、静态资源或发布包。
- Wrangler 4.128.0 dry-run 通过：读取 71 个运行时静态文件，识别 `SESSION_OBJECT`、`USAGE_LEDGER`、`ASSETS` 与 `COLLINS_MONTHLY_LIMIT`，不包含 Collins Secret。

## 保留回归范围

- 数据、静态引用、运行时符号、行为、压力、Integration、Provider、Mirror、Worker、Seed 与布局测试。
- 全新 Chromium Profile 的 IndexedDB 初始化、中断与继续导入。
- 未登录无痕窗口必须出现 Cloudflare Access 登录页，此项需部署后人工验收，因为 Access 位于 Worker 代码之外。

## 执行结果

- 基础数据、静态引用、运行时符号、行为、压力与 Integration：通过。
- Provider、Mirror、Worker、Seed：41 项通过，0 项失败。
- 独立性能复测：25 次搜索 366.8 ms；关系计算 130.2 ms；全量 VIX 预检 6,849.9 ms。
- 402 × 874 移动布局：通过。
- 全新 Chromium Profile 在写入 9,027 条记录后主动关闭；重新打开后从断点完成，最终精确得到 3 Domain、24 Collection、23,917 Entry、61,905 Membership 和 20,793 Relation Component，`seedImportState` 清除且 Schema 6 正式提交。

本次冷启动恢复测试与完整 Seed 回归并发执行，恢复阶段耗时 423.755 秒，因此该时间只证明高负载下仍能恢复，不作为正常设备性能基线。低性能 iPhone 首次导入仍可能持续数分钟。
