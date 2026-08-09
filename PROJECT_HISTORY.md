# Vocabulary Index 项目全生命周期历史与交接文档

> 当前权威版本：Vocabulary Index 4.4.0（2026-08-10）。本文件记录产品使命、主要历史阶段、失败教训、现行规则、数据世代与交接边界。3.5.2 时点的旧全文快照保存在 `PROJECT_HISTORY_3.5.2_SNAPSHOT.md`；所有逐版本报告仍保留在源码包中。

## 状态标签

- **[当前实现]**：4.4.0 完整源码实际行为。
- **[历史稳定版]**：过去曾作为稳定交付基线。
- **[历史问题]**：导致故障/返工的经验。
- **[待真机]**：源码已实现但仍需 iPhone standalone 证明。
- **[数据 backlog]**：产品方向确认，但当前包缺少可信原始数据源，未伪造进入 Seed。

# 一、产品使命与边界

## [当前实现] 产品定位

Vocabulary Index 是 iPhone 主屏幕上的英语学习轻量入口：以 Domain/Collection 管理词汇、短语和非结构英语内容，通过连续浏览、位置恢复、精确关系和外部权威/AI 查询降低学习摩擦。它不是完整词典、卡片背词系统、AI 客户端或学习计划 Dashboard。

主平台：iPhone 17 标准版 standalone PWA；IndexedDB local-first；Service Worker 离线外壳。没有账号、后端和云同步。

# 二、生命周期时间线

## 1.x：单 HTML 原型

证明了索引交互，但 localStorage、文本主键、内联事件、伪保存和不可逆导入使其不适合长期数据。形成“业务身份必须稳定、写入必须事务化”的最早教训。

## 2.2.x：云同步试验与撤销

GitHub PAT/云同步增加失败面后被移除，正式确立 local-first 与手动备份路线。

## 2.3.x–2.4.1：本地稳定化

逐步修正保存、搜索、撤销、iPhone UI；2.4.1 成为 3.x 重构前行为参考，但旧 category/word 数据模型不再沿用。

## 3.0.0：Domain / Entry / Membership 世代

正式建立独立 Domain、具体 Entry、Membership、短语一等实体、繁体释义、IndexedDB 和事务。早期曾发生“需求文档完成但代码未完成、随后工作目录被重置”的交付事故，形成：**完成必须以源码+测试+hash证明，且工作目录不能无快照删除。**

## 3.0.1–3.2.0：一级表项、计算机域、VIX 与 iPhone 收敛

建立计算机术语域、VIX 内容交换、学习日期、Oxford/ChatGPT 快捷入口、惰性渲染和 iPhone 主屏幕运行边界。

## 3.3.0–3.4.0：关系/投影与 UI 大调整

建立系统总表投影、跨域同形具体 Entry、关系跳转和动态 shell。3.4.0 真机暴露弹窗穿透、返回栈、sticky/字母跟随、PIN 遮挡和普通词/短语同页冲突，证明静态 PASS 不能代表真实 WebKit 行为。

## 3.5.0：运行时/导航重构

普通 Collection 拆 word/phrase 视图、建立真实内部返回栈、底部五项工具栏、一级 row 直角体系、真实 sticky 标题和更稳定惰性渲染。

## 3.5.1 Clean Rebuild：[历史稳定版]

两份 3.5.1 曾因 `v3-ui.js` 截断导致字母展开函数丢失，正式废弃。可信 Clean Rebuild 从 3.5.0 重新实施，ZIP SHA-256：`66a43ed0dc2f83cc789e6003b96b21bea1cecf8672a0f36ac7ed1d03ada9cd38`。形成 runtime-symbol + TypeScript checkJs + fresh-extract retest 的永久交付门槛。

## 3.5.2：[历史稳定版]

正式 ZIP SHA-256：`ff55e956e3affb469519d9546298500a14af668dd0a424772cd5b47bcd2d9f89`。修正一级 row 栈、字母轨道状态锁、浏览锚点、日期折叠、58px toolbar、递归返回等。后续真机/审计证明仍有 dialog bottom band、sticky 顶部几何和 iOS 长按选择风险，同时发现跨域关系 952 条方向不对称和 ChatGPT context ~30k URL。

