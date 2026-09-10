# Vocabulary Index 4.0.0 统一需求基线

日期：2026-08-08

本文件取代原先将 3.6.0 与 4.0.0 分列的预更新方案。优先级：本文件与 2026-08-08 明确用户决策 > 当前 4.0.0 稳定代码 > 旧版本生命周期文档 > `PREUPDATE_ROADMAP_2026-08-04.md` 历史候选。

## Product Invariants

- iPhone 17 标准版 standalone PWA、local-first、无账号/云同步/后端。
- 系统总表是投影，不拥有 Entry 状态。
- PIN/Annotation/StudyStamp 属于具体 Entry；跨域同形不合并状态。
- Domain 内 Entry 唯一键为 `domainId + normalizedText`；POS/contentType 不分裂 Entry。
- word/phrase/content 多 Membership 均保留来源事实，但普通表只由优先级最高者占有。
- fresh navigation 与 recursive return 严格区分。
- 搜索可模糊；关系不模糊。
- Raw Relation Graph 全局、精确、完整、双向；逻辑开关只过滤 Effective Graph。
- 关系多目标必须展示完整有效目标集合，不再同域优先过滤。
- 旧 Full Backup/VIX 不兼容 4.0.0。

## Data / Domain

- `structured`：word/phrase 总表 + 普通表 word/phrase 视图。
- `nonStructured`：内容总表 + 普通 content 表；word/phrase 切换槽保留但禁用。
- 内置 nonStructured Domain：`通用英语搭配`。
- Entry：`word|phrase|content`；contentType 开放字符串。
- 词汇性短语继续作为 phrase 分散进入普通结构化词表；真正句型/语法/模板/语篇内容进入 nonStructured Domain。

## Relations

- phrase/content 解析精确连续 span；只和现有具体 Entry 的 normalizedText 相等时成边。
- `relationExcluded` Domain 仍构建、维护完整关系，只在 Effective Graph 逻辑删除。
- Settings `关闭低级词汇关联` 默认开启，依据独立屏蔽词素/低信息词数据库过滤，关闭后立即恢复，无需 rebuild。
- 四态：当前结构域唯一 / 其他结构域唯一 / 非结构域唯一 / 任意多个目标。0 目标不显示跳转。

## Search

所有入口共享稳定 Scope ID；入口只改变默认值。首页默认 `all`；普通 Collection 默认整个有效可见 Collection（word+phrase 或 content）；域词汇总表默认 domain words；搜索结果保留跨域具体 Entry，不合并。Search fuzzy 算法不得反馈到关系。

## Providers

顺序 Oxford → Collins → Groq → ChatGPT。Collins/Groq 同时只允许一个前台 Provider session；新查询 abort 旧查询，关闭后迟到结果无效。ChatGPT context v2 严格最小化。

## UI / Runtime

- 底部工具栏 58px 视觉规格保留；逻辑用真实几何。
- native backdrop 全屏，dialog 卡片内容尺寸；保留现有圆角；无出现位置动画。
- sticky/top/jump/menu 统一使用真实顶部几何。
- source-domain secondary line 使用与繁体释义相同的纵向指标。
- 正常 UI 文本全局不可原生选中；编辑控件白名单恢复。
- longpress 520ms + 350ms invisible grace；成功/失败/取消都不得遗留 iOS 文本选择/callout/click 状态。
- Home Screen icon 使用启动页 `V`。

## Scope Boundary

4.0.0 不实现学习计划实体、Dashboard、课程系统、streak 或推荐系统。测试自动机项目与本产品更新独立，不修改其合同/代码。
