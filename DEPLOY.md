# Vocabulary Index 4.5.0 部署

1. 使用完整 4.5.0 文件树覆盖 GitHub Pages 源。
2. 不删除历史 CSS；`index.html` 顺序加载至 `css/v4.5.0.css`。
3. Service Worker cache generation：`gual-vocabulary-index-v4.5.0-navigation-rail-20260810-1`。
4. 首次打开若检测旧 cache，cache bridge 会清理旧 generation 并 reload。
5. 4.5 无数据库 migration；Schema6 / DB5 / Seed4 / VIX2 不变。
6. 发布后重新从主屏幕启动 PWA 做 `tests/IPHONE_REDUCED_TESTS_4.5.0.md`。
7. 自动化 PASS 不能替代 iOS Navigation API / interactive swipe 真机结果。
