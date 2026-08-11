# Vocabulary Index 4.7.3 · iPhone 17 主屏幕 PWA 人工验收清单

> 唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。详细P1 cases见`IPHONE_REDUCED_TESTS_4.7.3.md`。

- [ ] 页面显示4.7.3；Home Screen名称仍为`Vocabulary Index`。
- [ ] 新Collection Push与4.7.0一致；Back Pop保持4.7.1节奏。
- [ ] 手动Alphabet↔Date任意深位置直接得到TOP+collapsed，无整面flash/白帧/old-new overlap。
- [ ] Alphabet→Date calendar month为目标section最新有效月份。
- [ ] 手动Word↔Phrase直接得到TOP+collapsed；Date使用目标view自身calendar month；不闪灭。
- [ ] Same-Collection Search/Relation跨view第一次可见已落在目标Entry，之后无第二次滚动。
- [ ] 快速连续View/Mode切换10–20次不静默丢输入、不并发、不出现boot/Home重置。
- [ ] Home structured/non-structured原子切换，无grid 1→0→1 blink。
- [ ] Collection→Home不整App消失，只出现非常轻的Home稳定感。
- [ ] Relation连续开合20次：Entry主行文字/日期/按钮不闪；child slot与Chevron正常展开/收起。
- [ ] Relation开合不触发可感root viewport二次补偿。
- [ ] LetterRail无continuous locus；同一letter section内camera不持续抖动。
- [ ] 全局词汇总表A→Z逻辑正确；越往后不再明显单调恶化。
- [ ] Safari Inspector中远端chunk出现`data-parked=true`，live`.entry-row`不逼近全量。
- [ ] 返回A/B等parked旧区域可正常materialize且位置无明显漂移。
- [ ] expanded letter/relation语义不因DOM park被自动关闭。
- [ ] 普通Modal透明interaction backdrop、快速close无回归。
- [ ] Sticky Alphabet/Date collapse无闪、无累计漂移。
- [ ] 首装只`V→Home`一次；显式更新reload一次；kill→reopen Home。
