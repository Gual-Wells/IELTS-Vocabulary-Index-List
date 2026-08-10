# Vocabulary Index 4.5.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 目标：iPhone 17 标准版 / iOS 26.5.x WebKit / Home Screen standalone。导航帧级 reduced cases 见 `IPHONE_REDUCED_TESTS_4.5.0.md`。

- [ ] 页面/设置显示 4.5.0；Home Screen 名称仍为 `Vocabulary Index`。
- [ ] Sticky Alphabet/Date 收起不闪、不累计漂移。
- [ ] Settings/Search/Confirm/nested Modal 不破坏背景 Sticky。
- [ ] Home→A：Back button 与左边缘 swipe 均回 Home。
- [ ] Home→A→B→C：Back 严格 C→B→A→Home。
- [ ] half swipe cancel 不修改 logical stack。
- [ ] depth>=2 才显示 Home；返回后按钮状态立即匹配真实 depth。
- [ ] Home 一次回原 root，无 ROOT2/snap-back。
- [ ] Home 后旧 A/B/C 不可由 Forward 恢复为 live page。
- [ ] Home→新 D 后 Back 只回 Home。
- [ ] same Collection Search/Relation/PIN/word-phrase/mode 不新增 Back layer。
- [ ] cross Collection Search/Relation 新增且只新增一层。
- [ ] Back 恢复目标 frame 的 mode/calendar/expanded/relations/scroll。
- [ ] 跨 Collection PUSH 不再出现固定 70/140ms stale-frame 闪现。
- [ ] kill PWA 后重开为 Home。
