# Vocabulary Index 4.2.0 需求基线

## 定位

4.2.0 是 4.1.0 真机验收后的 iPhone Home Screen PWA 导航/Sticky/首页视觉收敛版本。数据世代保持 Backup Schema 6、IndexedDB 5、Seed revision 4、VIX 2；Domain/Entry/Membership/Projection/Search/Relation/Provider 业务语义不变。

## 本轮多轮讨论冻结需求

1. **Alphabet Sticky 回归原生 CSS `position: sticky`。** 4.0.1–4.1.0 的独立 `sticky-letter-heading` mirror 退出运行时；真实 `.letter-heading` 自己成为视觉标题、点击目标、收起锚点和 Sticky owner。
2. 原生字母 Sticky 必须继承日期模式已经真机证明的完整天然语义：正常流进入、达到 top 后吸附、仅在所属 section 有足够高度时持续、collapsed section 不形成持续 Sticky、section 底部逼近时随 containing block 一起向上退场、下一个 section 自然接管。
3. 点击一个已经 Sticky 的展开字母标题收起时，收起后的真实标题必须保持在字母栏无缝正下方，不得跳到后续字母或被新 document max-scroll clamp 带走。继续复用日期模式的真实-heading anchor/overflow-anchor 补偿，不为 mirror 新造第二套锚点算法。
4. 字母栏 active 同步仍保留 4.1.0 的 section metrics + 二分查找 + ResizeObserver；JS 只负责“当前字母/横向轨道”，不再负责模拟 Sticky 布局。
5. 上述字母 Sticky 行为必须统一覆盖系统全局总表、域总表、普通 Collection，以及 word/phrase/content；word/phrase/content 不建立各自 Sticky 分支。
6. 4.1.0 已确认的字母栏 cell-owned border 保留：每格 top/right/bottom，首格 left；disabled/empty 只灰前景，不灰结构线。
7. Query chooser 不再追求越过列表右边框。其横向定位改为沿用四态关系多目标弹窗的“从右侧动作源向左展开”语言，并在此基础上再左移少量；保持 viewport 安全钳制。
8. Query chooser 与一级表项边框之间必须保留清晰的小型呼吸缝，不允许让列表框线视觉穿过浮层。默认上方弹出时垂直 gap 从 9px 提升到 13px。
9. Oxford 只保留“合上的书”语义，不再受旧参考图几何忠实约束。重新按 Collins/Groq/ChatGPT 的共同 optical box、1.75 stroke、round cap/join、留白和视觉重心设计；CSS icon box 仍与另外三枚一致。
10. 4.1.0 的 System Shell Surface Controller 判定为失败实验并退出：不再动态计算/写入 `theme-color`、root、fixed topbar 的 modal 灰色。
11. Modal 变暗重新交给**真实 backdrop**：custom retained modal 每层 backdrop `inset:0` 覆盖所有 DOM 可绘制区域；第一层 48%，子层继续 20%，当前最上层 modal card 自己保持正常 surface；native search/confirm dialog backdrop 同样覆盖完整 Web viewport。
12. iOS 系统状态区常态继续静态 `#fafafa` + `apple-mobile-web-app-status-bar-style=default`。若 iOS 26.5.2 system strip 位于 Web viewport 外，Modal 时允许其保持系统颜色；不得为这几十像素重新污染 Topbar/safe-area 或改用风险更高的 `black-translucent`。
13. Home 顶部 `Vocabulary Index` 需要独立 Product Wordmark 设计，不能继续只是普通 Collection 标题黑体，也不直接复用 `VOCABULARY INDEX` hero eyebrow。4.2.0 使用克制的系统 serif/New York 方向、Title Case 和紧字距；Home 大字“词汇索引”与绿色 eyebrow 保持不变。
14. Home `全局` scope 标题字号/字重必须与普通独立 Domain 标题同级；撤销旧 12px + `.10em` kicker 特例。
15. `全局` 区域撤销 3.x 遗留的淡完整矩形框。改为轻量 **Index Rule**：标题在左、动作在右，中间仅用一条细 hairline 建立 scope 结构；不恢复绿色底、粗上下横线、左 rail 或大卡片盒子。
16. 首页结构化/非结构切换继续使用 4.1.0 已通过的“上行向右 / 下行向左”两条平行反向半箭头；位置继续“切换在左、管理在右”。
17. 首页大字继续“词汇索引”；Home topbar 与 PWA 安装名继续 `Vocabulary Index`；“全局非结构总表”展示名继续保留。
18. 新增 **Root Home** 页面级按钮。它与 Back 分离：Back 仅返回上一递归页面；Home 无视全部递归层级，一次回到首页并清空/失效所有 Navigation History/pageSnapshot/展开页面状态。
19. Home 按钮只在递归深度 `>=2` 的 Collection 页显示；depth 1 仅显示 Back，避免两个按钮都指向首页。Topbar 左侧建立固定宽度 navigation cluster，右侧保留对称宽度，中央标题保持物理屏幕中心。
20. Root Home 执行 `history.go(-appNavigationDepth)` 回根，并通过 `navigationEpoch` 使旧 VIX history states（包括升级前无 epoch 的旧 entry）全部失效；下一次 pushState 自然截断 forward branch。
21. Root Home 清理的只是 Navigation History：`pendingPageSnapshot`、jump context、expanded group/relation 临时状态、home scroll history 等；**不得**清 PIN、Annotation、StudyStamp、Entry/Domain/Collection、API Key、设置、手动浏览锚点或数据 Undo/Redo History。
22. Back 的 aria-label 改为“返回上一页”；Home 为“返回首页并清空页面历史”。
23. 4.1.0 已通过/保留项继续回归：日期模式刷新 StudyStamp 保持当前视口；一级 Entry 繁体/来源 secondary line 同 Y 且紧凑；PWA 名称 `Vocabulary Index`；全局非结构总表文案；retained Modal Stack；58px bottom toolbar；520ms + 350ms longpress；非编辑文本不可选；关系四态和 Provider session。
24. VIX Automaton 为独立项目，本版不修改。GitHub 不执行任何写操作。

## 数据版本

- Backup Schema: 6
- IndexedDB: 5
- Seed revision: 4
- VIX: 2
- 4.1.0 → 4.2.0：无数据迁移。
