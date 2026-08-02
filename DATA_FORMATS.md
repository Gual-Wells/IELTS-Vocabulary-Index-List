# Vocabulary Index 3.4.0 数据格式

## 1. 完整备份

完整备份使用 Schema 5：

```json
{
  "schemaVersion": 5,
  "appVersion": "3.4.0",
  "domains": [],
  "collections": [],
  "entries": [],
  "memberships": [],
  "phraseTokens": [],
  "pins": [],
  "annotations": [],
  "studyStamps": [],
  "settings": {}
}
```

### Domain

```json
{
  "id": "domain_computer_terms",
  "name": "计算机术语",
  "order": 1,
  "glossEnabled": true
}
```

`order` 决定首页独立域顺序，以及全局总表中跨域同形 Entry 的组内顺序。

### Collection

持久化 Collection 只有：

- `normal`：普通表，可同时接受 word 和 phrase Membership；
- `system-phrases`：独立域短语总表对应的域内短语容器。

以下系统总表均为运行时投影视图，不写入 `collections`：

- 全局词汇总表；
- 全局短语总表；
- 独立域词汇总表。

独立域短语总表虽然有 `system-phrases` 容器，但页面仍是域内具体 phrase Entry 的投影视图，不拥有独立个人状态。

### Entry

```json
{
  "id": "entry_...",
  "domainId": "domain_computer_terms",
  "kind": "word",
  "text": "thread",
  "normalizedText": "thread",
  "glossHant": "線程",
  "glossSource": "CORE"
}
```

规则：

- `kind` 为 `word` 或 `phrase`；
- Entry 始终属于一个独立域；
- 同一独立域内不允许重复的 `normalizedText`；
- 不同独立域可以存在相同 `normalizedText`，此时它们是不同具体 Entry；
- 全局总表必须分别显示这些具体 Entry，不能只选一个代表 Entry。

### Membership

```json
{
  "entryId": "entry_...",
  "collectionId": "collection_computer_ai",
  "sourceLabel": "NIST-AI",
  "sourceOrder": 12
}
```

Membership 只指向 `normal` Collection。普通表可以同时拥有词汇和短语 Membership。

- 域内词汇总表从该域全部 word Entry 派生；
- 域内短语总表从该域全部 phrase Entry 派生；
- 全局总表从全部独立域的具体 Entry 派生；
- 同一具体 Entry 因多个 Membership 被总表汇总时只展示一次。

### PIN

PIN 以 `entryId` 唯一绑定具体 Entry。`contextCollectionId` 仅记录创建时的可见上下文和稳定顺序元数据，不代表 PIN 由该词表拥有。

因此：

- 同一 Entry 在普通表、域内总表和全局总表中显示相同 PIN 状态；
- 在任一可见投影中取消 PIN，都会取消该 Entry 的唯一 PIN；
- 调整独立域顺序不会迁移、复制或删除 PIN。

### Annotation

AI 标注以 `entryId` 唯一绑定具体 Entry。跨域同形 Entry 分别拥有标注，不存在额外的全局词形组标注。

### StudyStamp

```json
{
  "key": "entry:entry_...",
  "scope": "entry",
  "entryId": "entry_...",
  "reviewDateKey": "2026-08-03",
  "reviewedAt": "2026-08-03T00:43:00.000Z",
  "revision": 1
}
```

Schema 5 中学习日期只允许具体 Entry 作用域：

- `key` 必须为 `entry:<entryId>`；
- 跨域同形 Entry 分别记录日期；
- 同一 Entry 在所有投影视图中显示同一日期；
- 日期按点击时设备本地年月日保存，避免跨时区后显示日期漂移。

Schema 4 的 `scope: "global"` 日期在升级时迁移到旧全局代表规则对应的具体 Entry；不会复制给所有跨域同形 Entry。

若同一具体 Entry 在迁移或规范化时出现多条日期：

1. 保留 `reviewDateKey` 较晚的一条；
2. 日期相同则保留 `reviewedAt` 较晚的一条；
3. 再相同则保留 revision 较高的一条。

### Settings

3.4.0 主要字段：