## 2026-08-04 预更新路线：[历史候选]

原本将查询 Provider 规划为 3.6.0，将 Seed/Domain 模型规划为 4.0.0。该路线保存在 `PREUPDATE_ROADMAP_2026-08-04.md`，但 2026-08-08 用户明确取消分版本方案并统一建模下一稳定大版本。

## 4.0.0：[历史稳定基线]

4.0.0 直接从 3.5.2 断代，合并查询、关系、Domain、Seed 和 iOS 运行时更新：

- Backup Schema6 / DB5 / Seed4 / VIX2；
- Domain `structured|nonStructured`；
- Entry `word|phrase|content`；
- word/phrase/content 全部优先级占有；
- `RelationComponent` 取代 phrase-only 关系中心，Raw Graph 全局精确双向；
- Domain 关系开关和“关闭低级词汇关联”成为可逆逻辑投影过滤；
- 四态关系导航；
- unified fuzzy search scopes；
- Oxford/Collins/Groq/ChatGPT；
- ChatGPT compact context v2；
- fresh navigation 固定 alphabet/word-first；
- Home global structured/nonstructured 临时切换；
- dialog 去全屏 shell、sticky 单一几何源、longpress grace、全局非编辑文本不可选；
- PWA identity 改为 `V`；
- 旧 Full Backup/VIX 直接拒绝，不做错误状态迁移。

## 4.0.1：[历史稳定基线]

4.0.1 不改变 4.0.0 内容世代，集中处理首轮 iPhone 真机反馈：

- 字母真实 heading 取消 sticky，改为单一 Sticky Heading Layer；section metrics + 二分定位替代滚动帧整页扫描；
- `app-dialog`/action 从 snapshot/replace 伪栈改为 retained modal stack，父层常驻并 inert，子层独立遮罩；
- Settings、管理词库与 action 卡片统一受限管理高度，body 自滚动，常驻开发说明文本从自用 UI 清除；
- modal 先显示 backdrop、card 两帧稳定后 reveal，解决 4.0.0 “不抖但闪现”；
- content 补齐 normal/two-line/extreme；一级 row secondary line 密度收紧；
- Query chooser 增加四 Provider 副字，仅重绘 Oxford/ChatGPT；checkbox 使用产品视觉；
- Modal Host 覆盖顶部 safe-area，状态栏保持 `default`，避免浅色常态页面引入错误前景对比。

Schema6 / DB5 / Seed4 / VIX2、优先级占有、搜索/关系、四态导航和 Provider 业务语义保持不变。

## 4.0.2：[历史稳定基线]

4.0.2 不改变 4.0.0 数据世代，也不推翻 4.0.1 retained Modal Stack；它针对第二轮 iPhone 真机证据修正顶部几何与局部交互：

- 复核确认日期模式 Sticky 正常，说明 WebKit sticky 本身不是本次主因；4.0.1 的字母 Sticky 实际被错误放在字母栏占位位置并被更高 z-index 的字母栏遮挡；
- `topChromeBottom()` 改为“基础顶部 Chrome + 字母栏实测高度”的确定性栈，不再依赖字母栏尚未吸顶时的瞬态 rect；Sticky Heading、active 字母、跳转/阅读边界使用同一真值；
- 字母栏下方镂空与 Sticky 不显被统一归因并修复，逻辑覆盖全局/域/普通 Collection 与 word/phrase/content；
- 日期模式刷新学习日期取消 `study-date` 目标跳转，临时关闭 overflow-anchor 并在重渲染后无动画恢复原 scrollY；
- Query chooser 再左移；Oxford 图标改为闭合书本，四 Provider 统一深色描边；
- Modal 打开时同步 theme-color 与页面底色到第一层蒙版合成色，作为系统壳融合 best-effort；iOS 26.5.2 若仍保留 DOM 不可达顶部状态条，明确记为 WebKit 平台边界。

Schema6 / DB5 / Seed4 / VIX2、关系/搜索/优先级占有/四态导航/Provider 语义均不变。

## 4.1.0：[历史稳定基线]

4.1.0 汇总 4.0.2 后连续 iPhone 真机反馈与本轮视觉/PWA shell 决策，不改变内容世代：

