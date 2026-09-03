# Vocabulary Index 5.0.0-alpha.2 测试报告

测试日期：2026-09-03。对象：D/A/C/B/E 统一候选包。

## 自动闸门

| 闸门 | 结果 | 覆盖 |
|---|---|---|
| 核心与静态契约 | PASS | 22,910 Seed Entry、18,168 RelationComponent、51 个显式 precache 资源、版本/Schema/DB/VIX/cache 一致性 |
| Runtime 行为与符号 | PASS | 导航、滚动、动画、持久化与模块导出契约 |
| 压力与集成 | PASS | 结构投影、关系、最长 8,042 字符 Shortcut URL |
| Provider | PASS（23/23） | Groq 状态机；Collins 固定 Registry、一次上游请求、无浏览器 Key、错误分类与取消隔离 |
| Mirror / Session | PASS（5/5） | OR suppression、CURRENT/ACTIVE、有效空结果、slot-only Capsule、hash/slot 失败关闭 |
| Worker | PASS（5/5） | Access JWT RS256/issuer/AUD、伪造头拒绝、Collins Secret 隔离、月度硬预算、一次性 capability、静态安全头 |
| Seed5 | PASS（4/4） | 完整分片重组、SHA-256 篡改拒绝、未修改与重度自定义设备三方迁移 |
| 性能 | PASS | 25 次搜索 200.9 ms；关系 67.7 ms；Seed5 VIX preflight 4,019.0 ms |
| Chromium 布局 | PASS | 402×874 viewport，alpha.2 样式与 retained modal 契约 |
| Wrangler 4.128 dry-run | PASS | 354 个静态资产；Worker、Assets、SessionObject、UsageLedger 与环境变量绑定成功；无配置警告 |

所有自动闸门均通过。完整源码仍可运行 `npm run test:all` 复验。

## 人工/外部闸门

以下需要真实账号、真实服务或目标设备，本地自动测试没有冒充通过：

- `NOT_RUN`：生产 Cloudflare Worker、Zero Trust Access 登录与 JWT 轮换端到端；
- `NOT_RUN`：Collins 真实授权账号下两本词典、实际配额与上游响应；
- `NOT_RUN`：iPhone 17 标准版 Home Screen standalone 全清单；
- `NOT_RUN`：两台真实设备通过远程 Session Bridge 往返。

执行步骤见 `tests/MANUAL_CHECKLIST.md`。任何曾经出现在聊天、截图或日志中的 API Key 都应在部署前轮换。
