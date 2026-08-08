# Vocabulary Index 4.0.2 本地架构

## 1. 架构目标

单设备、local-first、iPhone standalone PWA。架构优先保证数据身份、投影一致性、可恢复导航和低摩擦浏览；不为桌面、多端同步或服务端架构增加额外复杂度。

## 2. 模块

- `js/v3-model.js`：Schema 6 实体、规范化、投影、精确关系组件、搜索、校验。
- `js/v3-db.js`：IndexedDB 5、Seed 4、完整备份、硬断代内容世代替换。
- `js/v3-store.js`：内存状态、Projection、Raw/Effective Relation Graph、事务操作。
- `js/v3-ui.js`：Home/Collection shell、导航历史、统一顶部几何、单一 Sticky Heading Layer、retained Modal Stack、longpress、搜索和 Provider UI。
- `js/v3-exchange.js`：VIX v2 导入/导出与预检。
- `js/v3-import.js`：文本/CSV/JSON 输入；拒绝旧世代 Full Backup。
- `js/v3-ai.js`：Groq 模型发现、批量 AI 核查、临时词汇查询。
- `js/v3-integrations.js`：Oxford、Collins、ChatGPT 紧凑上下文。
- `js/v3-upgrade.js`：4.0 缓存桥，只清理旧 Vocabulary Index 缓存。
- `sw.js`：离线外壳与版本化缓存。

## 3. 数据身份与投影

`Domain → Collection ← Membership → Entry` 是内容事实链。Collection 的普通 Membership 可多重存在；`buildProjection()` 按 Collection order 选择一个可见 owner。这个规则统一用于 word / phrase / content。

系统总表均为虚拟投影：

- structured Domain：词汇总表、短语总表；
- nonStructured Domain：内容总表；
- global：全局词汇、全局短语、全局非结构内容。

系统总表不能成为 Entry 的状态所有者或直接写入目标。

## 4. 关系层

关系层分三步：

1. `RelationComponent[]`：phrase/content 中与现有 Entry 规范文本精确对应的连续 span；
2. Raw Graph：按规范文本全局解析并强制对称；
3. Effective Graph：在 Raw Graph 上应用 Domain `relationExcluded` 与 Settings `closeLowLevelRelations` 逻辑过滤。

搜索的 fuzzy 算法不进入关系构建。改变搜索容错阈值不得改变任何 relation edge。

低级词汇表位于 `data/relation-low-level-lexemes.json`，仅控制关系投影；不删除 Entry、Membership 或组件。

## 5. 导航与 History

入口分两类：

- **Fresh navigation**：首页进入 Collection。强制 alphabet/top/collapsed；structured 有 word 时 word-first。
- **Recursive return**：内部跳转返回。恢复 collection、viewKind、mode、calendarMonth、scroll、expandedGroups、relation state。

搜索、PIN、关系和浏览锚点属于显式目标跳转，会定位目标；普通 word/phrase 或 alphabet/date 切换不映射旧位置。

关系目标先解析每个具体 Entry 的 canonical visible destination，再按当前有效目标总集合分类四态。一个 Entry 多 Membership 不会制造多个菜单目标。

## 6. UI 几何与弹层

- 基础顶部 Chrome 由真实 DOM rect 测量；字母模式的最终阅读边界固定为“基础 Chrome 底边 + 字母栏当前实测高度”。字母栏是否已经从文档流滚入 sticky 状态，不再改变这个最终占位值。
- `--sticky-base-top` 只代表基础 Chrome；`--content-sticky-top/--chrome-bottom` 代表完整阅读边界。字母栏隐藏的日期模式自动退化为基础 Chrome。
- 真实字母 heading 不再 sticky；运行时维护 `alphabetSectionMetrics`，滚动时二分得到 active section，单一 `sticky-letter-heading` 只负责展示。全局/域/普通 Collection 与 word/phrase/content 共用同一函数。
- bottom toolbar 视觉高度 58px，但阅读区域避让读取实际 DOM。
- application form/action 使用 `modal-host → modal-layer → modal-card` retained stack。父层不替换 DOM，只设 inert；子层拥有独立 backdrop。Settings/Manager/action 使用统一受限高度，只有 `.dialog-body` 滚动。
- search/confirm 仍是 native dialog utility layer；VisualViewport 仅在真实键盘/视口变化时参与布局。
- standalone 状态栏保留 `default`；Modal 开启时 theme-color 与 under-page background 做蒙版合成色 best-effort 同步。iOS 26.5.2 若保留系统绘制的 DOM 不可达顶部带，记录为 WebKit 平台限制。

## 7. 输入/选择模型

非编辑 UI 默认 `user-select:none`、`-webkit-user-select:none`、`-webkit-touch-callout:none`；input/textarea/contenteditable 显式恢复原生编辑。

浏览锚点长按使用手势状态机：PRESSING → LONGPRESS_ACTIVE → GRACE → IDLE。GRACE 只保留事件所有权，不保留 Pointer Capture，也不制造可见 overlay。

## 8. Provider 会话

Collins/Groq 共用单一前台 Provider Session：新查询 abort 旧查询；关闭弹窗后 stale response 不得更新 UI。Oxford 与 ChatGPT 是外部跳转，不写用户状态。

ChatGPT `vix-entry-context` v2 限制直接关系数量，确保 URL 不再随全库对象爆炸。

## 9. PWA 生命周期

4.0.2 使用独立 Service Worker cache generation；4.0.0 的 Schema/Seed 世代不变。启动代码验证 HTML/JS 版本一致；旧缓存只由 4.0 cache bridge 清理。最终部署仍需在 iPhone standalone 验证冷启动、离线、系统进程回收和外部 App 返回。
