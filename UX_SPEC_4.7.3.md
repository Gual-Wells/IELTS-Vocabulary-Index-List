# Vocabulary Index 4.7.3 UX 规范

## 1. 无运动语义切换

Word↔Phrase、Alphabet↔Date、Home Global不再通过“闪灭一次”表达缓冲。

- 点击后直接提交稳定目标；
- Word/Phrase、Alphabet/Date最终状态继续TOP+collapsed；
- 不crossfade、不blank、不spinner；
- Home Global可有非常轻的0.97→1稳定感，但任何时刻不得消失到0。

## 2. Home

Collection→Home先完成root state，再让新Home以极弱非零settle稳定；用户不应看到整个App熄灭或空白帧。

## 3. Relation

Relation是局部accordion语义：

- 一级表项文本和操作区保持视觉/DOM身份；
- 下方Relation slot平滑展开/收起；
- Chevron同步旋转；
- 不出现整行闪烁、重新raster或viewport补偿跳动。

## 4. LetterRail / 全局总表性能

A→Z连续跳转时，LetterRail逻辑保持原样。性能管理发生在不可见的DOM resident set：远端已访问Entry row可以park，但字母的expanded产品状态不被自动关闭。

用户返回旧字母时应看到正常materialize，不应感知“旧字母被系统偷偷收起”。

## 5. Reduce Motion

Atomic Commit天然无额外运动；Home/Grid轻settle直接取消；Relation slot/Chevron transition压缩到近即时；Push/Pop/semantic scroll继续服从既有Reduce Motion规则。
