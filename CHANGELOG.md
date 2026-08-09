# Changelog

## 4.2.0 — 2026-08-09

- Alphabet Sticky 从独立 mirror 回归真实 `.letter-heading` native sticky；浏览器恢复 collapsed 自然退出、section-bottom push-off、真实点击锚点与 section side rails；JS metrics 只负责 active 字母；
- Query chooser 改为 relation multi-target 风格右缘挂接，再左退 10px；viewport inset 12px，浮层与 Entry 框线 gap 13px；
- Oxford 放弃旧参考图几何忠实，重设计为与 Collins/Groq/ChatGPT optical bounds 一致的紧凑 closed-book outline；
- 撤销 4.1.0 System Shell Surface 动态染色实验；custom/native backdrop 恢复 full Web viewport，不再运行时修改 theme-color/root/topbar；
- Home `Vocabulary Index` 顶栏使用独立 serif Product Wordmark；Hero 大字“词汇索引”保持；
- `全局` 标题恢复 Domain 同级 15px/740，删除 3.x 遗留淡完整矩形框，改为标题与动作之间的轻量 Index Rule；
- Topbar 新增 Root Home：depth>=2 显示 Back+Home；Home 一次回 root，并用 `navigationEpoch` 失效旧 recursive pageSnapshot/forward history 语义，不清业务数据或 Undo/Redo；
- 保留 4.1.0 的字母 cell border、parallel switch、PWA 名称、全局非结构总表、Entry secondary gap、日期 StudyStamp 原位刷新；
- 新增 `css/v4.2.0.css`，Service Worker cache generation 升级 4.2.0；同步完整生命周期文档。

## 4.1.0 — 2026-08-08

- Top Chrome 以真实 DOM rect 为唯一几何源，删除 VisualViewport + 72px 混合硬下限；字母栏未真实吸顶前不展示 Sticky mirror；
- 字母栏重构为按钮单元格拥有结构边框：每格 top/right/bottom，首格 left；disabled/empty 只灰前景，不灰结构线；
- 字母 Sticky 补齐结构边界，日期/字母模式共享统一顶部几何；
- 日期模式刷新学习日期继续保持当前 viewport，不恢复 `study-date` 目标跳转；
- Query chooser 使用明确 viewport edge inset；Oxford 严格按用户参考图重绘“合上的书”SVG；
- 一级 Entry secondary line 再收紧，繁体与来源保持同 Y，操作触控尺寸不缩；
- Home 全局区切换改为左侧“上→ / 下←”平行反向箭头图标，管理按钮置右；大字“词汇索引”保留，topbar/PWA 安装名统一 `Vocabulary Index`；
- “全局非结构内容”展示名更新为“全局非结构总表”，稳定 ID/Schema/Seed/VIX 不变；
- Modal system shell 改为按 retained stack depth 逐层 alpha compositing（48% 第一层、20% 后续），同步 theme-color/root/fixed topbar，custom backdrop 从 topbar 下缘以下开始，避免双重蒙版；
- 新增 `css/v4.1.0.css`，Service Worker cache generation 升级 4.1.0；同步完整生命周期文档。


## 4.0.2 — 2026-08-08

- 修正 4.0.1 字母 Sticky 几何：内容顶部边界统一为基础 Chrome 实测底边 + 字母栏实测高度，不再依赖字母栏瞬态 flow 位置；
- 同一边界统一覆盖全局/域/普通 Collection 与 word/phrase/content，消除 Sticky 被字母栏遮挡和同源镂空；
- 日期模式刷新学习日期保持当前视口，不再自动跟随被刷新 Entry 跳到今天；
- Query chooser 再左移并保证右边框露出；Oxford 重绘为闭合书本，四 Provider 统一深色描边；
- Modal 打开/关闭同步 theme-color 与页面底色到第一层蒙版合成色；iOS 26.5.2 若仍保留 DOM 不可达顶部状态条，作为 WebKit 平台限制记录；
- Schema 6 / DB 5 / Seed 4 / VIX 2 与全部 4.0.0 业务语义保持不变。

