# 3.0 数据与导入格式

## 规范化

英文词项执行：Unicode NFKC、忽略大小写、合并空白、弯引号转直引号、Unicode 连字符/减号转 ASCII 连字符、删除零宽/BOM/双向控制字符。单个词项上限 160 个 JavaScript 字符单元。

## 完整 JSON

```json
{
  "schemaVersion": 3,
  "appVersion": "3.0.2",
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

### Domain

```json
{
  "id": "domain_computer_science_xxx",
  "name": "计算机科学",
  "order": 1,
  "glossEnabled": true,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Collection

`type` 只能为 `normal` 或 `system-phrases`。每个词域必须恰有一个系统短语表，其 ID 固定为 `<domainId>__phrases`。

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

约束：同一词域内 `normalizedText` 唯一；普通 word 至少有一个普通词表来源；phrase 可以没有普通来源。`glossHant` 最大 120 字符，只保存通用繁体。

### Membership

```json
{
  "id": "membership_xxx",
  "entryId": "entry_xxx",
  "collectionId": "collection_xxx",
  "sourceLabel": "n.",
  "sourceOrder": 12,
  "createdAt": "...",
  "updatedAt": "..."
}
```

Membership 只能指向普通词表。`sourceLabel` 只归档旧词性/来源标签，不参与身份、搜索、排序或 AI 核查。

**3.0 不存在 `sourceText` 字段。英文文本只从 Entry 读取。**

### PhraseToken

```json
{
  "id": "entry_xxx:0",
  "phraseId": "entry_xxx",
  "domainId": "domain_xxx",
  "token": "thread",
  "normalizedToken": "thread",
  "tokenIndex": 0
}
```

完整备份恢复时忽略外部提供的索引并根据短语文本重建，然后执行一致性验证。

### Pin

```json
{
  "id": "pin_xxx",
  "entryId": "entry_xxx",
  "domainId": "domain_xxx",
  "contextCollectionId": "collection_xxx",
  "order": 0,
  "createdAt": "..."
}
```

同一词项最多一个 PIN。`order` 保留 2.4.1 的 PIN 切换顺序；上下文词表必须能实际显示该词项。

### Settings

`numberMode` 只能为 `none`、`group` 或 `global`。`lastPositions` 以 `lastPosition:<domainId>:<collectionId>` 为键；恢复时必须指向该词表当前可见词项。

## 词项导入

### TXT / Markdown

```text
# 标题
thread n.
thread pool
```

只有井号后带空格的行视为标题；`#hashtag n.` 是正常词项。

### CSV

```csv
text,sourceLabel,gloss
thread,n.,线程
thread pool,,线程池
```

无表头时按 `text,sourceLabel,gloss` 解析。未启用释义的词域不会写入 gloss。

### JSON 数组

```json
[
  { "text": "thread", "sourceLabel": "n.", "gloss": "线程" },
  { "text": "thread pool", "glossHant": "線程池" }
]
```

兼容旧 `{ "word": "access", "pos": "n., v." }` 和 `{ "w": "access", "d": "n." }`。

## 安全边界

- 单文件上限 64 MB。
- 解析和预览完成前不修改 IndexedDB。
- 完整恢复执行 schema、ID、唯一性、关联、PIN、上次位置和短语索引校验。
- 未知实体字段不会进入数据库。
- Groq API Key 不进入备份。
- 撤销历史不进入备份。
