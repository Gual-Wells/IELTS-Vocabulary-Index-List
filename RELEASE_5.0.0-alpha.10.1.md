# Vocabulary Index 5.0.0-alpha.10.1

这是 alpha.10 的 Bridge 接入修复补丁。

- Master Key 最低长度从 24 调整为 12，密码管理器生成的十几位随机密码可直接使用。
- Bridge 测试显示可见成功提示及 Groq/Mirror 状态。
- Bridge 保存不再隐式执行 Mirror 全量同步。
- Worker 部署显式声明三个必需 Secret，并关闭随机 Preview URL。
- PWA、Bridge 与完整源码分别交付；历史文档继续保留在完整源码包中。

本次不迁移数据库、不更新 Seed、不重置本机配置，也不要求重新安装 PWA。
