# Vocabulary Index 4.0.x 数据格式

> 4.2.0 runtime note：Schema 6 / DB 5 / Seed 4 / VIX 2 与 4.0.0 完全相同；本版只更新运行时导航/Sticky/浮层/Home UI，内容格式无迁移。

## 1. 版本

- Backup Schema：6
- IndexedDB：5
- Built-in Seed revision：4
- VIX：2
- Entry context：`vix-entry-context` v2

4.0.x 与旧 Full Backup/VIX v1 硬断代；旧文件不做隐式迁移。

## 2. Domain

```json
{
  "id": "domain_general_english",
  "name": "通用英语",
  "order": 0,
  "glossEnabled": true,
  "contentMode": "structured",
  "relationExcluded": false
}
```

`contentMode` 为 `structured | nonStructured`，创建后不可变。`relationExcluded` 只影响 Effective Relation Graph，不删除 Raw Graph。

## 3. Collection

普通 Collection 是内容 Membership 的归属单位；系统总表是运行时虚拟投影。主要字段：`id/domainId/name/label/type/order/hidden`。用户内容只能写入 `type:"normal"` Collection。

## 4. Entry

```json
{
  "id": "entry:domain:normalized",
  "domainId": "domain",
  "text": "take into account",
  "normalizedText": "take into account",
  "kind": "phrase",
  "contentType": "",
  "partsOfSpeech": ["v."],
  "glossHans": "考虑",
  "glossHant": "考慮",
  "glossSource": "source-key"
}
```

`kind`：`word | phrase | content`。同域唯一身份为 `domainId + normalizedText`，不把词性或 contentType 纳入身份。`contentType` 为开放稳定字符串，只对 content 有业务意义。

## 5. Membership 与优先级占有

Membership 记录 Entry 属于某普通 Collection 的事实：

```json
{
  "id": "membership-id",
  "entryId": "entry-id",
  "collectionId": "collection-id",
  "sourceLabel": "n.",
  "sourceOrder": 10
}
```

一个 Entry 可有多个 Membership；word / phrase / content 都只投影到最高优先级可见普通 Collection。系统总表仍聚合所有具体 Entry。

## 6. RelationComponent

```json
{
  "id": "source:start:end:hash",
  "sourceEntryId": "entry-id",
  "domainId": "domain-id",
  "text": "access data",
  "normalizedText": "access data",
  "startToken": 0,
  "endToken": 2,
  "componentKind": "span"
}
```

组件只由精确结构匹配生成。运行时按 `normalizedText` 解析所有具体 Entry，并对称加入 Raw Graph。低级词汇/Domain 关闭仅过滤 Effective Graph。

## 7. Personal State

- Pin：具体 Entry + 可见 Collection context。
- Annotation：具体 Entry。
- StudyStamp：`entry:<entryId>`。
- Settings：显示/浏览/关系过滤等应用设置。
- History：Undo/Redo。

系统总表不拥有上述状态。

## 8. Full Backup Schema 6

完整备份包含 Domain、Collection、Entry、Membership、RelationComponent、PIN、Annotation、StudyStamp、Settings。API Key 继续留在浏览器本地存储，不写 Seed/VIX；旧世代 Full Backup 不可导入 4.2.0。

## 9. VIX JSON v2

顶层：

```json
{
  "format": "vix-json",
  "version": 2,
  "exportedAt": "...",
  "target": {"scope": "global|domain|collection"},
  "mode": "merge|replace",
  "data": {
    "domains": [],
    "collections": [],
    "entries": [],
    "memberships": []
  },
  "sources": []
}
```

v2 要求 Domain 携带 `contentMode`，Entry 携带 `kind`，并可携带 `contentType`、`partsOfSpeech`、Hans/Hant gloss。VIX 只交换内容，不交换 PIN、日期、Annotation、历史或 UI 状态。示例见 `data/examples/`。

## 10. Seed

`data/seed.json` 是 Schema 6 canonical backup 形态，`settings.builtInSeedRevision=4`。4.0.0 检测旧内容世代时执行整代替换，而非 add-only merge。

## 11. ChatGPT Entry Context v2

仅包含当前具体 Entry、当前 Domain/规范 Collection、繁体释义及来源、有限直接 Effective Relations、跨域同形警告。明确排除 PIN、学习日期、Annotation、全量 Membership、原始 RelationComponent 和全库同形对象。
