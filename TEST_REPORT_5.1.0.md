# VIX 5.1.0 测试报告

## 验证范围

- 数据模型、域内去重、词表优先级投影、PIN 与学习日期
- VIX full/increment 协议与 Mirror Layer 2 共用事务
- Personal Mirror 配对、最新快照、MirrorFS 文件、选择页与 Groq 代理
- VIX Function 协议标记、语义提取约束与只读/写入边界
- PWA 预缓存、冷启动恢复、运行时符号、交互行为、压力与性能
- 多层页悬浮阴影、响应式 inset、触控/滚动布局
- 下一 Seed 固化与质量门禁

## 当前 Seed 内容审计

当前 revision 8 有 23,917 个 Entry；9,143 个缺失释义，545/595 个 content Entry 使用四类高重复泛化释义。它可以作为当前运行 Seed 加载，但故意不能通过“下一世代质量门禁”。本次没有用机械填充伪装质量完成度。

## 结果

2026-09-10 的最终候选通过：

- 模型/静态/运行时/行为/压力/集成测试：通过。
- Provider：7/7 通过；Mirror session：5/5 通过。
- Seed generation/runtime：4/4 通过。
- 23,917 Entry 性能：25 次搜索 239.3 ms；关系计算 62.9 ms；VIX preflight 4,072.6 ms。
- Mirror 全量上下文：23,917 Entry，20.1 ms。
- 402×874 布局契约：通过。
- 中断式冷启动：在写入 9,027 条时中断，19,145 ms 内恢复并得到完整 23,917 Entry。
- VIX `dist` 构建与 492 文件 release manifest：通过。
- Personal Mirror TypeScript `--noEmit` 与 vinext 生产构建：通过，13 个页面/API 路由被打包。
- Sites 私有部署 version 1：成功，运行环境 revision 1 已应用；登录会话中已可视验证 `/` 文件管理器和 `/picker` 调用页。

当前 Seed 运行验证通过；对它运行“下一世代质量门禁”仍会按设计失败。二者测试语义不同。
