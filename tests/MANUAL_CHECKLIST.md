# Vocabulary Index 4.6.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 目标：iPhone 17 标准版 / iOS 26.5.x WebKit / Home Screen standalone。重点 reduced cases 见 `IPHONE_REDUCED_TESTS_4.6.0.md`。

- [ ] 页面/设置显示 4.6.0；Home Screen 名称仍为 `Vocabulary Index`。
- [ ] Home→A→B→C 的 App Back / native Back / half-cancel / Home destructive semantics 不回归。
- [ ] same Collection Search/Relation/PIN/view/mode 不新增 recursive history；cross Collection 只新增一层。
- [ ] 42 / 123 / 354 / 4995 / 5322 Back stress 最终 semantic position 每次一致；4995 不稳定到 4989，5322 始终 bottom。
- [ ] 全收起 direct X 与 A→B→…→X 最终位置一致，仅允许 document-bottom clamp；W141 狂跳不复现。
- [ ] 已展开 section 反复点击同一 LetterNav cell 始终回 natural heading，不再顶部/底部随机或下偏 3–8 Entry。
- [ ] LetterNav active、Sticky heading、正文没有明显分帧后刷新或应用自身二次闪/跳。
- [ ] Search 跨 Collection 后 native Back preview 不再由 VIX 主动冻结 closing Search；live page 无 Search 再消失一次。
- [ ] 深 native history 可接受 Safari 纯背景 preview，但 live VIX 接管后立即正确且可交互。
- [ ] Sticky Alphabet/Date collapse 仍不闪、不累计漂移。
- [ ] Settings/Search/Confirm/nested Modal 仍不破坏背景 Sticky，背景不可交互。
- [ ] 长总表快速滚动、A→X、Search/PIN target 无明显性能回归；42 Chunk lazy 行为仍存在。
- [ ] 全新安装只 `V→Home` 一次；显式更新只 reload 一次。
- [ ] kill PWA 后重开为 Home。