## 4.0.1 — 2026-08-08

- 真机反馈收口：重建 Sticky 为普通分组标题 + 单一展示层 + metrics 二分定位，消除字母栏镂空与滚动扫描迟滞；
- `app-dialog`/action 改为 retained modal stack，父层 DOM/输入/滚动保留，子层独立 backdrop + inert；
- Settings/管理词库/action 使用受限管理高度，删除无必要常驻说明文字，card 两帧稳定后 reveal；
- 补齐 content normal/two-line/extreme，收紧繁体/来源 secondary row；
- 查询菜单增加 Provider 副字，仅重绘 Oxford/ChatGPT 对齐现有 Collins/Groq；设置 checkbox 改产品视觉；
- Modal Host 改为应用 DOM 全屏遮罩并延伸至 safe-area；状态栏维持 light-page 友好的 `default`，Schema6/DB5/Seed4/VIX2 与 4.0.0 数据语义不变。

## 4.0.0 — 2026-08-08

- 合并原 3.6.0/4.0.0 候选路线为单一 major generation；Schema 6 / DB 5 / Seed 4 / VIX 2，旧导入硬断代；
- Domain 增加 structured/nonStructured 与可逆 relationExcluded；新增“通用英语搭配” nonStructured Domain；
- Entry 扩展为 word/phrase/content，POS/contentType 作为属性；word/phrase/content 全部执行普通表优先级占有；
- PhraseToken 中心关系升级为通用 RelationComponent，全局精确匹配并双向维护；新增默认开启的“关闭低级词汇关联”逻辑过滤；
- 关系导航改为域内唯一／域外唯一／非结构唯一／多目标四态，多目标展示全部有效目标；
- 搜索范围统一，搜索保持 fuzzy 且与 relation exact 彻底解耦；
- 查询入口固定 Oxford → Collins → Groq → ChatGPT；Collins/Groq 使用可取消 session；ChatGPT context 升级 v2 并显著缩短 Shortcut URL；
- fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 继续恢复完整页面快照；
- dialog 去全屏 shell，sticky 使用统一 DOM 几何，longpress 增加 350ms invisible grace；普通 UI 文本默认不可选，编辑控件白名单恢复；
- bottom toolbar 保持 58px 视觉尺寸且不恢复 Home Indicator 白带；来源 secondary Y 与繁体释义统一；
- Home Screen PWA icon 改为 Vocabulary Index `V`；
- 同步 4.0.0 生命周期、架构、数据、UX、迁移、测试与影响矩阵文档。

## 3.5.2 — 2026-08-04

- 以唯一可信的 3.5.1 Clean Rebuild 完整包为基线，不引用两份已废弃 3.5.1 错版；
- 一级表项拆为序号、词汇信息栈、控件信息栈，删除来源触发的隐藏繁体释义占位；
- 繁体释义与独立域来源采用一致次级行指标，各自独立扩展并纵向居中，来源单行右对齐省略；
- sticky 小标题与顶部有效底边零缝隙，Overlay 几何更新合并为每帧一次；
- 字母轨道人工横滑改为状态锁，页面顶部 A 与页面底部 # 均不会因固定延迟或边界回弹立即归位；
- 浏览锚点长按达到阈值后先保存、抬手后提示，Pointer Cancel 保留已完成保存但不显示 Toast；
- 底部工具栏试行固定 58px，删除独立安全区白带；禁用按钮只灰化图标，结构分隔线保持原色；
- native dialog 使用稳定全屏根层，内部卡片才跟随 VisualViewport，查询／关系菜单同步避让底部停靠栏；
- 字母／日期、词汇／短语普通切换统一进入顶部且全部分组收起，删除 Entry 映射和目标页旧状态缓存；
- 递归返回快照补充 mode、calendarMonth 和统一 expandedGroups；
- 日期模式的具体日与“未标注”支持展开／收起，年／月保持结构标题；
- Manifest 启动颜色统一为 `#fafafa`，最新 CSS 由 `v3.5.2.css` 替换 `v3.5.1.css`；
- 封装 3.6.0 查询 Provider 与 4.0.0 Seed／Domain 模型为暂定路线，等待 3.5.2 真机验收；
- Backup Schema 5、IndexedDB 4、Seed revision 3、VIX 1 和业务 Seed 保持不变。

