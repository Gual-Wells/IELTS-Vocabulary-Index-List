# Vocabulary Index 4.7.0 测试报告

## 自动化门禁

2026-08-10 最终封装前工作树已执行 `npm run test:all` 全部通过；封装候选 ZIP 也已解压到全新目录执行内部 SHA、语法/JSON 解析与 `npm run test:all`，全部通过。生命周期文档/manifest bookkeeping 同步后的最终 artifact 按同一 fresh-extract 流程复核；交付结论以最终 artifact 复核为准，且自动化不得替代 iPhone 真机验收。

当前通过范围：

- Seed / Relation：6176 Seed Entries / 1240 Relation Components；
- static：Service Worker precache 完整/无重复，single-slot/asset/motion 静态契约通过；
- runtime symbols + TypeScript checkJs：通过；
- runtime behavior：ScrollCoordinator、Sticky 4.4、Alphabet semantic axis、motion duration/camera pure math 通过；
- stress：125 Entries / 158 Memberships / 31 Relation Components；
- integrations：Shortcut URL 最大 8042 chars（data）；
- performance：28.6ms / 25 searches；4.1ms relations；2951.4ms VIX preflight（同机单次门禁测量，性能数值允许正常抖动）；
- layout：402×874 contract 通过。


## Fresh-extract 候选包复核

候选完整 ZIP 在全新目录复核结果：

- ZIP 共 243 个文件，其中 `FILE_MANIFEST.txt` / `SHA256SUMS.txt` 覆盖 241 个受校验源文件；
- `sha256sum -c SHA256SUMS.txt`：241/241 PASS；
- JS/MJS：26 个文件全部 `node --check` PASS；
- JSON/WebManifest：16 个文件全部重新解析 PASS；
- `npm run test:all`：全部 PASS；候选 fresh-extract 性能测量为 28.9ms / 25 searches、3.3ms relations、3524.4ms VIX preflight（性能数值允许正常抖动）。

该复核验证的是交付物可重建性/自动契约，不是 iPhone compositor 与 motion 手感结论。

## 4.7 新增自动契约

- active UI `NAVIGATION_MODEL='single-slot-vix-v1'`；
- `history.replaceState()` 仅 1 次；`history.pushState()` / `.traverseTo()` / `history.back/go/forward()` 为 0；
- active UI 不含 browserKey/rootBrowserKey/deadBrowserKeys；
- `v3-motion-runtime.js` physical↔semantic round-trip；
- A→B 3800px 与 B→C 120px 的中点均映射为对应 0.5 semantic unit；
- 缺失 Q 时 P→R semantic gap=2；
- same logical letter distance 的 duration 与物理像素高度严格解耦：同一 semantic gap 使用相同时间预算；
- LetterRail camera velocity bias 连续；
- pointerup/cancel 不触发 LetterNav 自动复位；page Y 变化才释放 manual lock；
- Date Calendar 不存在动态 page-scroll sync symbol；
- Target geometry prewarm / 42 chunk / 960px prefetch / Virtualizer no-root-scroll contract 保留；
- Page Push/Pop/Home/Sibling/Reindex 与 modal spring CSS 语义存在；
- Word/Phrase 普通切换清 source/target transient state，Date target month fresh initialize；
- Service Worker first-install reload guard 不回归。

## 自动化不能证明

- iPhone 17 / iOS 26.5.x View Transition compositor 是否完全无闪；
- A→…→X 真机是否完全消除可见二次收敛；
- semantic long-scroll 的主观速度/曲线是否符合产品手感；
- LetterRail continuous locus/camera 是否在 120Hz/真实触控下无抖动；
- Push/Pop/Sibling/Reindex/Home 各 motion 是否达到“正常 App”质感；
- 单 browser slot 在 installed standalone 上是否完全消除旧 4th-back pure-color VIX history surface。

这些均由 `tests/IPHONE_REDUCED_TESTS_4.7.0.md` 终验。


## 浏览器级 E2E 环境限制

当前工程容器尝试通过本地 HTTP 启动完整页面并用 Playwright `page.goto()` 加载时，被运行环境策略以 `net::ERR_BLOCKED_BY_ADMINISTRATOR` 拦截。因此本次不能声称“完整浏览器 HTTP E2E PASS”。`tests/layout-contract-check.py` 使用 Playwright `set_content` 的 402×874 layout contract 可以执行并已通过；其余 runtime correctness 由 DOM-free pure-math、static contract、TypeScript checkJs、integration/stress/performance 门覆盖。

该环境限制不替代 iPhone 17 / iOS 26.5.x standalone 真机验收。
