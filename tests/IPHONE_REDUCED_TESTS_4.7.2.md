# Vocabulary Index 4.7.2 · iPhone 17 Reduced / P1 真机测试

唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。

## A. 手动 Word / Phrase

分别在 TOP、约500px、1500px、3000px、深展开/虚拟Chunk位置测试：

- [ ] Word→Phrase 第一次可见即为 Phrase TOP；所有 group collapsed；无旧新文字重叠。
- [ ] Phrase→Word 同上。
- [ ] Alphabet模式不保持来源 letter/nearest-letter。
- [ ] Date模式不保持来源 date/nearest-date；目标 calendar保持目标 view 自身月份状态。
- [ ] Bottom Toolbar视觉稳定，无 View Transition snapshot覆盖。

## B. 手动 Alphabet / Date

- [ ] Alphabet→Date 第一次可见即 TOP + collapsed。
- [ ] Date初始 calendar month = 当前目标 section 数据最新有效月份；无日期时为当前年月。
- [ ] Date→Alphabet 第一次可见即 TOP + collapsed，不恢复原 Alphabet深位置。
- [ ] 不出现 TOP→target 二段式、旧新重叠、白屏、boot/Home重置。

## C. Same-Collection 精确 Target

- [ ] Search目标在当前Collection另一Word/Phrase view时，reveal第一帧已处于目标Entry标准阅读锚点。
- [ ] reveal后不再发生第二次滚动/校正。
- [ ] Relation跨view target同上。
- [ ] 目标group正确展开，非目标group不因transient mapping额外展开。

## D. 连续输入

- [ ] 快速点击Word/Phrase 10–20次：动作按顺序执行，不静默丢失、不并发、不崩溃。
- [ ] 快速点击Alphabet/Date 10–20次：同上。
- [ ] Buffer中点击Back/Home：在当前commit完成后执行，不丢失。
- [ ] Buffer中浏览锚点/回顶/搜索短暂不可触发，结束后恢复。

## E. 4.7.1 无回归

- [ ] 新Collection Push手感不变。
- [ ] Back Pop约282ms且恢复页第一次可见即正确位置。
- [ ] Home仍为Root Buffer，无scale/translate。
- [ ] LetterRail离散active + safe-zone camera无回归。
- [ ] Modal快速退出、透明interaction backdrop无回归。
- [ ] Relation Local Reveal无回归。

## F. Reduce Motion

开启“减弱动态效果”：

- [ ] 手动View/Mode仍正确TOP + collapsed；
- [ ] precise target仍只落位一次；
- [ ] queue语义不变；
- [ ] Push/Pop/semantic scroll/LetterRail/Modal按4.7.1规则显著减弱或直接提交。
