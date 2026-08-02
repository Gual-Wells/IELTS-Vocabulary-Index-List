# Vocabulary Index 3.3.0 安全说明

- 业务数据默认仅保存在当前 iPhone Web App 的 IndexedDB；
- 不建立账户、云同步或远程业务数据库；
- 其他人打开同一公开仓库时使用自己的浏览器存储；
- 内容导入先预检，再以事务写入；
- 完整替换和 Seed 恢复前生成备份；
- VIX 内容 JSON 不包含 PIN、标注、学习日期或浏览位置；
- Groq API Key 不进入内容 JSON 或 Seed；
- Oxford 只接收当前英文；
- ChatGPT 只在用户点击时接收当前条目的上下文 JSON；
- 外部 URL Scheme 的最终接收行为由 iOS 和目标 App 控制。

用户仍应定期导出完整备份。卸载主屏幕 Web App、清除 Safari 网站数据或系统存储回收都可能影响本地数据。
