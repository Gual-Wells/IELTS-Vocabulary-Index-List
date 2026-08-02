# Vocabulary Index 3.1.1 安全说明

- 默认数据仅保存在浏览器 IndexedDB；
- 内容导入先在 Worker 中解析和预检，确认后以事务写入；
- 完整替换与 Seed 恢复前生成完整备份；
- VIX 内容 JSON 不携带学习日期、PIN、标注、浏览位置或 API Key；
- Groq API Key 使用独立本地安全存储；
- Content Security Policy 限制脚本、样式和连接来源；
- Service Worker 升级桥只清理旧缓存，不触碰业务数据库；
- 全局总表没有独立内容所有权，不能直接删除跨域聚合内容。

用户仍应定期导出完整备份，并在执行全局替换或 Seed 恢复前确认下载结果。

## 外部查询边界

- 牛津控件会把当前条目的英文纯文本交给已安装的牛津英汉辞书 App；
- ChatGPT 控件会把当前条目的上下文 JSON 交给名为 `AI查询` 的 iOS 快捷指令；
- 两种传输都必须由用户逐项点击触发，不在后台自动执行；
- ChatGPT 快照排除 Groq API Key、无关词条、应用全局设置、撤销历史和无关浏览位置；
- 自定义 URL Scheme 是否成功打开目标 App 由 iOS 和目标 App 决定，应用无法读取目标 App 的查询结果。
