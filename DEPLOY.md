# Vocabulary Index 4.7.2 部署

1. 使用完整4.7.2文件树覆盖GitHub Pages源；历史CSS/文档继续保留，`index.html`按顺序加载`css/v4.7.1.css`与runtime-only `css/v4.7.2.css`。
2. Service Worker cache generation：`gual-vocabulary-index-v4.7.2-switch-contract-repair-20260811-1`；precache必须包含`css/v4.7.0.css`、`css/v4.7.1.css`、`css/v4.7.2.css`、`js/v3-motion-runtime.js`、`js/v3-scroll-runtime.js`。
3. `js/v3-navigation-runtime.js`是4.5/4.6历史源码，不由active UI import或SW precache。4.7.2不裁决是否恢复4.6 Browser History Rail。
4. 首装`clients.claim()`不触发reload；仅显式waiting update / `SKIP_WAITING` armed后reload一次。
5. 无数据库migration：Schema6 / DB5 / Seed4 / VIX2不变。
6. 发布前：全JS/MJS syntax check、JSON parse、`npm run test:all`、内部`SHA256SUMS.txt`、ZIP integrity、fresh-extract checksum + full tests全部通过。
7. 发布后从iPhone 17 Home Screen重新启动，执行`tests/IPHONE_REDUCED_TESTS_4.7.2.md`。自动PASS不替代iOS 26.5真机门禁。
8. 重点验证手动Word/Phrase、Alphabet/Date：**TOP + collapsed**、无old/new overlap；Alphabet→Date为目标数据latest-valid-month。
9. 重点验证Same-Collection Search/Relation跨view：第一次reveal已在Entry reading anchor，之后无第二次滚动。
10. 快速连续View/Mode切换不得静默丢输入；Back/Home在buffer后按队列执行。
11. 重点确认4.7.0 Push及4.7.1 Pop/Root Buffer/LetterRail/Modal/Relation无回归。
