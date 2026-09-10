# VIX 5.1.0 架构与历史负担审计

审计目标不是追求文件数量最少，而是让每一份状态、字段和入口只有一个明确职责，并且不牺牲现有功能、视觉或性能。

## 结论

5.1.0 把产品收敛为三层单向数据链：GitHub 仓库中的完整 Seed 世代负责初始化，VIX/IndexedDB 负责即时交互，Personal Mirror 负责保存最新完整数据库快照与 Mirror 文件。数据只按 `VIX -> Mirror -> Seed -> VIX` 流动。IndexedDB 不再被描述为跨设备真源，Mirror 也不承担版本历史系统。

Personal Mirror Site 是版本无关的存储与访问面。VIX Function、VIX 数据交换、Mirror 服务和 Mirror 文件均以独立协议及 capability 协商兼容性，不以 VIX 版本号或 Seed 世代号耦合。

## 逐项审计

| 对象 | 原作用 | 5.1.0 处理 | 理由或不可裁剪说明 |
| --- | --- | --- | --- |
| GitHub `data/seed.json` | 新安装初始化数据库 | 保留，下一世代必须是独立完整快照 | Seed 是受版本背书的初始化权威；不构造增量迁移链 |
| IndexedDB 主数据表 | 浏览器内即时读写 | 保留为即时层/缓存 | 对离线、首屏和大词表性能不可裁剪，但不是跨设备真源 |
| Mirror D1 最新快照 | 远端保存数据库 | 新增并保留，仅一份最新快照 | 防止用户数据只留本地，也避免直接修改仓库 Seed |
| Mirror R2 文件 | 保存 ChatGPT 提取材料 | 新增并保留 | 与隐藏数据库分离，供文件管理器和 VIX 选择提交 |
| Mirror 快照历史、撤销链、墓碑 | 回溯远端变更 | 不引入 | 单用户、单向同步与同步锁下属于不必要复杂度 |
| IndexedDB history / undo / redo | 撤销用户变更 | 退役；首次 5.1 启动清空，接口惰性返回失败 | 用户明确取消；保留对象仓库只是避免无意义 DB 版本升级 |
| annotations / AI 核验 | AI 标注再人工确认 | 退役并清空 | Oxford 查询与直接编辑已经覆盖需要；避免额外认知链路 |
| `contentSources`、`glossSource`、membership `sourceLabel/sourceOrder` | Seed 构建溯源或旧排序 | 运行模型移除；仅旧输入边界可读取 | VIX 不关心 Entry 来源；成员关系只保存所属与顺序 |
| `glossHans` + `glossHant` | 双份简繁释义 | 合并为单一繁体 `gloss` | 避免重复存储和冲突；下一 Seed 固化阶段做字形转换 |
| Entry `partsOfSpeech` | 词性 | 保留在 Entry | 是内容语义，不应挂在来源或 membership 上 |
| Pins | 收藏/上下文固定 | 保留 `entryId + contextCollectionId` | PIN 跟随 Entry；全局表是 Entry 集合，因此可以承载普通表中的 PIN |
| studyStamps / 学习日期 | Entry 学习轨迹 | 保留 | 是用户直接创建的必要状态，不等同于冗余审计轨迹 |
| viewModes、关系过滤偏好、编号模式 | 显示与关系体验 | 保留 | 用户明确设计且仍影响核心浏览体验 |
| relationComponents / 投影索引 | 精确关系与优先级投影 | 保留 | 大词表关系计算和无重复展示的性能基础，不可裁剪 |
| 词表内去重 | 增量导入去重 | 保留 | 同一 domain 内按规范化文本去重；不同 domain 不跨域去重 |
| 词表间优先级占有 | 多表 Entry 展示 | 保留 | membership 是事实，普通词表按优先级只投影一次；全局表仍是集合视图 |
| 多格式导入 UI | 兼容随意 CSV/TXT/旧 JSON | 收敛为一个 VIX JSON 入口 | 完整替换和增量合并都由版本化 VIX 协议表达 |
| Cloudflare Bridge | 远端文件、密钥与代理 | 删除 | Personal Mirror Site 已承接 D1、R2、配对、Groq 代理 |
| WebMCP | 设想中的 ChatGPT 访问桥 | 完全移除依赖 | Plus 环境不可用，不能成为任何关键路径前提 |
| Google TTS | 云端语音 | 删除 | Groq 单独语音模型/voice；iOS `speechSynthesis` 仅作兜底 |
| Groq | 查询与语音 | 保留为核心能力 | 查询模型与语音模型分别配置，密钥只在 Site 加密保存 |
| 旧 Seed 增量协调器 | 跨世代逐字段合并 | 下一世代不再使用 | 每一代 Seed 独立完整；由用户明确发布新世代 |
| Service Worker 分块预缓存 | PWA 离线与启动 | 保留 | 是可用性与性能必要设施；版本发布时只换 shell cache 标识 |
| 历史版本文档与事故复盘 | 保留旧决策证据 | 保留在源码、排除出 `dist` | 对回溯稳定产品故障有价值，但不进入运行时，不作为 5.1.0 设计依据 |

## 当前 Seed 质量债务

当前 revision 8 共 23,917 个 Entry。审计发现 9,143 个释义缺失，其中短语 6,092 个、单词 3,051 个；595 个 content Entry 虽均有值，但 545 个落入四类高度重复的泛化废话释义。原始 Seed 还包含 23,917 份双释义、23,917 个 `glossSource`、28 个 `contentSources` 与 61,905 个 membership 来源标签。

5.1.0 不静默重写当前 Seed。`tools/finalize-next-seed.mjs` 用于生成独立的下一世代候选，`tools/validate-next-seed.mjs` 是硬门禁：拒绝缺失、乱码、简体字形、泛化废话、异常重复、旧字段、域内重复和悬空引用。当前 Seed 故意不能通过这道下一世代门禁，这是一项已标注的内容债务，不是运行时失败。

## 安全边界

- Site 的 D1 保存隐藏最新快照和节点元数据，R2 保存 Mirror 文件正文；文件管理器不展示数据库快照。
- ChatGPT Site 会话可读；VIX 和本地 VIX Function 只使用配对产生的最小写入 token，写入前验证协议。
- Groq Key 由 Site 使用 `VIX_GROQ_MASTER_KEY` 进行 AES-GCM 加密；密钥不写入前端、仓库或普通日志。
- 数据结构可被未来 Seed 工具完整读取，但 Site 本身不替代仓库发布审批。新世代仍由用户手动决定。

在这些边界下，不需要再保留独立 Bridge 存储库。只有当 Sites 无法提供持久 D1/R2、私有访问或可导出读取时，才应重新评估 Bridge，而不是预先维护两套后端。
