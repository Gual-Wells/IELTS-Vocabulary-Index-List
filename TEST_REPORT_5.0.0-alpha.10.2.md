# 5.0.0-alpha.10.2 测试报告

## 自动测试

- Bridge：7/7 通过，覆盖 15 字符 Master Key、不可解密 Groq Key 与上游连接失败分流。
- Provider：5/5 通过，覆盖候选 Bridge 的 status + Groq `/models` 深度测试及错误透传。
- Mirror 3：4/4 通过，完整 Seed Context 未超过 Bridge 限额。
- Seed5 Runtime 与三路迁移：5/5 通过，保留用户编辑、删除与学习状态。
- 主数据/关系、Runtime symbol、行为、压力与集成测试：通过；23,917 个 Entry、20,793 个关系组件。
- 静态发布边界：通过，48 个 Service Worker 预缓存资源。
- 布局真浏览器测试：通过，402×874；断言嵌套父层隐藏、当前层可见。
- JavaScript 语法检查与 Pages allowlist 构建：通过。
- 性能：25 次搜索 223.5 ms；关系构建 86.5 ms；完整 VIX 预检 4,600.4 ms。
- Wrangler dry-run：通过，17.02 KiB / gzip 4.73 KiB；识别 Durable Object 与固定 Pages origin。

## 仍需真机验收

- 已部署 Bridge 使用现有 Master Key 解密并访问 Groq 模型目录。
- iOS PWA 嵌套 Bridge/Mirror 弹窗、触摸查询菜单和文件选择器。
- Mirror 外部任务投递与勾选提交闭环。
