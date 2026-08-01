# Vocabulary Index 3.0.3 本地架构

## 1. 运行模块

- `v3-upgrade.js`：从旧 Worker 升级时一次性清理旧应用壳缓存，不触碰 IndexedDB；
- `v3-app.js`：版本一致性、UI 启动、Service Worker 注册与更新通知；
- `v3-ui.js`：路由、同构浏览、行内关系、PIN、搜索、管理、AI 任务与对话栈；
- `v3-store.js`：业务状态、统一事务、投影、PIN、标注、位置和跨实例通知；
- `v3-db.js`：IndexedDB Schema 3、迁移、事务历史和修订号冲突检查；
- `v3-model.js`：规范化、实体构造、备份校验、短语词元和投影；
- `v3-import.js`：TXT/Markdown/CSV/JSON 解析、预览数据和导出；
- `v3-ai.js`：Groq 模型目录、请求重试、结构化 AI 新增、搜索联想和分批核查；
- `sw.js`：离线缓存与用户确认式更新。

## 2. 数据实体

- Domain；
- Collection（normal / system-phrases）；
- Entry（word / phrase）；
- Membership；
- PhraseToken；
- Pin；
- Annotation；
- Settings；
- History。

Entry 英文在词域内唯一。Membership 只保存关联、当前词表词性和来源顺序，不保存重复英文。

## 3. UI 状态分层

### 持久业务状态

位于 IndexedDB：词域、词表、Entry、Membership、PIN、标注、序号、位置和历史。

### 本地敏感/网络设置

位于 localStorage：Groq API Key、当前模型、模型目录和刷新时间。它们不进入完整 JSON。

### 临时 UI 状态

位于 `v3-ui.js` 内存：

- 当前词表；
- 每个词表的展开字母；
- PIN 当前索引；
- 标注审阅索引；
- 当前 AI 任务；
- 对话提交回调；
- 当前局部列表渲染上下文。

## 4. 浏览渲染

- 普通词表使用字母 Section；短语表使用同一行组件但不生成首字母标题；
- 普通词表只投影 word，短语表只投影 phrase；
- 展开一级行时局部生成关系子项，不重建整表；
- 搜索/PIN/位置/标注通过 `ensureEntryRendered()` 局部展开；
- `jumpToEntry()` 只执行一次定位和目标高亮；
- 手动滚动通过防抖保存当前词表内稳定可见 Entry。

## 5. 对话容器职责

- `app-dialog`：新增、编辑、设置、导入和 AI 启动表单；
- `action-dialog`：低频动作菜单；
- `search-dialog`：搜索输入、范围和结果；
- `confirm-dialog`：危险操作确认。

主表单支持子层入栈与返回；动作、搜索和确认仍使用职责明确的独立容器。

## 6. 并发与数据一致性

- 所有业务修改通过 Store 的 `mutate()`；
- DB 写入验证预期修订号和 before 快照；
- 历史记录和业务提交保持一致；
- BroadcastChannel 通知其他同源实例；
- 上次位置使用原子设置合并，不挤入业务撤销历史；
- AI 每批结果按词项快照提交 Annotation，不直接修改 Entry。

## 7. PWA 更新

活动 Service Worker 始终从当前缓存提供同代 App Shell，避免新 HTML 与旧 JS 混装。新 Worker 安装完成后保持 waiting；只有用户点击“立即更新”才发送 `SKIP_WAITING`，随后在 `controllerchange` 时重新载入一次。
