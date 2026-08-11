# Vocabulary Index 4.7.3 部署

1. 使用完整4.7.3文件树覆盖GitHub Pages源；`index.html`必须在4.7.2后继续加载`css/v4.7.3.css`。
2. Service Worker cache generation：`gual-vocabulary-index-v4.7.3-presentation-lifecycle-20260811-1`；precache必须包含`css/v4.7.3.css`、`js/v3-motion-runtime.js`、`js/v3-scroll-runtime.js`。
3. `js/v3-navigation-runtime.js`仅为4.5/4.6历史源码，不由active UI import或SW precache；现行导航继续`single-slot-vix-v1`。
4. 首装`clients.claim()`不触发reload；仅显式waiting update / `SKIP_WAITING` armed后reload一次。
5. 无数据库migration：Schema6 / DB5 / Seed4 / VIX2不变。
6. 发布前：全JS/MJS syntax check、JSON parse、`npm run test:all`、内部`SHA256SUMS.txt`、ZIP integrity、fresh-extract checksum + full tests全部通过。
7. 发布后从iPhone 17 Home Screen重新启动，执行`tests/IPHONE_REDUCED_TESTS_4.7.3.md`。自动PASS不替代iOS 26.5真机门禁。
8. 重点验证Word/Phrase、Alphabet/Date、Home Global与Collection→Home：不再出现规律性整面闪灭；switch完成态仍TOP+collapsed。
9. 重点验证Relation连续开合：Entry主行身份稳定、只child slot展开/收起。
10. 全局词汇总表A→Z：逻辑正确同时live Entry-row resident set不单调累积；parked chunk回访位置稳定。
11. Push/Pop/LetterRail/Modal/Sticky保持既有行为。