- Top Chrome 根修：删除 `visualViewport.offsetTop + 72` 混合坐标硬下限，基础边界只由连续可见 DOM rect 决定；字母栏实际吸顶前不展示 Sticky mirror，吸顶后统一使用 base + nav height；
- alphabet cell 边框所有权明确到每个字母按钮：top/right/bottom，首格 left；禁用只灰字形，不灰结构线；
- 字母 Sticky 补齐标题结构边界，日期/字母共用同一 Top Chrome 几何；
- 日期 StudyStamp 刷新继续保留当前 viewport，无 `study-date` 目标跳转；
- Query chooser 采用明确 viewport edge inset；Oxford 严格按用户提供的合上书本参考图重绘 SVG，不直接使用图片，也不擅自改变 Collins/Groq/ChatGPT；
- 一级 row secondary line 再收紧，繁体与独立域来源保持同 Y，44px action hit target 不缩；
- Home 全局区改为左侧“上→ / 下←”平行反向切换图标、右侧“管理”；Home 大字仍为“词汇索引”，topbar 和 Home Screen PWA 名称统一 `Vocabulary Index`；
- 全局 content virtual projection 的显示名从“全局非结构内容”改为“全局非结构总表”，稳定 ID 不变；
- System Shell Surface Controller 取代 boolean `#8f8f8e`：按 retained modal depth 用 48% 第一层 + 20% 后续层逐层 alpha compositing，同步 theme-color/root/fixed topbar；custom backdrop 从 topbar 实测底边以下开始，避免 topbar 二次蒙版；
- WebKit 调研确认 Safari 26 会参考 viewport-edge fixed/sticky opaque surface 做顶栏颜色延伸；同时 iOS 26.5.2 仍有 Home Screen standalone viewport 外 system strip 的公开复现，因此本版对可控信号做完整同步，最终系统 strip 仍以真机为准。

Schema6 / DB5 / Seed4 / VIX2、关系/搜索/优先级占有/四态导航/Provider session/Modal Stack/长按模型均不变。

## 4.2.0：[历史稳定基线]

4.2.0 是 4.1.0 真机暴露的 Sticky mirror/系统壳实验问题与后续导航/首页视觉讨论的统一收口，不改变 4.0 内容世代：

- Alphabet Sticky 放弃独立 mirror，真实 `.letter-heading` 恢复 native `position:sticky`；浏览器重新承担 containing-block 限制、collapsed 自然退出、section-bottom push-off/退场和真实 heading 点击锚点。
- 4.1.0 的 `alphabetSectionMetrics + ResizeObserver + 二分查找` 保留，但只负责字母栏 active/横向轨道，不再模拟视觉 Sticky；覆盖 global/domain/normal 与 word/phrase/content。
- 点吸顶字母 heading 收起时继续走与日期模式同一 `toggle*WithAnchor + overflow-anchor` 补偿，因此收起后的真实 heading 留在字母栏正下方，不再跳到其他字母。
- Query chooser 改用 relation multi-target 风格的右缘挂接并再左退 10px，viewport inset 12px；上方弹出与 Entry 框线 gap 13px，不再故意探出列表边框，也不让底层框线穿过浮层。
- Oxford 放弃旧参考图几何忠实，保留“合上的书”语义并按 Collins/Groq/ChatGPT 的 optical box 重新设计紧凑 outline。
- 4.1.0 System Shell Surface Controller 判定失败并撤销：不再动态染 theme-color/root/topbar；custom/native backdrop 恢复 full Web viewport，正文/Topbar/父 modal 的变暗完全由真实 48%/20% alpha compositing 产生。iOS viewport 外 system strip 维持静态平台边界。
- Home topbar `Vocabulary Index` 改为独立 serif Product Wordmark，不复用 hero eyebrow；Hero 大字“词汇索引”保持。
- `全局` heading 恢复和 Domain 一样的 15px/740；3.x 遗留淡完整矩形框退出，改成标题—hairline—动作的轻量 Index Rule。
- 首页 parallel switch 继续在“管理”左侧；PWA 安装名 `Vocabulary Index`、`全局非结构总表`、字母 cell border、Entry secondary gap、日期 StudyStamp 原位刷新全部保留。
- 新增 Root Home：递归深度 >=2 时在 Back 右侧出现 Home；一次 `history.go(-depth)` 回根，并以 `navigationEpoch` 失效全部旧 VIX pageSnapshot/forward history 语义。只清 Navigation History/临时展开状态，不清数据 Undo/Redo、PIN、StudyStamp、Annotation、设置或浏览锚点。
- Topbar 左/右各预留 96px 导航/动作宽度，中央标题继续物理居中；Back aria-label 明确为“返回上一页”。

