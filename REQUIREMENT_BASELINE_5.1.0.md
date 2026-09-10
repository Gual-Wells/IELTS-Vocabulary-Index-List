# VIX 5.1.0 需求基线

## 数据权威

1. 数据按 `VIX -> Personal Mirror -> 新 Seed -> VIX` 单向流动。
2. GitHub Seed 是每个世代完整、独立的初始化快照；不要求跨世代增量迁移。
3. IndexedDB 是本机即时交互层，不是跨设备真源。
4. Personal Mirror 只保存一份最新完整 VIX 快照以及独立的 Mirror 文件系统，不保存历史、墓碑或撤销链。
5. 新 Seed 世代由产品所有者明确发布，不为其他用户自动协调。

## Personal Mirror

1. 使用 ChatGPT Site 的 D1 与 R2；不依赖 Cloudflare Bridge 或 WebMCP。
2. `/` 为文件管理器，`/picker` 为嵌入 VIX 的选择页，`/pair` 为配对页。
3. 文件管理器只展示与操作 Mirror 文件；隐藏数据库不出现在文件 UI。
4. VIX 提供“同步到 Mirror”手动入口。
5. 用户选择提交 Layer 2 候选后，通过统一 VIX 增量事务写入本机，并自动同步一次最新完整快照与文件状态。
6. 同步使用互斥锁；不设计多设备同时编辑合并。
7. 文件删除即永久删除，不维护墓碑。
8. ChatGPT 会话具有完整读取能力但没有任意写能力；写入必须经过配对端点与协议验证。

## 版本无关协议

1. Site、VIX Function 和接口协议不携带 VIX 应用版本或 Seed 世代作为兼容条件。
2. 使用 `vix-data-exchange/1`、`vix-mirror-service/1`、`vix-mirror-file/1`、`vix-function/1` 与 capability 协商。
3. 世代更新若未改变协议语义，不触发 Site 或 Function 版本更新。

## VIX 数据模型

1. Entry 只保存一个繁体中文 `gloss`；词性保存于 Entry 的 `partsOfSpeech`。
2. 运行时不保存 `glossHans`、`glossHant`、`glossSource`、`contentSources`、membership 来源标签或来源网址。
3. PIN 保存 `entryId` 与 `contextCollectionId`；全局表作为 Entry 集合可以展示这些 PIN。
4. 学习日期、显示偏好、关系偏好、词表顺序和精确关系结构保留。
5. 撤销/重做、AI 核验和备注/annotations 完全退出产品入口。

## 导入、去重与提交

1. 页面只提供一个 VIX JSON 数据交换入口。
2. 协议同时表达 full 与 increment；increment 可以增量合并。
3. 去重只在同一 domain 内进行，不跨独立 domain 去重。
4. 普通词表间按优先级占有投影；membership 本身仍记录真实所属。
5. Mirror Layer 2 选择提交与普通 VIX increment 共用同一事务路径。

## 语义提取

1. `VIX:`/`VIX：` Function 对资料按语义边界分块并保存短证据。
2. 同等提取词汇、多词短语和上下文用法；完整短语/用法先于组成词匹配。
3. Layer 1 保存已存在匹配与必要的修正释义；Layer 2 保存缺失候选及明确目标。
4. Layer 2 的繁体释义必须具体、可区分、与证据一致；拒绝循环定义、空洞“表示某种情况”、乱码与问号占位。
5. 生成且回读验证唯一的 `vix-mirror-file/1` 后，由 Function 提交 Site。

## 查询、语音与 UI

1. Oxford 查询保留；Groq 是核心查询能力。
2. Groq 查询模型、语音模型与 voice 独立配置。
3. 不使用 Google TTS；仅 iOS 在 Groq 不可用时使用系统 TTS 兜底。
4. 当前词表提供“全部展开”，但继续使用虚拟化与驻留窗口，避免大词表性能退化。
5. 多层页使用逐层 inset 与周边悬浮阴影；不使用蒙版变暗，避免等宽边线重合。
