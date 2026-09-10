# 5.0.0-alpha.10.1 测试报告

## 自动测试

- 主数据/关系：通过，23,917 个 Entry、20,793 个关系组件。
- Runtime symbol、行为、压力与集成测试：通过。
- Seed5 Runtime 与三路迁移：5/5 通过。
- Provider：4/4 通过。
- Mirror 3：4/4 通过，完整 Seed Context 未超过 Bridge 限额。
- Bridge：6/6 通过，包含 15 字符 Master Key 成功、11 字符稳定返回配置错误、双 Token scope、加密静态保存与 200 run 上限。
- 静态发布边界：通过，48 个 Service Worker 预缓存资源。
- 性能：25 次搜索 238.0 ms；关系构建 101.0 ms；完整 VIX 预检 4,730.0 ms。
- 布局真浏览器测试：通过，402×874。
- Wrangler dry-run：通过，16.44 KiB / gzip 4.62 KiB；识别 Durable Object 与固定 Pages origin。

## 仍需真机验收

- GitHub Pages 更新与 Service Worker 接管。
- 已部署 Bridge 使用现有十几位 Master Key 保存 Groq Key。
- Bridge“测试”成功提示在弹窗与页面顶部均可见。
- Mirror 页面显式同步、外部任务投递与勾选提交闭环。
