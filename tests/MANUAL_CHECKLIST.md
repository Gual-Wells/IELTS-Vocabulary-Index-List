# Vocabulary Index 4.7.2 · iPhone 17 主屏幕 PWA 人工验收清单

> 唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。详细P1 cases见`IPHONE_REDUCED_TESTS_4.7.2.md`。

- [ ] 页面显示4.7.2；Home Screen名称仍为`Vocabulary Index`。
- [ ] 新Collection Push与4.7.0一致，无回归。
- [ ] Back Pop保持4.7.1时序，状态首次可见即正确。
- [ ] Home使用Root Buffer，无scale/translate、不像loading。
- [ ] 手动Alphabet↔Date任意深位置无old/new重叠；目标首次可见TOP + collapsed。
- [ ] Alphabet→Date calendar month为目标section最新有效月份。
- [ ] 手动Word↔Phrase首次可见TOP + collapsed；不保持同/近letter/date；Date使用目标view自身calendar month。
- [ ] Same-Collection Search/Relation跨view第一次reveal已落在目标Entry，之后无第二次滚动。
- [ ] 快速连续View/Mode切换10–20次不静默丢输入、不并发、不出现boot/Home重置/白屏。
- [ ] Buffer中Back/Home在当前commit后执行；浏览锚点/回顶/搜索短暂锁定后恢复。
- [ ] Home structured/non-structured只buffer global grid，其它Home区域不闪。
- [ ] LetterRail没有continuous locus；同一letter section内camera不持续抖动。
- [ ] LetterRail active越出safe zone才有限横移；manual drag规则不变。
- [ ] 同页Letter/Entry/PIN/Date/Return Top继续真实semantic scroll；Reduce Motion下直接落位。
- [ ] Cross-Collection target仍为Page Push→Semantic Scroll。
- [ ] 普通Modal透明interaction backdrop、快速close无回归。
- [ ] Relation local reveal无回归；multi-target导航时旧Popover不跟随Push。
- [ ] Sticky Alphabet/Date collapse继续无闪、无累计漂移。
- [ ] 42 Chunk / 960px virtual path无明显性能回归。
- [ ] 首装只`V→Home`一次；显式更新reload一次；kill→reopen Home。