```json
{
  "numberMode": "global",
  "lastPositions": {
    "lastPosition:global:__global_all_words:alphabet:main": "entry-id",
    "lastPosition:domain-id:collection-id:date:phrase": "entry-id"
  },
  "viewModes": {
    "collection-id": "date"
  },
  "calendarMonths": {
    "collection-id:word": "2026-08",
    "collection-id:phrase": "2026-08"
  },
  "studyStampMigrationIssues": [],
  "builtInSeedRevision": 3
}
```

`studyStampMigrationIssues` 仅用于记录 Schema 4 旧全局日期存在多个跨域候选时的保守迁移结果，包括原键、候选 Entry 和最终选择；它不参与日常学习日期计算。

`numberMode`：

- `none`：无序号；
- `group`：小标题内编号；
- `global`：继承字典序词形组的连续编号。

## 2. 系统总表投影与计数

### 域内总表

- 域内词汇总表：当前域全部具体 word Entry；
- 域内短语总表：当前域全部具体 phrase Entry；
- 同一 Entry 的多个普通表 Membership 不会造成重复行；
- 数量按具体 Entry 计数。

### 全局总表

- 全局词汇总表：所有域的具体 word Entry；
- 全局短语总表：所有域的具体 phrase Entry；
- 跨域相同 `normalizedText` 分别显示具体 Entry；
- 组内顺序按 Domain `order`；
- 页面标题和首页卡片按唯一 `kind + normalizedText` 词形组计数；
- 实际渲染行数可以大于显示总数。

### 序号

- 连续编号：跨域同形 Entry 始终共享字典序词形组编号；
- 字母模式＋小标题内编号：同一字母组中的同形 Entry 共享编号；
- 日期模式＋小标题内编号：每个具体日期和“未标注”分别编号；同形 Entry 位于不同日期组时可以编号不同，位于同一日期组时共享编号。

## 3. VIX 内容 JSON

VIX JSON 继续使用 Version 1：

```json
{
  "format": "vix-json",
  "version": 1,
  "target": {
    "scope": "collection",
    "domainKey": "domain_computer_terms",
    "collectionKey": "collection_computer_ai"
  },
  "mode": "merge",
  "data": {
    "domains": [],
    "collections": [],
    "entries": [],
    "memberships": []
  },
  "sources": []
}
```

范围：`global`、`domain`、`collection`。方式：`merge`、`replace`。

官方 Entry 引用应使用带词域的稳定键，例如：

```text
entry:domain_computer_terms:access
```

如果外部 VIX 使用裸键或裸文本，而该文本对应多个跨域具体 Entry：

- 该 Membership 被视为脏归属；
- 系统不猜测目标；
- 该归属被跳过；
- 预检列出原始引用、目标 Collection 和候选 Entry；
- 其他合法内容继续导入。

VIX 内容 JSON 明确不包含：

- StudyStamp；
- PIN；
- Annotation；
- 浏览位置；
- 视图模式；
- UI 设置；
- Groq API Key。

## 4. Seed

`settings.builtInSeedRevision` 当前值为 3。Seed 恢复会重置内容和个人状态。执行前先显示“下载备份／不下载”选择；两项均继续进入实际操作确认。

## 5. VIX JSON Schema

机器可读定义：

```text
data/vix-json.schema.json
```

## 6. ChatGPT 条目上下文 JSON

一级表项的 ChatGPT 控件生成 `vix-entry-context` v1。它是一次性具体 Entry 查询快照，不是可导入内容包或完整备份。

```json
{
  "format": "vix-entry-context",
  "version": 1,
  "application": {
    "name": "Vocabulary Index",
    "version": "3.4.0"
  },
  "subject": {
    "scope": "domain-entry",
    "entryId": "entry_...",
    "domainId": "domain_computer_terms",
    "kind": "word",
    "text": "thread",
    "normalizedText": "thread",
    "projectedFromGlobal": true,
    "instanceEntryIds": ["entry_..."]
  }
}
```

规则：

- 即使从全局总表发起，也只导出用户点击的具体 Entry；
- 不再自动合并或导出其他独立域的同形 Entry；
- 直接关系只展开一层；
- 包含当前 Entry 的 Membership、PhraseToken、PIN、标注、学习日期和相关来源；
- 不包含 Groq API Key、无关 Entry、全局设置、撤销历史或无关浏览位置；
- 该 JSON 只用于发送给名为 `AI查询` 的 iOS 快捷指令。
