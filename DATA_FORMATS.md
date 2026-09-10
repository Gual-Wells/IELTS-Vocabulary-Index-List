# VIX 5.1.0 数据与协议格式

VIX 应用版本、Seed 世代和跨组件协议具有独立生命周期。兼容性只按协议标识与 capability 协商，不因 VIX 发版或 Seed 换代自动失效。

## 三层数据

| 层 | 格式与位置 | 作用 | 是否权威 |
| --- | --- | --- | --- |
| Seed | 仓库 `data/seed.json`，完整 Schema 6 快照 | 新安装初始化；每一世代独立完整发布 | 该世代初始化权威 |
| VIX 即时层 | 浏览器 IndexedDB 5 / Schema 6 | 离线、即时编辑和高性能关系投影 | 仅当前设备即时状态，不是跨设备真源 |
| Personal Mirror | D1 最新快照 + R2 MirrorFS | 保存个人最新数据库和可见 Mirror 文件 | 个人最新远端真源 |

数据只按 `VIX -> Mirror -> Seed -> VIX` 流动。VIX 从 Mirror 读取的是用户选择的 MirrorFS 文件；隐藏数据库快照不作为 VIX 页面中的文件展示。

## VIX 数据交换

- 协议：`vix-data-exchange/1`
- 文件标记：`format: "vix-json"`
- 负载格式版本：`version: 2`
- capability：`snapshot.replace`、`increment.merge`、`domain-local-dedup`、`collection-priority-membership`

统一入口只接受 `.json`。内容包声明：

- `target.scope`：`global`、`domain` 或 `collection`；
- `mode`：`merge` 为增量合并，`replace` 为所选范围完整替换；
- `data.domains`、`data.collections`、`data.entries`、`data.memberships`：完整语义对象；
- Entry 只保存一份繁体 `gloss`，词性保存在 Entry 的 `partsOfSpeech`；
- membership 只保存归属与 `order`，不保存来源标签或来源顺序。

导入时仅在同一 domain 内按规范化英文去重；不同 domain 的同形词保持独立。普通词表间的显示由词表优先级占有规则投影，全局表始终是 Entry 集合视图。

旧的 CSV、TXT、Markdown、任意 Entry 数组和 Schema Backup 不再是 5.1.0 导入协议。旧内容世代替换前生成的归档只能交给对应旧版本读取。

## Personal Mirror 最新快照

VIX 手动同步或 Mirror Layer 2 提交后，生成 `vix-data-exchange/1` 的 `kind: "snapshot"` 信封并完整替换 Site 中的当前快照。该操作不生成历史、增量日志或墓碑；同步期间使用互斥锁。

快照可带 `seedGeneration` 作为诊断元数据，但它不是协议兼容条件。下一代 Seed 可以读取该完整快照作为生成依据，再由仓库发布新的独立 Seed。

## MirrorFS 文件

- 协议：`vix-mirror-file/1`
- 第一层 `layers.existing`：材料中识别到、已存在于 VIX 的 Entry 匹配；
- 第二层 `layers.candidates`：材料中识别到、需要用户选择提交的新词、短语或用法；
- `context`：材料标题、上下文和必要证据；
- 文件正文存入 R2，目录与节点元数据存入 D1。

用户在 VIX 选择提交第二层候选后，VIX 以同一事务逻辑增量写入本地词库，并自动同步更新后的完整数据库快照和对应 Mirror 文件状态。

## Mirror 服务

Site API 使用 `vix-mirror-service/1`，能力包括快照读写、MirrorFS 列表/读取/写入/移动/删除、picker 消息以及 Groq 模型、查询和语音代理。服务协议不携带 VIX 应用版本或 Seed 世代作为兼容前提。
