# Vocabulary Index 4.7.2 UX 规范

## 1. 核心原则

**缓冲只负责“怎么看见变化”，不负责“变化完成后在哪里”。**

4.7.1 的无重叠 Buffer 保留；4.6 的手动切换结果恢复。

## 2. Word / Phrase

用户点击底栏 Word/Phrase：

`old visible → old hidden → target view 构建为 TOP + collapsed → new reveal`

- 不 crossfade old/new；
- 不保持同字母/日期邻域；
- 不恢复隐藏的目标浏览位置；
- Date calendar显示目标 view 自己原有月份状态。

## 3. Alphabet / Date

用户点击排序模式：

- new mode 为 TOP + collapsed；
- Alphabet→Date默认显示目标数据最新有效月份；
- 不以当前 Entry/日期作为落点；
- Buffer期间仍不显示 loading/spinner。

## 4. 精确目标动作

Search / Relation 等明确指向某个 Entry 时与手动切换不同：

- 若需要跨当前 Collection 内的 Word/Phrase view，可在 hidden buffer 中完成 view change + target group materialization；
- 第一次 reveal 就处于标准 Entry reading anchor；
- reveal 后不再发生第二段滚动。

## 5. 连续输入

- View / Mode toggle在 buffer期间仍可再次点击；
- 后续 toggle排队串行执行；
- 每个 toggle在轮到自己执行时读取实时当前状态；
- 浏览锚点、回顶、搜索按钮在短 buffer窗口暂时不可触发，避免与 semantic commit争用 viewport；
- Back/Home同样串行，不静默丢动作。

## 6. 其余 4.7.1 UX

Push、Pop、Root Home Buffer、Discrete LetterRail、透明 interaction backdrop、快速 Modal exit、Relation Local Reveal、Reduce Motion全部保持。
