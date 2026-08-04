# Vocabulary Index 3.5.2 本地架构

## 目标

架构只服务 iPhone standalone PWA 的单用户本地工作流。无远程业务数据库、账户或同步服务器。

## 模块

- `v3-app.js`：版本校验、Service Worker、standalone 检测、viewport 恢复；
- `v3-db.js`：IndexedDB DB version 4、Schema 5 完整备份、事务、Undo/Redo；
- `v3-model.js`：规范化、验证、Schema 迁移、系统总表投影、PhraseToken；
- `v3-store.js`：内存状态、具体 Entry 索引、可见 ID 集合、局部写入和范围搜索；
- `v3-ui.js`：动态顶部、sticky 字母标题、一级表项、关系、日期模式、分块渲染和弹窗；
- `v3-exchange.js`：VIX 内容包、差异计划、脏归属报告；
- `v3-integrations.js`：Oxford 与 ChatGPT 快捷指令；
- `v3-data-worker.js`：大型 JSON 解析与预检；
- `v3-ai.js`：Groq 模型目录、分批核查、暂停与 Abort。

## 投影模型

系统总表不是持久化真实词表：

- 域内词汇总表：当前域具体 word Entry 的投影；
- 域内短语总表：当前域具体 phrase Entry 的投影；
- 全局词汇总表：所有域具体 word Entry 的投影；
- 全局短语总表：所有域具体 phrase Entry 的投影。

同一具体 Entry 的多个 Membership 在总表中去重；跨域相同规范文本保持为多个具体 Entry。全局投影额外预计算：

- `globalConflictKeys`：需要显示来源域的跨域同形组；
- `projectionUniqueCounts`：首页和标题使用的唯一词形组数量；
- 实际投影数组长度：渲染、分块、定位和性能计算使用。

PIN、Annotation 和 StudyStamp 均绑定 Entry ID。系统总表只读取和操作具体 Entry 状态。

## 渲染

- 固定紧凑导航与滚动 Large Title 分离；
- 真实字母标题使用 sticky，不创建重复悬浮副本；
- PIN、标注审阅和首页警告使用固定覆盖层；
- 顶部有效底边由 `topChromeBottom()` 统一提供给 sticky 标题、活动字母探针、程序跳转和菜单避让，不保留正文可透出的接缝；
- 一级表项按 42 行分块；首块同步生成，其余块接近视口时物化；
- 只有可见 `phrase-two-line` 行进行真实 DOM 溢出检查；
- SVG 图标模板按名称缓存；
- 完整关系只在展开时解析；
- 普通滚动不自动持久化浏览位置；底部浏览锚点只有长按约 520ms 才写入，短按只读取。

## 3.5.2 页面状态

- 字母／日期、词汇／短语属于普通切换：目标页顶部、全部组收起，不映射当前 Entry；
- 搜索、关系、PIN、日期和手动锚点属于明确目标跳转；
- 浏览器 History 只为真实递归返回保存完整页面快照，包括 view kind、mode、calendar month、scrollY、expanded groups 和 expanded relations；
- 日期具体日和“未标注”复用统一展开集合，年／月不折叠；
- 字母轨道横滑使用人工锁；顶部 A、底部 # 和边界橡皮筋都不能单独解除锁，只有 sticky 字母真实变化或显式点击字母才交回自动跟随。

## 3.5.2 视觉视口与停靠层

- native dialog 根层固定覆盖 Layout Viewport；内部卡片使用 VisualViewport 的中心、宽高和键盘状态；
- VisualViewport resize/scroll 合并更新查询菜单、关系菜单和 Overlay 几何；
- 底部工具栏试行固定 58px，PIN／标注栏统一停靠其上方；该数值只对当前 iPhone 17 真机验收负责；
- 禁用按钮只降低图标透明度，结构分隔线不继承禁用透明度。

## 搜索

搜索先计算范围 Entry ID 集，再在该范围内执行评分和截断。全局结果直接返回具体 Entry，因此跨域同形词和各自繁体释义均可独立命中。

## AI 事务

- 每批标注使用 Annotation 局部事务，不复制完整 Backup；
- Entry 文本或 `updatedAt` 发生变化时，旧 AI 结果被跳过且不清除原标注；
- 外部 AbortSignal 可中止当前 Fetch 和重试等待；
- 一次完整 AI 核查结束后只追加一条历史记录，Undo 恢复任务开始前的目标 Annotation 集合。

## 数据交换

预检在 Worker 中执行，返回带 `baseRevision` 的计划。最终提交前 Revision 变化时重新预检。VIX 裸引用若对应多个具体 Entry，则跳过该 Membership 并生成结构化问题报告。

## PWA 生命周期

- Service Worker 缓存 App Shell；
- 更新桥删除旧壳缓存；
- 后台恢复检测 WebKit 异常 viewport；
- 更新和 viewport 修复不清理业务数据库。
