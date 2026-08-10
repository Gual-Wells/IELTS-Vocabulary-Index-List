# Vocabulary Index 4.7.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 唯一目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。详细 reduced cases 见 `IPHONE_REDUCED_TESTS_4.7.0.md`。

- [ ] 页面显示 4.7.0；Home Screen 名称仍为 `Vocabulary Index`。
- [ ] 5+ 层 VIX recursive path 只通过 App Back/Home 返回；不再出现 Safari internal-history 第 4 层纯色 VIX page。
- [ ] 42/123/354/4995/5322 Back 第一次 live target 即正确，无 TOP→target 二跳。
- [ ] direct X / A→…→X / W 深展开→X 连续、最终一致，无可辨认 W/Y 二次收敛。
- [ ] 字母实际展开高度极不均匀时，LetterRail 仍按逻辑字母等权连续前进。
- [ ] 手动横拖 LetterNav 后页面不动、轨道不复原；只有下一次页面纵向 motion 才自动接管。
- [ ] 同页 Letter/Entry/PIN/Date/Return Top 都是真实连续纵向运动，不是 crossfade。
- [ ] Cross-Collection target = Page Push 到 TOP → 再连续 scroll 到目标。
- [ ] Word↔Phrase 是浅 sibling swap，目标 TOP+collapsed，不恢复隐藏 target view 状态。
- [ ] Alphabet↔Date 是 reindex motion，目标 TOP+collapsed；Calendar query-only，不随 page scroll 动态跟踪。
- [ ] Forward/Back 是对称 Push/Pop；Home 是独立 hierarchy reset。
- [ ] Modal open 有克制 scale/fade/spring，close 更快；背景 Sticky/scroll 几何冻结。
- [ ] Sticky Alphabet/Date collapse 继续无闪、无累计漂移。
- [ ] 42 Chunk / 960px virtual path 无明显性能回归。
- [ ] 首装只 `V→Home` 一次；显式更新 reload 一次；kill→reopen Home。
