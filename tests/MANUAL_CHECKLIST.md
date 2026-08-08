# Vocabulary Index 4.0.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 自动测试只证明源码、模型、事务和可模拟布局。以下 iOS WebKit、原生手势、VisualViewport、外部 App 与 PWA 生命周期必须由 iPhone 17 标准版 standalone 实测。

## A. 安装/世代/离线

- [ ] 从 3.5.2 旧数据启动时被 4.0.0 世代替换流程阻断，能选择先下载旧备份或明确不备份。
- [ ] 最终确认清楚列出将删除旧内容、自建内容、PIN、日期、Annotation、浏览状态与 Undo/Redo。
- [ ] 替换后进入 4.0.0；Groq/Collins Key、Groq 模型和一般显示偏好仍在。
- [ ] 旧 VIX v1 / 旧 Full Backup 导入给出明确不兼容提示，不静默迁移。
- [ ] Home Screen 图标为 `V`，不再显示 Oxford 图标。
- [ ] 飞行模式可冷启动、浏览、复制、PIN/日期/标注；在线 Provider 明确失败而不污染本地状态。
- [ ] 杀掉 PWA 进程后重开不出现旧 HTML/新 JS 混用。

## B. Home / fresh navigation

- [ ] 任意返回 Home 后全局区默认显示“全局词汇/全局短语”。
- [ ] 切换到“全局非结构内容”后显示内容总表；离开 Home 再回来自动恢复结构化默认。
- [ ] 从 Home 进入结构化普通词表总是 alphabet、顶部、全部字母组收起。
- [ ] 有词汇的结构化普通表优先 word view；没有词汇但有短语时才 phrase view。
- [ ] 进入 nonStructured Collection 显示 content；底部 word/phrase 按钮保留槽位但灰度禁用。
- [ ] fresh navigation 不恢复旧 date mode、旧滚动或旧展开状态。

## C. Recursive Back / explicit jump

- [ ] A 表滚动/展开/日期模式 → 关系或搜索跳 B → 返回，A 的 viewKind/mode/月/scroll/展开组/关系状态完整恢复。
- [ ] PIN、搜索、关系、浏览锚点跳转只展开目标组并稳定定位目标 Entry。
- [ ] 普通 word↔phrase、alphabet↔date 切换回顶部且组收起，不偷偷读取目标视图旧位置。

## D. Sticky / 字母轨道

- [ ] 顶部 A 小标题从页面首部即可正确触发 sticky，无“必须先滚一段才开始”的死区。
- [ ] sticky 标题与字母栏/顶部有效底边无缝隙、无覆盖。
- [ ] 快速向下/向上滚、A↔后段字母、# 边界、橡皮筋回弹都不出现活动字母错误或轨道强制吸回。
- [ ] 人工横滑字母轨道后立即纵向滚，手势所有权自然释放，不依赖固定延迟跳回。

## E. 一级 Entry row

- [ ] 英文、繁体释义、日期/控件、独立域来源没有挤压成竖线或异常换行。
- [ ] 独立域来源仍位于右侧 secondary 区，其 Y/baseline 与繁体释义使用同一垂直判定；无来源/无释义时另一侧独立居中规则正确。
- [ ] 跨域同形来源副字、序号、日期和控件不互相侵占。
- [ ] 点击英文复制完整文本，长词/短语不被截断复制。

## F. 全局不可选择与浏览锚点长按

- [ ] 普通页面、Entry、标题、Toast、关系菜单、弹窗说明文本不可出现 iOS 蓝色文本 Selection/拖拽手柄/系统 Look Up 菜单。
- [ ] input/textarea/contenteditable 仍可正常选取、移动光标和编辑。
- [ ] 浏览锚点短按正常跳回；长按约 520ms 成立即保存，松手后才显示成功 Toast。
- [ ] 长按成功松手后 350ms 左右缓冲期不会选中刚出现的 Toast 或附近页面文本。
- [ ] 长按失败（无目标/写入异常）后错误提示也不会被同一原生长按接管。
- [ ] pointercancel、手指位移取消、阈值附近松手均无迟到 click、contextmenu、callout 或 Selection。
- [ ] grace 结束后普通按钮点击立即恢复，无“页面被隐形锁住”的残留状态。

## G. Dialog / VisualViewport

- [ ] Confirm、搜索、设置、数据交换、导入预检、查询结果分别按任务内容占用面积，不统一膨胀成大卡片。
- [ ] 弹窗打开首帧不先出现再跳位；关闭/连续打开不抖动。
- [ ] 底部无额外白块，Backdrop 覆盖可见屏幕。
- [ ] 弹窗打开时背景页面完全锁住；弹窗内部不可滚区域滑动不传给背景。
- [ ] 搜索/API Key 键盘弹出时卡片只因真实 VisualViewport 变化重新适配，不上下剧烈跳动。
- [ ] 关闭弹窗后原页面 scroll/toolbar/sticky 不漂移。

