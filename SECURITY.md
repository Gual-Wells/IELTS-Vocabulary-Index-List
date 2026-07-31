# 安全与数据可靠性说明 — 2.4.0

## 本地数据

- 词库保存在当前站点的 IndexedDB 中。
- Groq API Key、当前模型和模型目录保存在当前站点的 localStorage 中。
- 完整 JSON 备份不包含 Groq Key、模型目录或请求日志。
- 项目不保存 GitHub PAT，不调用 GitHub API，也不提供云同步。

## 前端边界

- 不加载外部 JavaScript、字体、图标库或 CDN。
- HTML 不包含内联事件处理器。
- 动态用户内容使用 DOM API 和 `textContent`，不使用 `innerHTML` 注入。
- Content Security Policy 只允许本站资源及向 `https://api.groq.com` 发起连接。
- 词表、词条、PIN 和标注 ID 经过格式验证。
- 词汇和词表名称拒绝控制字符、零宽字符和双向文本控制字符。
- AI 返回字段经过结构和类型校验；AI 核查不能直接修改词条。

## Groq 请求可靠性

- 模型列表只在用户显式刷新时请求，失败不会覆盖已有目录。
- 大规模核查使用串行动态批次，不并发轰击 API。
- 客户端读取 token/request 剩余额度与 reset/retry-after 信息，用于主动等待和有限重试。
- 对外只显示简洁错误信息；结构化状态码和等待信息仅用于当前任务控制。
- 运行策略不按模型品牌或 ID 写特殊分支。本版明确不解决特定 Qwen JSON 生成失败。
- API Key 仍属于浏览器中可被同源脚本读取的敏感凭证；正式仓库写权限和 GitHub 账号必须妥善保护。

## 数据一致性

- 所有业务写入使用 IndexedDB 事务和单页面 mutation 队列。
- 每次业务提交验证全局 `dataRevision` 和实体前置快照。
- 另一个标签页或主屏幕实例先写入后，陈旧操作会被拒绝。
- 导入先解析、校验和预览，确认后才写入。
- 完整导出从一个原子 IndexedDB 快照生成。
- AI 每批返回后只给仍与请求快照一致的词条写标注，避免编辑期间的陈旧结果污染数据。
- 取消或后续批次失败不会回滚此前已成功提交的标注。

## 浏览器清理风险

以下操作会删除或可能删除 IndexedDB 和 localStorage：

- Safari“清除历史记录与网站数据”；
- Safari“高级 → 网站数据”中删除 `gual-wells.github.io`；
- Chrome 清除“Cookie 及其他网站数据”；
- 系统存储压力下浏览器回收站点数据。

执行上述操作前必须导出完整 JSON；Groq Key 需要单独保存在密码管理器中。
