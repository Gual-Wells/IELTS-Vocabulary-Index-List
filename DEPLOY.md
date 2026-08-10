# Vocabulary Index 4.6.0 部署

1. 使用完整 4.6.0 文件树覆盖 GitHub Pages 源，不删除历史 CSS；`index.html` 顺序加载至 `css/v4.6.0.css`。
2. Service Worker cache generation：`gual-vocabulary-index-v4.6.0-scroll-ownership-20260810-1`；预缓存必须包含 `js/v3-scroll-runtime.js` 与 `css/v4.6.0.css`。
3. 首次打开若检测旧 cache，cache bridge 清理旧 generation 并 reload；首次安装的 SW `clients.claim()` 本身不再触发第二次 reload。
4. 4.6 无数据库 migration：Schema6 / DB5 / Seed4 / VIX2 不变。
5. 发布前执行完整自动门禁与 fresh-extract `SHA256SUMS.txt` 校验；发布后重新从主屏幕启动 PWA 执行 `tests/IPHONE_REDUCED_TESTS_4.6.0.md`。
6. 自动化 PASS 不替代 iOS 26.5.x root scroll / native swipe / compositor 真机判定。深历史纯背景 preview 是 Safari snapshot-cache 平台边界，但 live VIX 二次闪/跳仍判失败。