Schema6 / DB5 / Seed4 / VIX2、关系/搜索/优先级占有/四态导航/Provider session/Modal Stack/长按模型均不变。

## 4.3.0：[历史运行时基线]

4.3.0 来自 4.2.0 首轮真机反馈及随后对源码、历史设计意图、WebKit/WHATWG/W3C 与社区工程案例的再次审计；数据世代不变：

- 4.2.0 Date/Alphabet 收起仍采用 `remove → rAF → measure → scroll` 的跨帧补偿，真机两种模式都出现闪现。4.3.0 保留 native Sticky，删除旧补偿器，统一为 pre-read geometry + collapse/final-scroll 单提交 transaction；Alphabet 的 LetterNav 差异继续由 `--content-sticky-top` 实测体系表达。
- `viewModes` 从 `collection:viewKind` 提升为 Collection-level，word/phrase 共享 alphabet/date；scroll/expanded/calendar/browse anchor/recursive snapshot 继续具体 view 独立。按用户决策不迁移旧 section mode。
- 4.2.0 epoch-only Root Home 无法让 Safari forward slot 消失，真机可右边缘拖出旧页面。4.3.0 把 Safari history 降级为 gesture rail，VIX 维护 destructive navigationStack：Back commit POP 并销毁离开 frame，任何 Home 清空 recursive stack，Forward/stale destination 被 edge guard + Navigation API + dead-token state guard 拒绝。
- Home hard invariant 扩展到所有 root route：即使通过同文档 hash/外部路由直接落到 root，`renderApp()` 也先 destructive clear，再渲染首页，避免 URL 与递归栈生命不同步。
- `history.scrollRestoration='manual'`，VIX 成为 recursive snapshot scroll 的唯一恢复者。
- `navigation-underlay` 从启动即常驻，是纯视觉底层而非 History blank/sentinel 页面；不在非法手势发生后临时 render。
- Presentation Layer 收敛为 Popover/Modal/Dock。Query/Relation 共用轻浮层生命周期；Search/Confirm 从 native `<dialog>` 迁入 retained custom Modal Stack；PIN/Review 保持 context dock。
- 保住 4.0.1 retained parent DOM、48%/20% nested backdrop、VisualViewport card geometry，以及 4.2 full-Web backdrop/system-strip 边界；删除 body fixed/top modal scroll-lock 和 double-rAF hard reveal。
- PIN mutation 不再 whole-entry `replaceWith(renderEntryRow)`；Pin/Review Dock DOM 常驻，用 opacity/visibility/transform reveal/exit。
- 被明确拒绝的方案包括：Sticky 多加 rAF/默认遮罩、viewMode 猜旧状态迁移、每层 History blank sentinel、继续 body-fixed modal、为了 Modal 改全 App scroll container。
- 自动测试升级为 4.3 行为契约，但 edge system preview、Sticky 首次 compositor 帧、modal PWA background lock 仍明确要求 iPhone 17 / iOS 26.5.2 standalone reduced tests。

Schema6 / DB5 / Seed4 / VIX2、数据投影、Search/Relation、Provider、Home 视觉、58px toolbar、longpress 等继续不变。

## 4.4.0：[当前实现]

4.4.0 来自 4.3.0 真机后反馈以及对源码、WebKit/WHATWG/W3C、社区工程案例和布局研究的最后一次交叉审计；数据世代不变：

