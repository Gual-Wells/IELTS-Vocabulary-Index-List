# 安全与隐私

- 词汇、释义、PIN、标注和设置保存在浏览器 IndexedDB。
- Groq API Key 只保存在 localStorage，不进入完整备份或 VIX JSON。
- 仅 AI 操作向 `https://api.groq.com` 发送用户明确选择的词汇、短语或指令。
- 运行时不包含 GitHub PAT、GitHub Contents API、自动云同步或第三方分析脚本。
- CSP 限制脚本、样式、连接、对象和表单来源。
- 动态 UI 使用 DOM API，不把用户内容注入 `innerHTML`。

## 数据交换

- 单个导入文件上限 64 MB。
- VIX JSON 在模块 Web Worker 中解析并计算差异，预检完成前不修改 IndexedDB。
- JSON Schema、英文规范化、ID、域内唯一性、Collection 类型和 Membership 关系均需校验。
- 普通词表不得接收短语，短语表不得生成普通 Membership。
- 增量合并不执行隐式删除。
- 完整替换只作用于用户选定范围，并在提交前自动下载恢复备份。
- 导入提交采用一次完整事务；失败时不得留下半套数据。
- 文件声明目标与面板目标冲突时不得静默写入。
- PIN、标注和浏览位置在替换后重新校验；无法映射的状态会被安全移除。

## 多实例与更新

- 多实例写入使用修订号检查；检测到其他标签页更新时重新读取并重试一次。
- Service Worker 按同一缓存代提供 HTML、CSS 和 JavaScript，避免新旧文件混装。
- 任何破坏性恢复或全局替换前，都应保存应用自动生成的恢复备份。
