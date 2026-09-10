# Vocabulary Index 4.7.1 · iPhone 17 Reduced / P1 真机测试

唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。

## A. Push / Pop / Home

- [ ] 新Collection Push与4.7.0手感一致，无视觉回归。
- [ ] Back明显比4.7.0更从容，但不拖沓；第一次看到上一页时已经是离页位置。
- [ ] Home无缩放/横移；当前context释放→极短root-neutral→Home恢复，不像loading。

## B. Buffered Switch

分别在TOP、约500px、1500px、3000px、深展开/虚拟Chunk区域重复：

- [ ] Alphabet↔Date：旧/新文字从不同时可见；Bottom Toolbar全程可见；不先回TOP；首次可见即处于相同Entry/邻域。
- [ ] Word↔Phrase：同上；Alphabet保持同/近字母，Date保持同/近日期。
- [ ] 快速连续切换20次，不出现boot screen、Home重置、白屏、toolbar覆盖或明显卡死。
- [ ] Home global structured/non-structured只切换global grid，其它Home区域不闪。

## C. LetterRail

- [ ] 不存在跨两个字母的连续52px绿色选中框。
- [ ] 同一letter section内慢滚/快滚，rail camera不持续微抖或反向摆动。
- [ ] active letter越过safe zone后只发生有限横移；横移连续且不chase。
- [ ] 手动横拖rail不动正文，松手不自动复位；下一次正文纵向motion才重新接管。

## D. Modal / Relation

- [ ] 普通Modal不再明显全屏变暗，背景仍无法操作。
- [ ] 连续开关Settings/Search/Confirm 20–30次，关闭无明显残影抓眼，视觉消失后可立即操作背景。
- [ ] Relation展开有轻量local reveal；row不做慢height动画；收起更快。
- [ ] Relation multi-target跳转时旧Popover不跟随Page Push。

## E. Reduce Motion

开启iOS“减弱动态效果”：

- [ ] Push/Pop近瞬时或显著减弱；
- [ ] 同页长距离Letter/Entry jump直接落位，不播放长rAF scroll；
- [ ] LetterRail camera直接定位，不播放连续跟随；
- [ ] Modal/Relation/Buffer无明显位移/缩放；
- [ ] 功能、focus/inert、Back/Home、semantic anchor仍正确。
