# Vocabulary Index 4.7.0 部署

1. 使用完整 4.7.0 文件树覆盖 GitHub Pages 源；历史 CSS/文档继续保留，`index.html` 顺序加载到 `css/v4.7.0.css`。
2. Service Worker cache generation：`gual-vocabulary-index-v4.7.0-single-slot-motion-20260810-1`；precache必须包含 `js/v3-motion-runtime.js`、`js/v3-scroll-runtime.js` 与 `css/v4.7.0.css`。
3. `js/v3-navigation-runtime.js` 是历史源码，不再由 active UI import或SW precache；不要因看到文件存在就恢复 browser rail。
4. 首装 `clients.claim()` 不触发 reload；仅显式 waiting update / `SKIP_WAITING` armed 后 reload一次。
5. 无数据库 migration：Schema6 / DB5 / Seed4 / VIX2不变。
6. 发布前：全 JS/MJS syntax check、JSON parse、`npm run test:all`、内部 `SHA256SUMS.txt`、fresh-extract retest全部通过。
7. 发布后重新从 iPhone 17 Home Screen启动，执行 `tests/IPHONE_REDUCED_TESTS_4.7.0.md`。自动 PASS 不替代 iOS 26.5 View Transition / native Sticky / root scroll / 120Hz motion手感真机门禁。
8. 4.7 内部页面不创建 Safari History；若真机仍出现系统级边缘动作，应按 PWA container平台行为记录，不得重新引入 browserKey/pushState只为“借原生手势”。
