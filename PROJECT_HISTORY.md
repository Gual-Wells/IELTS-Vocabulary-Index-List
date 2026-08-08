# Vocabulary Index 项目全生命周期历史与交接文档

> 当前权威版本：Vocabulary Index 4.0.1（2026-08-08）。本文件记录产品使命、主要历史阶段、失败教训、现行规则、数据世代与交接边界。3.5.2 时点的旧全文快照保存在 `PROJECT_HISTORY_3.5.2_SNAPSHOT.md`；所有逐版本报告仍保留在源码包中。

## 状态标签

- **[当前实现]**：4.0.1 完整源码实际行为。
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

## 4.0.1：[当前实现]

4.0.1 不改变 4.0.0 内容世代，集中处理首轮 iPhone 真机反馈：

- 字母真实 heading 取消 sticky，改为单一 Sticky Heading Layer；section metrics + 二分定位替代滚动帧整页扫描；
- `app-dialog`/action 从 snapshot/replace 伪栈改为 retained modal stack，父层常驻并 inert，子层独立遮罩；
- Settings、管理词库与 action 卡片统一受限管理高度，body 自滚动，常驻开发说明文本从自用 UI 清除；
- modal 先显示 backdrop、card 两帧稳定后 reveal，解决 4.0.0 “不抖但闪现”；
- content 补齐 normal/two-line/extreme；一级 row secondary line 密度收紧；
- Query chooser 增加四 Provider 副字，仅重绘 Oxford/ChatGPT；checkbox 使用产品视觉；
- Modal Host 覆盖顶部 safe-area，状态栏保持 `default`，避免浅色常态页面引入错误前景对比。

Schema6 / DB5 / Seed4 / VIX2、优先级占有、搜索/关系、四态导航和 Provider 业务语义保持不变。

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
- 产品测试自动机是独立项目，本次不修改其源码/合同。
- 每个正式包必须生成 `FILE_MANIFEST.txt`、`SHA256SUMS.txt` 和 ZIP SHA-256。
- 最终 ZIP 必须全新解压后重新跑全测试和 hash。
- 自动测试不得表述为真实 iPhone 验收。
- 任何功能更新必须复核 Data identity → Projection → Search → Relation → Query → State → Navigation → Import/Export → Seed → UI/PWA → Tests 的全相联影响。

# 八、4.0.1 当前待真机事项

- retained modal stack 在 iPhone 17 standalone 父层不消失、四角完整、无首帧闪现；
- 新 Sticky Layer 顶部 A、快速 fling、橡皮筋、惰性块高度变化后即时正确；
- 长按成功/失败/取消后无系统 Selection/callout/click 泄漏；
- Home Indicator、系统返回手势；
- Oxford/ChatGPT Shortcuts 外跳返回；
- Collins API Key + standalone CORS；
- Service Worker 更新、V icon 缓存、离线与进程回收。

# 九、现行规范文件

`REQUIREMENT_BASELINE_4.0.1.md`、`SEMANTIC_IMPACT_MATRIX_4.0.1.md`、`LOCAL_ARCHITECTURE.md`、`DATA_FORMATS.md`、`UX_SPEC_4.0.1.md` 和 `PRODUCT_MANUAL_4.0.1.md` 共同组成当前稳定规格。旧版本文档保留为历史事实，不得以其过期实现细节钳制当前优化。
