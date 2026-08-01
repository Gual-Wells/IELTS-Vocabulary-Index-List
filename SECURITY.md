# 安全与隐私

- 词汇、释义、PIN、标注和设置保存在浏览器 IndexedDB。
- Groq API Key 只保存在 localStorage，不进入完整 JSON。
- 仅 AI 操作向 `https://api.groq.com` 发送用户明确选择的词项或指令。
- 运行时不包含 GitHub PAT、GitHub Contents API、自动云同步或第三方分析脚本。
- CSP 限制脚本、样式、连接、对象和表单来源。
- 动态 UI 使用 DOM API，不把用户内容注入 `innerHTML`。
- 完整恢复验证实体 ID、域内唯一、关联完整性、短语索引、PIN 与上次位置。
- 多实例写入使用修订号检查，冲突时安全取消。

任何破坏性升级或恢复前，都应先导出完整 JSON 到浏览器之外。
