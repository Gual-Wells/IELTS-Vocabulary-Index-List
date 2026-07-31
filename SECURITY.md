# 安全与数据可靠性说明

## 本地数据

- 词库保存在当前站点的 IndexedDB 中。
- Groq API Key 保存在当前站点的 localStorage 中。
- 完整 JSON 备份不包含 Groq Key。
- 项目不再保存 GitHub PAT，也不调用 GitHub API。
- 从旧云备份版升级时，会自动删除遗留的 GitHub Token、仓库设置和云状态。

## 前端安全

- 不加载外部 JavaScript、字体、图标库或 CDN。
- HTML 不包含内联事件处理器。
- 动态内容通过 DOM API 和 `textContent` 创建，不使用 `innerHTML` 注入用户数据。
- Content Security Policy 只允许本站资源及向 `https://api.groq.com` 发起连接。
- 动态 DOM ID 使用内部安全 ID，不使用词汇文本。
- JSON 备份只保留白名单字段，未知嵌套字段在规范化时被丢弃。
- 词表、词条、PIN 和标注 ID 均经过格式验证。

## 数据一致性

- 所有业务写入使用 IndexedDB 事务。
- 同一页面中的修改通过 mutation 队列串行化。
- 每次业务提交验证全局 `dataRevision` 和实体前置快照。
- 另一个标签页或主屏幕实例先写入后，陈旧操作会被拒绝，不会静默覆盖。
- 批量词条变更先删除受影响 key，再写入最终值，避免唯一索引瞬时冲突。
- 导入先解析、校验和预览，确认后才写入。
- 恢复和初始化作为完整事务写入撤销历史。
- 人工改名会同步更新所有来源词形；升级时自动修复旧版本可能留下的不一致来源。
- AI 核查只写半持久标注，不自动修改词汇。

## 浏览器清理风险

以下操作会删除或可能删除 IndexedDB 和 localStorage：

- Safari“清除历史记录与网站数据”；
- Safari“高级 → 网站数据”中删除 `gual-wells.github.io`；
- Chrome 清除“Cookie 及其他网站数据”；
- 系统存储压力下浏览器回收站点数据。

执行上述操作前必须导出完整 JSON。