- Sticky 不再把 section border-box 顶部当 heading natural Y。Alphabet/Date 每个 section 新增零高度 `.section-flow-anchor`，目标滚动由真实 flow rect 与 sticky visual rect 计算，并对 post-collapse document max scroll 做 clamp；4.3 每次约 1px 的累计漂移从模型上消失。
- WebKit 已有官方同型缺陷记录：iOS 在 DOM layout change 与同步 `window.scrollTo()` 组合下可能提交旧 exposedContentRect，造成 composited backing store 一帧缺失。4.4 因此退出 4.3 的 collapse+scroll 同提交；支持时用无动画 View Transition rendering suppression，完整旧布局先 scroll settle，再 collapse。
- “第一次更严重”不再作为根因；真机验收按 0/100/500/1500/3000px displacement 分档，并要求第二次重新滚深后重复大 delta。
- Navigation 升为 `destructive-v2`：browser entry identity 为 generation+navToken，depth 只诊断；root/page state 构造分离，snapshot persistence 不再 `replaceState()` 改 token；frame/snapshot 继续由 VIX stack/session cache 拥有。
- 合法 Back 在 Navigation API 可用时由 destination pre-classify + `intercept()` 同步 hydrate runtime view state 并一次 render；mode/calendar 持久化延后，`historyRestoreInProgress` 恢复真实 transaction guard；UA `after-transition` 恢复物理 scroll，VIX scroll snapshot只做 fallback。
- Home 删除 `history.go(-appNavigationDepth)`，改新 generation root PUSH；Forward/stale pre-commit 拒绝，右缘 guard 优先检查 `navigation.entries()` 实际右邻；已提交异常不再 bounce 旧页。
- 4.3 permanent `navigation-underlay` 从 DOM 删除，`#app/.boot-screen` whole-app stacking context 撤销，html/body canvas 成为永久底色。
- Modal 生命周期不再给 html/body 增删 `modal-open`，VisualViewport 更新拆成 modal geometry/page Sticky geometry；root App inert 和 nested retained modal inert 暂保留，若真机仍复现 Sticky paint 缺失才进入 inert A/B fallback。
- 新增 `v3-runtime-geometry.js`、`v3-navigation-runtime.js` 与 `runtime-behavior-tests.mjs`，让关键几何和导航分类具备可执行纯行为测试。
- PIN/Review、Popover、Collection-level mode、Home/Entry 视觉、Provider、Search/Relation、58px toolbar、longpress、StudyStamp 全部保持，不借运行时修复扩大产品。

自动化全 PASS 仍不冒充 iPhone system gesture/compositor 验收；最终真机项记录于 `tests/IPHONE_REDUCED_TESTS_4.4.0.md`。

# 三、4.0.x 当前数据模型

- `Domain`：name/order/glossEnabled/contentMode/relationExcluded。
- `Collection`：普通内容来源；系统总表由运行时虚拟化。
- `Entry`：具体 word/phrase/content；同域 normalizedText 唯一；POS/contentType 是属性。
- `Membership`：Entry→普通 Collection 来源事实。
- `RelationComponent`：phrase/content 可解析的精确结构 span。
- `Pin / Annotation / StudyStamp`：具体 Entry 状态。
- `Settings`：显示、关系过滤、浏览状态等。
- `History`：Undo/Redo。

Membership 与可见归属严格分离：所有 kind 都可以多 Membership，但只投影到最高优先可见普通 Collection。

# 四、现行产品不变量

1. 系统总表只是投影；不能成为状态 owner 或写入容器。
2. 跨域同形 Entry 永远独立。
3. Search fuzzy；Relation exact，两者不得共享召回结果。
4. Raw relations 必须双向完整；任何显示开关只改 Effective Graph。
5. canonical relation destination 以具体 Entry 为单位；一个 Entry 多 Membership 不重复菜单目标。
6. relation four-state 基于全部当前有效目标，不再先过滤同域层。
7. fresh navigation 不读取旧页面缓存；recursive return 恢复完整离开状态。
8. normal UI text 默认不可原生选择；复制和查询走产品显式交互。
9. 底部 58px 是视觉规格，不是全局几何常量。
10. 应用级 modal 必须保留真实父层并通过 retained stack 叠加子层；不得回退到 snapshot/replace 伪栈。
11. 任何历史实现方案只有在新基线中被列为 Product Invariant 时才继续约束；固定 selector/timeout/RAF/事件类型属于 Implementation Note。

# 五、4.0.x 内容世代

当前 Seed：3 Domain / 17 Collection / 6176 Entry / 7574 Membership / 1240 RelationComponent。