## 3.5.1 — 2026-08-03

- 从 3.5.0 完整源码清洁重建，不使用两份已撤回 3.5.1 错版源码；
- 统一主要弹窗的视觉视口 Shell、物理居中标题、内部宽度与滚动所有权；
- 手动模式切换不再恢复目标模式旧位置：正文保持当前 Entry，顶部／日历状态回顶部；
- 原上次位置改为手动浏览锚点：短按跳转、长按保存，滚动和程序跳转不自动覆盖；
- 字母栏改为首尾警戒区提前跟随，加入方向滞回、手势结束同步和 A/# 硬边界；
- 保留并验证字母标题／导航完整展开链，新增运行时符号与 TypeScript checkJs 防截断测试；
- 序号与英文组成主行，繁体释义与英文左边缘对齐；
- 跨域来源改为表项框内右下元信息，与释义共享第二行，不再造成额外顶部增高；
- 无关系条目保留不可见首操作槽，日期和其余控件保持对齐；
- 日历新增外侧双箭头年跳转，单箭头月跳转向内移动；
- Backup Schema 5、DB 4、Seed revision 3、VIX 1 与主体数据模型保持不变；
- 两份旧 3.5.1 包标记为已废弃、警告性历史，不得继续引用。

## 3.5.0 — 2026-08-03

- 保留 3.4.0 的 Schema 5、系统总表具体 Entry 投影、全局计数和序号模型；
- 普通词表拆分为词汇／短语独立视图，分别保存模式、位置和展开状态；
- 恢复任务型底部五项工具栏，顶部字母轨道只包含字母；
- 建立应用内部页面快照和返回栈，修复跨词表返回首页及同页跳转失效；
- 字母跟随取消平滑追赶，真实小标题自身 sticky，删除复制式毛玻璃标题；
- 重写一级表项：序号正文前置、可选日期不占空位、关系按钮回到操作区、删除右侧附着轨道；
- 无释义／有释义条目分别采用紧凑单行／双行，修复长词、短语和横滑裁切；
- 跨域来源副字移到表项边框右上角；
- PIN／标注导航重新设计为完全不透明、紧凑、直角的底部停靠栏；
- 固定弹窗增加 iOS body 固定和 touchmove 边界锁，阻止背景滑动穿透；
- 查询总入口图标保持不变，仅重绘 Oxford／ChatGPT 选项图标并缩小锚定菜单；
- 结构性 UI 改为直角或极小圆角，移除残留渐变、结构阴影、毛玻璃和目标高亮竖线；
- 保留普通词汇的词表优先级占有机制，优先级仍用于宏观词汇归属调配；
- AI 人工标注保护、单任务聚合 Undo、Abort 与增量导入事务等待进一步收口；
- 同步更新 `PROJECT_HISTORY.md` 和 3.5.0 全套交付文档；
- Backup Schema 5、IndexedDB DB version 4、Seed revision 3、VIX 1 保持不变。

## 3.4.0 — 2026-08-03

