# 5.0.0-alpha.10 测试报告

## 自动化结果

- 核心数据与关系：通过，23,917 个条目、20,793 个关系组件。
- 运行时符号、行为与压力测试：通过。
- Seed5 运行分片与迁移：5 项通过；完整 Seed 预检通过。
- Provider：4 项通过；Groq 只经 Bridge 请求，并验证紧凑回忆结构。
- Mirror 3：4 项通过；包含完整 Seed Context 容量、整数 slot、哈希校验和本地 ID 映射。
- Bridge：5 项通过；包含 origin、双 Token scope、结果确认、版本修订幂等、200 条运行上限和 Groq Key 静态加密。
- 静态与集成：通过；48 个预缓存资源，产品运行时不含 Collins/ChatGPT，也不从前端直连 Groq。
- Bridge Wrangler dry-run：通过；识别 `MIRROR_ACCOUNT` Durable Object 与固定 Pages origin。
- PowerShell 函数：Windows PowerShell 成功加载并执行参数校验路径。
- 性能：通过；25 次搜索 353.2 ms，关系计算 89.0 ms，完整 VIX 预检 4,684.4 ms。
- iPhone 布局合同：通过，402×874。
- 首次冷启动中断恢复：通过；在 9,027 条时中断，恢复后完成 23,917 条初始化。

## 仍需真实环境验收

- GitHub Pages 发布、Service Worker 更新与 iOS PWA 回归。
- 实际 `vix-bridge` 部署、三个 Secret、Groq 真 Key 与模型目录。
- 一次真实 `VIX:` 本地任务、Bridge 投递、PWA 分层勾选、取消零写入与提交单次写入。
- Oxford iOS 跳转及机械按钮返回。

这些项目依赖用户账号、部署环境或真实设备，不能由本地自动化结果代替。
