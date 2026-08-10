# Vocabulary Index 4.7.1 部署

1. 使用完整4.7.1文件树覆盖GitHub Pages源；历史CSS/文档继续保留，`index.html`最后加载`css/v4.7.1.css`覆盖4.7.0基础presentation层。
2. Service Worker cache generation：`gual-vocabulary-index-v4.7.1-semantic-motion-gate-20260811-1`；precache必须同时包含`css/v4.7.0.css`、`css/v4.7.1.css`、`js/v3-motion-runtime.js`、`js/v3-scroll-runtime.js`。
3. `js/v3-navigation-runtime.js`是历史源码，不再由active UI import或SW precache；不要恢复browser rail。
4. 首装`clients.claim()`不触发reload；仅显式waiting update / `SKIP_WAITING` armed后reload一次。
5. 无数据库migration：Schema6 / DB5 / Seed4 / VIX2不变。
6. 发布前：全JS/MJS syntax check、JSON parse、`npm run test:all`、内部`SHA256SUMS.txt`、ZIP integrity、fresh-extract checksum + full tests全部通过。
7. 发布后从iPhone 17 Home Screen重新启动，执行`tests/IPHONE_REDUCED_TESTS_4.7.1.md`。自动PASS不替代iOS 26.5 compositor/120Hz/attention load真机门禁。
8. 重点验证深位置Alphabet/Date、Word/Phrase切换：不得old/new overlap、不得TOP reset、Bottom Toolbar全程live、不得出现boot/restart。
9. 重点验证4.7.0 Push无回归、4.7.1 Pop/Root Buffer/LetterRail/Modal/Relation新手感。