- 将全局与域内词汇／短语总表统一为具体 Entry 的特殊投影视图；
- 全局跨域同形词与同形短语改为分别显示具体 Entry，按独立域顺序排列，冲突行显示来源副字；
- 全局唯一计数与实际渲染行数分离，并实现连续、字母小标题和日期小标题三套组序号规则；
- 学习日期升级为具体 Entry 状态，完整备份 Schema 升至 5，兼容迁移 Schema 4；
- 搜索改为范围优先，修复普通表、域内表和全局表的结果漏失；
- 关系跳转改为唯一域内、唯一域外、多目标三态，多目标使用锚定扁平选择菜单；
- AI 核查增加真正 Abort、过期结果保护和单任务单条撤销历史；
- VIX 导入增加 Revision 过期保护，歧义裸键按脏归属跳过并报告；
- 新增滚动字母温和跟随、真实 sticky 字母标题及稳定折叠锚点；
- 修复顶栏标题与置顶图标居中，释放无序号和空日期空间，增加可见短语真实溢出升级；
- 首页删除左侧装饰线，并去除全局渐变、系统卡片渐变及廉价阴影；
- 新增 `PROJECT_HISTORY.md`，作为每次完整 ZIP 必带的正式全生命周期交接文件；
- IndexedDB DB version 4、Seed revision 3、VIX 1 和业务 Seed 内容保持不变。

## 3.3.1 — 2026-08-02

- 修复全局词汇／短语总表上次位置作用域及跨模式去重；
- 修复删除、重命名和替换后的孤儿学习日期与失效 Membership；
- 修复 pending jump、重复 render、重复路由和关系不可见目标；
- 修复 iPhone 标注逐条操作、当前词表审阅和全局聚合；
- AI 标注改为局部事务并增加旧 Entry 快照保护；
- 修复首页顶栏、序号遮挡、返回顶部遮挡、顶部透底和覆盖层位置；
- 收口关联附着件、二级跳转、横滑提示、弹窗关闭和管理计数；
- 高危操作改为“下载备份／不下载”选择，两项均继续后续确认；
- Schema 4、Seed revision 3、VIX 1 和业务 Seed 保持不变。

## 3.3.0 — 2026-08-02

- 重构为状态栏安全的固定紧凑导航＋滚动大标题；
- 首页返回恢复离开前的位置，冷启动仍从顶部开始；
- PIN、标注审阅和首页黄色警告条改为不参与布局的覆盖层；
- 分离固定工具区与横向字母轨道，修复“返回上次位置”重影；
- 标题跳转统一停在动态顶部下方，条目跳转使用上部阅读锚点；
- 弹窗按确认、表单、操作、搜索和锚定菜单分别设计；
- 输入窗口默认不聚焦，不自动弹出键盘；
- 一级表项回归紧凑结构，统一预留右侧关联附着轨道；
- 普通词汇和释义单行共同横滑，长短语两行压缩，极限短语使用约 1.5 倍高度双区布局；
- Oxford 与 ChatGPT 合并为双图标查询菜单，传输协议保持不变；
- AI 标注条目采用红色渐变警告，增加当前词表和全局一键撤销；
- Seed 重置改为先下载完整备份、再用小型确认窗确认；
- 统一重绘主要操作、关系、查询、警告和导航图标；
- 保留并扩展分块渲染、关系索引、局部事务和滚动限流性能保护。

## 3.2.0 — 2026-08-02

- 运行目标收敛为 iPhone Safari 主屏幕 PWA；
- 首页字号与层级重构，删除重复 Hero；
- 系统总表增加淡侧向渐变；
- 一级表项改为文本信息行与操作行；
- 长列表分块渲染、SVG 缓存和关系惰性解析；
- 滚动位置追踪与可见性查询优化；
- 移除 sticky 背景模糊；
- 增加 standalone PWA 后台 viewport 恢复防御。

## 3.1.1 — 2026-08-02

- 一级表项新增牛津英汉辞书直接查询；
- 一级表项新增 ChatGPT 新聊天快捷指令集成；
- 新增 `vix-entry-context` v1 条目上下文 JSON；
- 全局聚合项导出全部独立域实例；
- 不修改 Schema、Seed revision 或词库内容。

