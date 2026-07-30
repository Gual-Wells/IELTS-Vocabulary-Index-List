# 数据与导入格式

## 规范化与全局重复

判断重复时执行：

- Unicode NFKC 规范化；
- 忽略大小写；
- 合并连续空格；
- 将弯引号统一为直引号；
- 保留连字符、逗号及其他有语义的标点。

重复词不会在多个词表重复显示。来源关系在内部保留，显示词表由当前词表顺序决定。

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

支持原始格式：

```text
# Oxford A1
## A
access n., v.
according to prep.
```

标题只用于解析兼容；当选择“导入到当前词表”时，文件内标题不会改变目标词表。

普通 TXT 可直接逐行：

```text
access n., v.
according to prep.
```

无法识别词性的行会在预览中列出并被忽略。解析成功前不会清空数据。

## CSV

推荐表头：

```csv
word,pos
"access","n., v."
"according to","prep."
```

也支持无表头的两列 CSV，第一列为词汇，第二列为词性。

## JSON 词汇数组

```json
[
  { "word": "access", "pos": ["n.", "v."] },
  { "word": "according to", "pos": "prep." }
]
```

同时兼容旧式字段 `{ "w": "access", "d": "n., v." }`，但只把 `d` 当作词性解析。

## 完整 JSON 备份

设置中的“导出完整 JSON”包含：

- 词表顺序；
- 词汇、词性及来源关系；
- 书签；
- AI 标注；
- 非敏感设置。

Groq API Key 永远不包含在备份中。
