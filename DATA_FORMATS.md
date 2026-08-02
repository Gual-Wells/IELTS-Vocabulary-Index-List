# Vocabulary Index 3.1.1 数据格式

## 1. 完整备份

完整备份使用 Schema 4：

```json
{
  "schemaVersion": 4,
  "appVersion": "3.1.1",
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

### Collection

持久化 Collection 只有：

- `normal`：普通表，可同时接受 word 和 phrase Membership；
- `system-phrases`：独立域短语总表的内容容器。

全局词汇总表、全局短语总表和独立域词汇总表都是运行时虚拟投影，不写入 `collections`。

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

`kind` 为 `word` 或 `phrase`。Entry 始终属于一个独立域，不存在全局专属 Entry。

### Membership

```json
{
  "entryId": "entry_...",
  "collectionId": "collection_computer_ai",
  "sourceLabel": "NIST-AI",
  "sourceOrder": 12
}
```

Membership 只指向 `normal` Collection。普通表可以同时拥有词汇和短语 Membership。短语总表由域内全部 phrase Entry 派生，不需要 phrase Membership。

### StudyStamp

```json
{
  "key": "entry:entry_...",
  "scope": "entry",
  "entryId": "entry_...",
  "reviewDateKey": "2026-08-02",
  "reviewedAt": "2026-08-02T01:51:00.000Z",
  "revision": 1
}
```

全局聚合项使用 `scope: "global"`、`kind` 和 `normalizedText` 形成独立键。日期按点击时本地年月日保存，避免跨时区后显示日期漂移。

### Settings

3.1.1 相关字段：

```json
{
  "lastPositions": {
    "lastPosition:domain:collection:alphabet:word": "entry-id",
    "lastPosition:domain:collection:date:phrase": "entry-id"
  },
  "viewModes": {
    "collection-id": "date"
  },
  "calendarMonths": {
    "collection-id:word": "2026-08",
    "collection-id:phrase": "2026-08"
  },
  "builtInSeedRevision": 3
}
```

## 2. VIX 内容 JSON

VIX JSON 继续使用：

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

普通表内容包可同时包含：

```json
[
  { "key": "entry_thread", "text": "thread" },
  { "key": "entry_thread_pool", "text": "thread pool" }
]
```

VIX 内容包不要求提交 `kind`；导入器按英文文本是否包含多个独立词元判定词汇或短语。

VIX 内容 JSON明确不包含：

- StudyStamp；
- PIN；
- 标注；
- 浏览位置；
- 视图模式；
- UI 设置；
- API Key。

## 3. 总表约束

- 全局词汇总表：所有独立域 word Entry 按规范英文聚合；
- 全局短语总表：所有独立域 phrase Entry 按规范英文聚合；
- 独立域词汇总表：该域全部 word Entry；
- 独立域短语总表：该域全部 phrase Entry；
- 四类总表均不能成为普通 Membership 目标；
- 全局总表不能直接新增或删除内容。

## 4. Seed

`settings.builtInSeedRevision` 当前值为 3。Seed 恢复会重置内容和个人学习状态；执行前应生成完整备份。

## 5. Schema

VIX JSON Schema 位于：

```text
data/vix-json.schema.json
```

示例位于 `data/examples/`。

## 6. ChatGPT 条目上下文 JSON

一级表项的 ChatGPT 控件生成 `vix-entry-context` v1。它是一次性查询快照，不是可导入内容包或完整备份。

```json
{
  "format": "vix-entry-context",
  "version": 1,
  "generatedAt": "2026-08-02T03:00:00.000Z",
  "application": {
    "name": "Vocabulary Index",
    "version": "3.1.1"
  },
  "currentView": {
    "collectionId": "collection_computer_software_data",
    "domainId": "domain_computer_terms",
    "mode": "alphabet",
    "section": "word"
  },
  "subject": {
    "scope": "domain-entry",
    "kind": "word",
    "text": "thread",
    "normalizedText": "thread",
    "entryId": "entry_...",
    "domainId": "domain_computer_terms",
    "instanceEntryIds": ["entry_..."]
  },
  "domains": [],
  "collections": [],
  "entries": [],
  "memberships": [],
  "phraseTokens": [],
  "relations": [],
  "pins": [],
  "annotations": [],
  "studyStamps": [],
  "sources": []
}
```

规则：

- 非全局表项导出当前 Entry 的完整记录；
- 全局聚合项使用 `scope: "global-aggregate"`，导出全部独立域实例；
- 当前 Entry 的直接关联只展开一层，关联目标采用精简快照，避免递归导出整库；
- 包含当前条目的 Membership、PhraseToken、PIN、标注、学习日期和相关来源；
- 不包含 Groq API Key、无关 Entry、全局设置、撤销历史或无关浏览位置；
- 该 JSON 只用于发送给 `AI查询` 快捷指令，不由数据交换中心导入。
