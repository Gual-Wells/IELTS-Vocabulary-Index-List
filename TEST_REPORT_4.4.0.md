# Vocabulary Index 4.4.0 测试报告

## 1. 自动化结论

工作树 `npm run test:all` 全部通过。该结论只覆盖数据、源码、纯 runtime 行为、压力、集成、性能与 402×874 layout contract，不等同于 iPhone 17 / iOS 26.5.2 Home Screen standalone 真机验收。

## 2. 本轮结果

- `run-tests`: PASS — 6176 Seed Entries；1240 Relation Components。
- `static-tests`: PASS — 31 个 Service Worker precache resources。
- `runtime-symbol-tests`: PASS。
- `runtime-behavior-tests`: PASS。
- `stress-tests`: PASS — 125 Entries；158 Memberships；31 Relation Components。
- `integration-tests`: PASS — 最大 ChatGPT Shortcut URL 8042 chars（data case）。
- `performance-tests`: PASS — 25 searches 30.3ms；relations 3.9ms；VIX preflight 2706.0ms（容器本轮执行，非产品 SLA）。
- `layout-contract-check`: PASS — 402×874。

## 3. 4.4 专项行为契约

### Sticky

1. targetY 使用 flow anchor，不使用 section border-box natural-top 假设。
2. document bottom 以 post-collapse max scroll clamp。
3. delta≈0 时不 root scroll。
4. 生产路径不再出现 4.3 的同步 `collapse(); scrollTo()`。
5. VT 与无 VT fallback 都按 scroll settle → collapse 顺序。

### Navigation

1. `destructive-v2` 使用 generation+token identity。
2. wrong `depth` metadata 不影响合法 token classifier。
3. dead/unknown/wrong-generation token = stale。
4. 当前 depth 后面的 live token = forbidden forward。
5. snapshot persistence 不 rewrite browser identity。
6. Home 不再 `history.go(-appNavigationDepth)`。
7. restore guard 存在真实 `historyRestoreInProgress = true → finally false`。

### Modal

1. `lockPageForModal()` 不改变 html/body class/overflow。
2. Modal open 使用 `updateModalViewportGeometry()`，不直接触发 background overlay/sticky remeasure。
3. `#app.inert` 仍保留，nested retained modal 语义不变。

## 4. 必须真机验收

- 100 / 500 / 1500 / 3000px Sticky displacement；
- 第二次重新滚深后再 collapse 是否仍稳定；
- legal slow/fast/half-cancel iOS Back 是否只有一次原生动画；
- Forward guard 是否早于 system preview；
- remove underlay/stacking 后合法 Back 是否仍露纯色；
- Modal 打开时 native Sticky paint 是否完全不变；若仍异常，再做 root app inert A/B。

## 5. 正式包门禁

最终 ZIP 生成后必须 fresh-extract：`sha256sum -c SHA256SUMS.txt`、`npm run test:all`、Node syntax、JSON parse。最终 ZIP SHA-256 在包外报告。