## 3.1.0 — 2026-08-02

- 新增一级词汇与短语的手动学习日期、日期刷新、日期排序、简易日历、年月日三级标题和未标注区。
- 字母模式与日期模式分别保存浏览位置；复合普通表的词汇区与短语区分别保存两种模式的位置。
- 普通表改为词汇区＋短语区，普通 Membership 同时支持 word 和 phrase。
- 全局与独立域短语总表重新引入字母导航和字母标题。
- 新增普通表双区互跳和页面级返回顶部。
- 总表统一命名，并保持严格单类型。
- 关联跳转只进入普通表；总表只许跳出，不许跳入。
- 全局总表确认为系统聚合投影，不拥有独立新增内容。
- Schema 与 IndexedDB 升至 4，新增 StudyStamps。
- Seed revision 升至 3，将通用英语及计算机术语短语分类到普通表。

## 3.0.7 — 2026-08-01

- 将 544 个计算机术语普通词划分为四个互斥普通词表：计算机基础与系统、软件开发与数据、网络/云与安全、人工智能。
- 保留总词表和唯一短语表，577 条短语不拆分。
- 首页继续使用全局层与独立词域层的视觉封装。
- 首页设置新增统一“数据交换”中心。
- 新增 VIX JSON 内容交换格式，支持全局、独立域、词表三级导入导出。
- 支持增量合并、选定范围完整替换、差异预检、释义冲突处理和自动恢复备份。
- JSON 解析与差异计算移入 Web Worker，提交阶段只进行一次数据库恢复事务。
- 内置 Seed 修订升至 2，既有 3.0.5 数据库可幂等补充四个分类词表。

## 3.0.5

- 首页增加全局与独立词域的视觉封装；
- 新增 1,121 项“计算机术语”内置词域；
- 默认开启繁体释义；
- 支持既有 Schema 3 数据库幂等合并新内置域；
- Collection 支持隐藏内部来源。

## 3.0.4

- 新增全局短语表。
- 固定全局和词域的总表/短语表顺序。
- 短语组成词改跳优先普通词表。
- 新增统一阅读锚点、高亮、准星占位和 SVG 图标。
- 繁体释义改为表项行内显示。
- 关联子项恢复文字复制，跳转使用独立控件。

## 3.0.3 — 2026-08-01

- 修复 3.0.2 高频路径中的整库复制、重复关系计算和 PIN 全量事务。
- 建立词汇—短语、短语—组成词及跨词域同形词内存索引。
- 搜索输入合并执行，并增加性能防回归测试。

## 3.0.2 — 2026-08-01

- 严格分离普通词表的词汇投影与短语表的短语投影。
- 普通词表保留字母分组；短语表改为无首字母标题的平面列表。
- 行内展开双向关系并按字典序排列。
- PIN 改为行内直接操作。
- 删除独立详情弹窗和所有词性展示。
- 修复上次位置跨表跳转和重复入口。
- 搜索增加全部 / 词域 / 词表三级范围。
- 管理页改为拖动排序。
- 增加栈式弹窗返回和 iOS 搜索视口锁定。
- 压缩首页卡片，消除上部过量留白。
- 移除“词项”等重复说明文字。
- 使用独立 3.0.2 Service Worker 缓存。
- 修复空关系面板显示 `null`。
- 取消字母、搜索和关联跳转的平滑等待。
- 搜索不再自动聚焦，减少 iOS 键盘开合抖动。
- 新增全局总表与每个词域的总词表。
- 关联子项从复制改为优先跨表跳转。
- 多实例写入冲突自动同步并重试一次。
- 移除触控残留焦点框与管理器多层边框。


## 3.0.0 — 2026-08-01

- 引入词域、词表、Entry、Membership、短语实体、PhraseToken、繁体释义和 2.x 迁移。
- 引入 Groq 模型目录、AI 新增、分批核查和标注审阅。
