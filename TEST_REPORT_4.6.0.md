# Vocabulary Index 4.6.0 测试报告

## 自动化门禁

2026-08-10 交付工作树执行 `npm run test:all` 全部通过：

- Seed/Relation：6176 Seed Entries / 1240 Relation Components；
- static：34 个 Service Worker precache resources；
- runtime symbols / TypeScript checkJs：通过；
- pure runtime behavior：通过；
- stress：125 Entries / 158 Memberships / 31 Relation Components；
- integrations：Shortcut URL 最大 8042 chars（data）；
- performance：25 次 Search 30.2ms、Relation 6.4ms、VIX preflight 2481.3ms；
- layout：402×874 contract 通过。

另外逐文件执行 24 个 JS/MJS `node --check` 全部通过，16 个 JSON/WebManifest 全部重新解析通过。受当前执行环境策略限制，完整 App 通过本地 HTTP 的 Playwright E2E 会得到 `ERR_BLOCKED_BY_ADMINISTRATOR`；因此不把浏览器端到端或 iPhone compositor 行为虚报为自动化 PASS，现有 layout contract 继续使用受支持的 set-content 路径验证。

## 4.6 新增静态/行为契约

- `v3-scroll-runtime.js` ScrollCoordinator newest epoch owns root viewport；旧 epoch 不再合法。
- `v3-ui.js` 只有两个 root-scroll adapter 可直接调用 `window.scrollTo`，禁止直接 `window.scrollBy`。
- Virtual Chunk materializer 中不存在 root-scroll write。
- 42-row chunk 与 960px IO prefetch 保留。
- frame 存在 measured `virtualLayoutCache`；chunk materialize 后写真实 height。
- LetterNav 使用 flow anchor，并进入 `letter-jump` transaction。
- legal Navigation API Back 使用 `scroll:'manual'` + `event.scroll()` + semantic settle；旧 `after-transition` authoritative path 不再存在。
- transaction active 时禁止 authoritative snapshot persistence。
- Search cross-Collection 使用 immediate modal close + presentation fence。
- controllerchange reload 受显式 Service Worker update arm 保护。
- 4.5 destructive-v3 Navigation identity/Back/Home 静态契约继续覆盖。

## 性能门

4.6 不增加全量 5k DOM 路径；42 Chunk、目标强制 materialize、IO lazy 路径仍存在。performance suite 继续检查 Search/Relation/VIX preflight；真机还需观察长总表首次展开、快速 A→X、快速滚动时长任务/卡顿。

## 真机未由自动化证明

- iOS 26.5.x 的 visual commit / compositor 是否完全消除应用层闪帧；
- `event.scroll()` 与 semantic correction 在 native swipe 后的真实 presentation timing；
- 42/123/354/4995/5322 连续 100 次 Back 的最终位置；
- A→…→X 的 W141 旧 callback 是否完全消失；
- Search history preview 是否不再冻结 closing layer；
- 首装 `V→Home` 是否只出现一次；
- Safari 50 MiB snapshot-cache 平台边界的实际深度仍由设备画面决定，不作为 VIX PASS/FAIL 数量合同。

具体见 `tests/IPHONE_REDUCED_TESTS_4.6.0.md`。
