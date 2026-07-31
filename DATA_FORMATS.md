# 数据与导入格式

## 规范化与全局重复

词汇重复判断执行：

- Unicode NFKC 规范化；
- 忽略大小写；
- 合并连续空格；
- 弯引号统一为直引号；
- 保留连字符、逗号及其他有语义的标点。

词表名称也执行 NFKC、忽略大小写和合并空格后检查重复。

重复词不会在多个词表重复显示。来源关系在内部保留，显示词表由词表优先顺序决定。

## 词性

允许标签：

```text
n., v., adj., adv., prep., pron., conj., det., art., num., exclam.,
modal v., auxiliary v., infinitive marker
```

导入时支持 `/` 或 `,` 组合，例如：

```text
adj./adv.
n., v.
```

## Markdown / TXT

```text
# Oxford A1
## A
access n., v.
according to prep.
```

标题只用于兼容解析；导入目标始终由当前打开的词表决定。

普通 TXT 可直接逐行：

```text
access n., v.
according to prep.
```

只有 `# `、`## ` 等井号后带空格的行才视为标题，因此 `#hashtag n.` 会被当作正常词汇。

## CSV

```csv
word,pos
"access","n., v."
"according to","prep."
```

支持无表头两列 CSV。未闭合双引号、缺少词汇或缺少词性的行会在预览中报告。

## JSON 词汇数组

```json
[
  { "word": "access", "pos": ["n.", "v."] },
  { "word": "according to", "pos": "prep." }
]
```

兼容旧式 `{ "w": "access", "d": "n., v." }`，其中 `d` 只按词性解析。

## 完整 JSON 备份

包含：

- 词表及顺序；
- 词汇、词性、来源和当前归属；
- PIN；
- AI 核查标注；
- 序号模式。

不包含：

- Groq API Key；
- 撤销历史；
- 上次浏览位置；
- 页面展开状态；
- 浏览器缓存。

恢复时会执行完整 schema 和关联一致性校验。未知字段不会进入数据库。

## 限制与提交

- 单个导入文件上限：64 MB。
- 完整备份词条上限：50,000。
- 单个词汇或短语上限：160 个 JavaScript 字符单元。
- 文件内部重复词先合并词性，再参与全局重复处理。
- “替换当前词表”只替换当前来源集合；有其他来源的词会自动回落。
- 解析、验证和预览完成前不会修改 IndexedDB。