## H. 58px toolbar / 原生手势

- [ ] 58px bottom toolbar 视觉高度和触控舒适度保持 3.5.2 真机满意状态。
- [ ] Home Indicator/系统上滑/边缘返回不被误触；不需要独立 safe-area 白带。
- [ ] 正文最后一项可完整滚到 toolbar 上方，不被遮挡。

## I. Projection / 优先级占有

- [ ] 同域 word 多 Membership 只在最高优先普通表可见。
- [ ] 同域 phrase 多 Membership 同样只在最高优先普通表可见（修复历史遗漏）。
- [ ] nonStructured content 多 Membership 同样只在最高优先普通内容表可见。
- [ ] 调整 Collection 优先级后 Entry 可见 owner 正确移动，PIN/日期/Annotation 仍绑定原 Entry。
- [ ] 域总表/全局总表仍显示具体 Entry；系统总表无新增/直接写入入口。

## J. Relations / 四态

- [ ] 词↔短语、词↔content、短语↔content 的精确关系双向可达。
- [ ] 跨域同形词与 phrase/content 的关系不存在单向通路。
- [ ] 一个 Entry 多 Membership 只生成一个 canonical 导航目标，不在多目标菜单重复。
- [ ] 仅当前 structured 域一个目标 → 域内唯一图标。
- [ ] 仅其他 structured 域一个目标 → 域外唯一图标。
- [ ] 仅 nonStructured 一个目标 → 非结构唯一图标。
- [ ] 任意 2+ 有效目标（同域/外域/非结构任意组合）→ 多目标菜单，全部列出，不做同域优先过滤。
- [ ] Domain 开启“不参与关联”后相关边从 UI/AI context 消失，但关闭开关立即恢复，无 rebuild 等待。
- [ ] 默认“关闭低级词汇关联”隐藏低信息代词/介词/数词等边；关闭该设置后立即恢复完整 Raw Relations。
- [ ] 低级关系设置不改变搜索结果、Membership、PIN、日期、Annotation 或 Entry 数量。

## K. Search

- [ ] 首页默认搜索范围为全部内容。
- [ ] Collection 默认范围代表该 Collection 当前有效可见的完整内容：structured 同时搜 word+phrase；nonStructured 搜 content。
- [ ] 域词汇总表默认仅 domain words；域短语/内容总表同理。
- [ ] fuzzy typo、prefix、substring、中文释义等召回继续可用。
- [ ] 搜索模糊结果不会新建 relation edge。
- [ ] 跨域同形搜索结果分别显示并带来源，不合并具体 Entry。

## L. Providers

- [ ] 查询菜单顺序固定 Oxford → Collins → Groq → ChatGPT。
- [ ] Oxford 只发送英文纯文本，不改日期/PIN/浏览状态。
- [ ] Collins 未配 Key 时提示配置；真实 Key 下 API 可用时显示临时结果。
- [ ] 若 standalone CORS/网络拒绝 Collins API，结果页提供 Collins 网站降级入口，不引入代理。
- [ ] Groq 使用当前选定模型，单条核查卡不写 Seed/Annotation。
- [ ] Collins/Groq 查询中关闭结果页或发起新查询，旧请求 abort；迟到响应不得重新打开/改写 UI/Toast。
- [ ] ChatGPT 调用准确快捷指令 `AI查询`；高关联 Entry 的 URL 可被 iOS Shortcuts 接收且 JSON 不截断。
- [ ] ChatGPT context 不包含 PIN、学习日期、Annotation、全量 Membership 或 raw relation component。

## M. 数据 / VIX / Backup

- [ ] VIX v2 structured Domain 导入、导出、再导入一致。
- [ ] VIX v2 nonStructured Domain/content 导入、导出、再导入一致。
- [ ] Full Backup Schema6 恢复完整个人状态；API Key 不进入备份文件。
- [ ] replace/删除/整代替换前备份分支正常，取消不会修改数据。
- [ ] 数据改变后 relation component / projection / search index 同步，不留悬空引用。

## N. 最终签收

- [ ] 真实 iPhone 17 standalone 全流程通过。
- [ ] 无 P0/P1 数据可靠性或导航错误。
- [ ] Dialog、sticky、longpress 三项 3.5.2 主要真机遗留已实际消失。
- [ ] 可将本 ZIP 标记为 4.0.0 稳定部署基线。