- 通用英语 structured：当前 A1/A2/B1/B2/C1/AWL 本地可信基线；5,005 Entry 暂无清洁可物化中文释义源，因此本世代不伪造 `glossHant/glossSource`。
- 计算机术语 structured：1121 Entry。
- 通用英语搭配 nonStructured：50 starter content。

[数据 backlog] NAWL/CET/TEM/COCA 方向仍确认，但当前工作包无质量足够的可物化本地原始源；历史人工覆盖/派生候选不直接冒充正式列表。未来获取清洁源后按同一 Seed4 构建链补入。

# 六、查询与外部边界

Oxford → Collins → Groq → ChatGPT。Collins/Groq 共享单一可取消 session；查询关闭后 stale response 不更新 UI。ChatGPT context v2 只带必要具体 Entry/有限有效关系，不带个人状态或全库对象。

# 七、工程与交付规则

- 修改前保留冻结基线和工作快照。
- 不直接修改用户 GitHub 仓库；当前工作仅本地交付完整源码 ZIP。
- 外部产品测试自动机仍是独立项目；本次只更新源码包内随版本维护的 tests/fixtures/contracts。
- 每个正式包必须生成 `FILE_MANIFEST.txt`、`SHA256SUMS.txt` 和 ZIP SHA-256。
- 最终 ZIP 必须全新解压后重新跑全测试和 hash。
- 自动测试不得表述为真实 iPhone 验收。
- 任何功能更新必须复核 Data identity → Projection → Search → Relation → Query → State → Navigation → Import/Export → Seed → UI/PWA → Tests 的全相联影响。

# 八、4.4.0 当前待真机事项

- Sticky displacement：Alphabet/Date 以 0–1 / 100 / 500 / 1500 / 3000px 分档；第二次必须重新滚深再收起，验证“大位移而非首次”模型；100 次开合无累计漂移；section tail/document bottom/fling 后不闪。
- Sticky transaction：目标机验证无动画 View Transition rendering suppression 在 iOS 26.5.2 standalone 不引入新的 snapshot/momentum 问题；若失败，只允许 operation-local fallback，不恢复 mirror/预热/永久遮罩。
- destructive-v2 Back：Home→A→B→C 的 button/swipe/slow/fast/half-cancel 均只恢复一次 B；mode/calendar/expanded/relations/scroll 首个可见状态正确。
- Forward/edge：POP 后 C 绝不复活；右缘 guard 在真实 forbidden neighbor 时生效，无 forbidden neighbor 时不产生永久死区；记录系统 preview 是否早于 JS 接管。
- Legal Back visual surface：删除 4.3 underlay/whole-app stacking context 后，慢速 interactive Back 不应再人为揭露纯色 substrate；若仍在 JS 前露 blank，记录为 Safari UA visual-history boundary。
- Home：深层 Home 立即生成新 root generation，不清业务数据；新 root 左缘不回旧 generation VIX page。
- Modal：已吸顶 Alphabet/Date heading 上打开 Settings/Search/Confirm/nested，背景 scrollY/Sticky top/Entry DOM identity 不变；keyboard 只改变 modal card。若仍只有 `#app.inert` 组合失败，再执行 inert A/B。
- PIN/Review、Popover、Collection-level mode、Home/Entry visual、StudyStamp、58px toolbar、longpress、Shortcuts/Collins CORS、Service Worker/离线/进程回收继续全量回归。

# 九、现行规范文件

`REQUIREMENT_BASELINE_4.4.0.md`、`SEMANTIC_IMPACT_MATRIX_4.4.0.md`、`LOCAL_ARCHITECTURE.md`、`DATA_FORMATS.md`、`UX_SPEC_4.4.0.md`、`PRODUCT_MANUAL_4.4.0.md`、`AUDIT_REPORT_4.4.0.md`、`TECHNICAL_RESEARCH_4.4.0.md`、`CHANGE_REPORT_4.4.0.md`、`TEST_REPORT_4.4.0.md`、`MIGRATION_4.4.0.md` 与 `tests/IPHONE_REDUCED_TESTS_4.4.0.md` 共同组成当前稳定规格与验证记录。旧版本文档保留为历史事实，不得以其过期实现细节钳制当前优化。
