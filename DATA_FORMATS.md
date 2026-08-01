# Vocabulary Index 3.0.6 数据格式

系统保留两种 JSON：

1. **Schema 3 完整备份**：精确迁移或恢复整个应用状态；
2. **VIX JSON 内容包**：在全局、独立域或词表范围内交换词库内容。

二者不能混用。模型或外部工具应生成 VIX JSON，不应生成完整备份。

## 1. 英文规范化

英文执行 Unicode NFKC、忽略大小写、合并空白、弯引号转直引号、Unicode 连字符/减号转 ASCII 连字符，并删除零宽、BOM 和双向控制字符。单条英文上限 160 个 JavaScript 字符单元。

## 2. Schema 3 完整备份

```json
{
  "schemaVersion": 3,
  "appVersion": "3.0.6",
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "domains": [],
  "collections": [],
  "entries": [],
  "memberships": [],
  "phraseTokens": [],
  "pins": [],
  "annotations": [],
  "settings": {}
}
```

完整备份由应用导出，包含 PIN、浏览位置、标注和应用设置。Groq API Key 与撤销历史不进入备份。恢复时应用重新生成 PhraseToken，并校验 ID、唯一性、关系、PIN 和浏览位置。

### Domain

```json
{
  "id": "domain_computer_terms",
  "name": "计算机术语",
  "order": 1,
  "glossEnabled": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Collection

`type` 只能为 `normal` 或 `system-phrases`。每个词域恰有一个系统短语表，ID 固定为 `<domainId>__phrases`。`hidden: true` 表示内部来源 Collection，不进入首页、管理器、搜索范围或普通跳转目标。

### Entry

```json
{
  "id": "entry_xxx",
  "domainId": "domain_xxx",
  "kind": "word",
  "text": "thread",
  "normalizedText": "thread",
  "glossHant": "線程",
  "glossSource": "manual",
  "createdAt": "...",
  "updatedAt": "..."
}
```

同一词域内 `normalizedText` 唯一。`kind` 由英文文本决定：单个词为 `word`，多词表达为 `phrase`。数据库只保存繁体释义 `glossHant`；简体释义可以作为生成阶段或导入审计信息，但不会成为第二套 UI 字段。

### Membership

```json
{
  "id": "membership_xxx",
  "entryId": "entry_xxx",
  "collectionId": "collection_xxx",
  "sourceLabel": "NIST",
  "sourceOrder": 12,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Membership 只能连接普通词与普通 Collection。短语不通过 Membership 进入普通词表。

### PhraseToken

PhraseToken 是应用内部派生索引，不应由 VIX JSON 提供。完整恢复时也会根据短语文本重新生成。

## 3. VIX JSON 内容包

统一格式：

```json
{
  "format": "vix-json",
  "version": 1,
  "exportedAt": "2026-08-01T00:00:00.000Z",
  "target": {
    "scope": "domain",
    "domainKey": "domain_computer_terms",
    "collectionKey": ""
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

正式 Schema：`data/vix-json.schema.json`。示例位于 `data/examples/`。

### 3.1 target.scope

- `global`：全部词域和内容结构；
- `domain`：一个独立词域；
- `collection`：一个普通词表或该域唯一短语表。

全局总表、全局短语表和词域总词表均为运行时派生视图，不写入 `collections`，也不能作为直接导入目标。

### 3.2 mode

- `merge`：只新增或更新明确出现的内容；未出现的现有内容保留，不执行隐式删除；
- `replace`：只完整替换面板选定的全局、独立域或词表范围。

面板选择与文件声明不一致时，必须由用户明确选择使用当前目标或文件目标。

### 3.3 data.domains

```json
{
  "key": "domain_computer_terms",
  "name": "计算机术语",
  "order": 1,
  "glossEnabled": true
}
```

`key` 是内容交换稳定键，不要求外部工具生成数据库 UUID。

### 3.4 data.collections

```json
{
  "key": "collection_computer_ai",
  "domainKey": "domain_computer_terms",
  "name": "人工智能",
  "label": "",
  "kind": "normal",
  "order": 5
}
```

`kind` 为 `normal` 或 `phrases`。每个词域只能有一个 `phrases` Collection；新短语会合并到该固定短语表。

### 3.5 data.entries

```json
{
  "key": "entry:domain_computer_terms:speculative-decoding",
  "domainKey": "domain_computer_terms",
  "text": "speculative decoding",
  "glossHant": "推測解碼",
  "glossSource": "nist-ai",
  "sourceRefs": ["nist-ai"]
}
```

应用根据英文自动判断词汇或短语，规范化、去重并重建关系索引。

### 3.6 data.memberships

```json
{
  "entryKey": "entry:domain_computer_terms:inference",
  "collectionKey": "collection_computer_ai",
  "sourceLabel": "nist-ai",
  "sourceOrder": 18
}
```

Membership 只接受普通词和普通词表。短语导入不需要 Membership。

### 3.7 sources

```json
{
  "key": "nist-ai",
  "title": "NIST AI Resource Center",
  "publisher": "NIST",
  "url": "https://airc.nist.gov/",
  "retrievedAt": "2026-08-01"
}
```

来源目录保存在内容元数据中，默认不进入日常列表 UI。

## 4. 数据交换中心支持的组合

| 操作 | 范围 | 方式 |
|---|---|---|
| 新建完整独立域 | 独立域 | 完整替换 |
| 增量更新独立域 | 独立域 | 增量合并 |
| 新建普通词表 | 词表 | 完整替换 |
| 增量更新普通词表 | 词表 | 增量合并 |
| 增量或替换短语表 | 词表 | 合并或替换 |
| 导出全局内容 | 全局 | 不适用 |
| 替换全局格局 | 全局 | 完整替换 |

词表级替换只改变目标普通词表的 Membership；仍被其他词表引用的 Entry 不得删除。

## 5. 导入安全边界

- 单文件上限 64 MB；
- JSON 解析和差异计算在模块 Web Worker 中执行；
- 预检完成前不修改 IndexedDB；
- 完整替换前自动下载当前完整恢复备份；
- 提交使用一次完整恢复事务，不逐条写入和重绘；
- 导入完成后只重建一次内存索引和界面；
- 失败时不提交半套数据；
- 释义冲突可统一保留当前值或使用导入值；
- PIN、标注和浏览位置按仍然存在的 Entry 与投影重新校验；
- Groq API Key 不进入 VIX JSON 或完整备份。

## 6. 内置数据修订

`settings.builtInSeedRevision` 当前值为 `2`：

- 修订 1：加入“计算机术语”词域；
- 修订 2：为 544 个普通词补充四个互斥普通词表和 Membership。

升级过程幂等，不复制既有 Entry，不覆盖 PIN、标注、浏览位置或用户自建内容。
