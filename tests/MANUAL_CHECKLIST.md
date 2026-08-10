# Vocabulary Index 4.7.1 · iPhone 17 主屏幕 PWA 人工验收清单

> 唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。详细 reduced/P1 cases 见 `IPHONE_REDUCED_TESTS_4.7.1.md`。

- [ ] 页面显示4.7.1；Home Screen名称仍为`Vocabulary Index`。
- [ ] 新Collection Push与4.7.0一致，无回归。
- [ ] Back Pop更从容、状态首次可见即正确，无TOP→target二跳。
- [ ] Home使用Root Buffer，无scale/translate、不模拟Back×N、不像loading。
- [ ] Alphabet↔Date任意深位置无old/new文字重叠、不回TOP、Bottom Toolbar全程live、首次可见在对应semantic邻域。
- [ ] Word↔Phrase同样无snapshot overlap/TOP reset；Alphabet保持同/近letter，Date保持同/近date。
- [ ] 深位置快速连续切换20次不出现boot screen/Home重置/白屏/toolbar覆盖。
- [ ] Home structured/non-structured只buffer global grid，其它Home区域不闪。
- [ ] LetterRail没有continuous 52px locus；同一letter section内滚动camera不持续抖动。
- [ ] LetterRail active越出safe zone才发生有限平滑横移；manual drag规则不变。
- [ ] 同页Letter/Entry/PIN/Date/Return Top继续真实semantic scroll；Reduce Motion下直接落位。
- [ ] Cross-Collection target仍为Page Push→Semantic Scroll。
- [ ] 普通Modal不明显全屏变暗；close快速释放注意力；连续开关20–30次无残影感。
- [ ] Relation展开/收起有轻量local reveal；row无慢height animation；multi-target导航时旧Popover不跟随Push。
- [ ] Sticky Alphabet/Date collapse继续无闪、无累计漂移。
- [ ] 42 Chunk / 960px virtual path无明显性能回归。
- [ ] 首装只`V→Home`一次；显式更新reload一次；kill→reopen Home。
