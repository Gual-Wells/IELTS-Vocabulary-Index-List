# Vocabulary Index 5.0.0-alpha.10.3

Groq Key 只有在模型目录验证和写后解密均成功后才会报告保存成功；替换失败不会覆盖旧 Key。Bridge 页面不回显秘密值，但会明确标记 Key 已保存在 Bridge。

本版修复 Bridge 配置一致性和查询入口尺寸。

- Bridge 状态验证 Groq Key 可解密性，Master Key 错配有明确诊断。
- Bridge 配置完整接通 Groq 模型与 Mirror Context 后才在本机生效。
- 保存后模型目录和父设置页状态立即同步。
- Oxford/Groq 查询弹窗改为两列内容宽度。
- Bridge 版本为 1.0.3；普通升级必须保留三个 Worker Secret，尤其不能轮换 Master Key。

本版不迁移数据库、词库、Seed、学习状态或 Mirror 数据协议。
