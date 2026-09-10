# Vocabulary Index 4.7.3 · iPhone 17 Reduced / P1 真机测试

唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。

## A. Word / Phrase 与 Alphabet / Date

- [ ] 深位置Word↔Phrase：直接得到目标TOP+collapsed；无整页闪灭、白帧、old/new overlap。
- [ ] 深位置Alphabet↔Date：直接得到TOP+collapsed；进入Date月份正确；无整页闪灭。
- [ ] 连续View/Mode 10–20次：intent不丢失、不并发；视觉不呈现规律性的“亮→空→亮”。
- [ ] Bottom Toolbar全程保持稳定。

## B. Home

- [ ] Structured↔NonStructured Global：卡片原子变化，无34/52ms式blink。
- [ ] Collection→Home：App不整体变透明；Home只有极轻稳定感，无空白帧。

## C. Relation

- [ ] 连续展开/收起同一Entry 20次：Entry主行文字/日期/按钮不闪、不重新出现。
- [ ] Relation内容从主行下方展开/收起，Chevron方向同步。
- [ ] 展开位于屏幕中上/中部/接近底部的Entry，均无root viewport二次补偿跳动。
- [ ] Relation展开后滚远，再回访：expanded语义与内容保持正确。

## D. A→Z Resident Set

在全局词汇总表逐个点击A到Z：

- [ ] LetterRail active与最终落点逻辑保持正确。
- [ ] 越往后不再出现明显单调恶化的卡顿趋势。
- [ ] Safari Inspector中`.entry-row`数量不随已访问字母持续逼近全量；远端chunk出现`data-parked="true"`。
- [ ] 返回A/B等旧字母，parked chunk能恢复且页面位置不明显漂移。
- [ ] expanded letter集合不因DOM park自动收起。

## E. Push / Pop / Modal / LetterRail

- [ ] 新Collection Push保持4.7.0手感。
- [ ] Back Pop保持4.7.1/4.7.2节奏。
- [ ] LetterRail离散active与safe-zone camera无回归。
- [ ] Modal快速退出与透明interaction backdrop无回归。

## F. Reduce Motion

- [ ] View/Mode/Home Global为直接commit；
- [ ] Relation reveal近即时；
- [ ] Push/Pop/semantic scroll/LetterRail/Modal继续按现行Reduce Motion策略降级。
