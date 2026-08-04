# Vocabulary Index 3.5.2 安全说明

- 业务数据默认仅保存在当前 iPhone Web App 的 IndexedDB；
- 不建立账户、云同步或远程业务数据库；
- 其他人打开同一公开部署时使用自己的浏览器存储；
- 内容导入先在 Web Worker 中预检，再以单次事务提交；
- 导入计划绑定基准 Revision，确认期间状态变化时必须重新预检；
- 歧义 VIX 裸键不会自动猜测，相关脏 Membership 被跳过并报告；
- 高危操作执行前提供“下载备份／不下载”选择；两项都会继续进入实际操作确认；
- 完整备份包含个人状态，应由用户自行妥善保管；
- VIX 内容 JSON 不包含 PIN、标注、学习日期、浏览位置或 API Key；
- Groq API Key 只保存在当前浏览器 localStorage，不进入 Seed、VIX 或完整备份；
- AI 取消会 Abort 当前请求和重试等待；
- Oxford 只接收当前英文；
- ChatGPT 只在用户点击时接收当前具体 Entry 的上下文 JSON；
- 外部 URL Scheme 的最终接收行为由 iOS 和目标 App 控制。

用户仍应定期导出完整备份。卸载主屏幕 Web App、清除 Safari 网站数据或系统存储回收都可能影响本地数据。
