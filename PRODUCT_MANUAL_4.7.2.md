# Vocabulary Index 4.7.2 产品手册

## Collection 手动切换

### Word / Phrase

点击底栏词汇/短语切换后，目标页从顶部开始，所有字母/日期组处于收起状态。它不会尝试把当前阅读字母或日期映射到另一类别。

如果当前使用 Date 模式，目标 Word/Phrase view 的日历保持它自己的月份状态。

### Alphabet / Date

点击字母/日期排序后，目标模式从顶部开始并全部收起。进入 Date 时默认月份取当前目标 section 数据中最新有效月份。

## Search / Relation 精确跳转

精确目标仍会直接定位到目标 Entry。若目标在同一个 Collection 的另一 Word/Phrase view，系统先在不可见的短缓冲窗口完成切换和目标展开，再一次性落到标准阅读位置；不会显示新页面后再滚第二次。

## 快速连续操作

View/Mode、Collection navigation、Back、Home使用串行 intent queue。快速连点不会因为“正在缓冲”直接丢弃；View/Mode toggle会按实际执行时的当前状态逐个生效。

## 其它交互

4.7.1 的 Push/Pop、Root Home、LetterRail、Modal、Relation reveal与Reduce Motion行为保持不变。

## 版本边界

4.7.2 仍使用 Single Browser Slot导航。它与4.6历史导航模型的差异作为独立架构事项，不属于本版切换修复。
