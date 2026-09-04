# Vocabulary Index 5.0.0-alpha.5 测试报告

## 自动测试

- 数据、静态引用、运行时符号、行为与压力测试：通过。
- Integration、Provider、Mirror、Worker、Seed 迁移与 Runtime Seed：41 项通过，0 项失败。
- 性能基线：25 次搜索 244.3 ms；关系计算 81.8 ms；全量预检 4,418.5 ms。
- 402 × 874 移动布局契约：通过。

Worker 测试覆盖：无 `ctx.access` 时 API fail-closed、capabilities、health、Collins 固定词典与单次上游请求、Secret 缺失、上游凭据拒绝、月度额度、Session Durable Object，以及静态响应安全头。测试与响应中均不返回 Collins Secret。

## Cloudflare 发布边界

执行 `npm run build` 后，`dist/` 仅包含运行时允许列表。Wrangler 4.128.0 dry-run 成功读取 71 个静态文件，并识别：

- `SESSION_OBJECT` Durable Object；
- `USAGE_LEDGER` Durable Object；
- `ASSETS`；
- `COLLINS_MONTHLY_LIMIT`。

源数据、工具、测试、Worker 源码、文档、本地变量和 Secret 均未进入静态资源包。

## 全新设备与中断恢复

使用全新 Chromium Profile 进行真实 IndexedDB 冷启动。首次写入 9,027 条记录后主动关闭页面；同一浏览器数据重新打开后从断点继续，206.054 秒完成剩余记录。

最终精确得到 3 Domain、24 Collection、23,917 Entry、61,905 Membership、20,793 Relation Component；`seedImportState` 已清除，Schema 6 正式提交。

该测试确认“关闭页面后可继续”，不表示首次导入已经即时完成。低性能 iPhone 的首次导入仍可能持续数分钟，但现在有可见进度，且不再因中断而必须从零开始。
