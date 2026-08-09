# Vocabulary Index 4.3.0 测试报告

## 1. 结论

4.3.0 工作树自动化测试全部通过。自动化覆盖 Seed/关系、静态契约、运行时符号、压力、Provider 集成、性能和 402×874 布局；**不等同于 iPhone 17 / iOS 26.5.2 Home Screen standalone 真机验收**。系统 edge gesture、Sticky 首次 compositor 帧和 PWA modal background lock 必须按 `tests/IPHONE_REDUCED_TESTS_4.3.0.md` 真机执行。

## 2. `npm run test:all`

- `run-tests`: PASS — 6176 Seed Entries；1240 Relation Components。
- `static-tests`: PASS — 28 个 Service Worker precache resources。
- `runtime-symbol-tests`: PASS。
- `stress-tests`: PASS — 125 Entries；158 Memberships；31 Relation Components。
- `integration-tests`: PASS — 最大 ChatGPT Shortcut URL 8042 chars（data case）。
- `performance-tests`: PASS — 25 次 Search 37.2ms；Relations 6.8ms；VIX preflight 2889.1ms。
- `layout-contract-check`: PASS — 402×874。

## 3. 4.3.0 专项静态/运行时契约

1. `getViewMode(collectionId)` / `setViewMode(collectionId, mode)` 为 Collection-level；UI 不再以 `nextView` 作为 mode key。
2. `collapseNativeStickySection()` 唯一定义；旧 `compensateCollapsedSection` 删除；Date/Alphabet 都进入共享 collapse transaction。
3. Browser history state 不包含 `pageSnapshot`；存在 destructive navigation model、navigationStack、discarded tokens、Forward reject、Home root clear；`renderApp()` 另有 root-route 门禁，防止外部/手动 hash 先显示 Home 却遗留 recursive frame。
4. `v3-upgrade.js` 在 UI 前设置 `history.scrollRestoration='manual'`。
5. `index.html` 常驻 `navigation-underlay`/edge feedback；edge listener 为 non-passive capture。
6. Search/Confirm native `<dialog>` 从 runtime HTML 删除；无 `showModalStable()` / `.showModal()` 当前调用。
7. 当前 Modal runtime 无 `body.style.position='fixed'` / body negative top；保留 retained parent inert/restore。
8. 当前 runtime 无 `modal-card-pending` double-rAF reveal；4.3 CSS 提供 modal enter/exit。
9. PIN toggle 函数片段不包含 `replaceWith()`；PIN/Review 使用 persistent Dock CSS。
10. Query/Relation 共享 Popover enter/exit lifecycle；定位算法仍独立。
11. 4.2 native Sticky / Query geometry / Home wordmark / Global Index Rule / 58px toolbar / 520+350 longpress 等旧契约继续回归。

## 4. 402×874 布局专项

- retained management/search/confirm 三种 custom Modal card 均保持 viewport 内约束；每层 backdrop 为完整 402×874 Web viewport。
- Modal title 仍物理居中。
- Pin Dock 在 hidden state 仍为 `display:grid`，通过 visibility/opacity 控制；`.dock-visible` 可见。
- Entry Traditional gloss 与 source-domain secondary line 同 bottom metric。
- 字母 cell 边框 ownership、disabled glyph、58px bottom toolbar、非编辑文本不可选/编辑控件可选继续 PASS。

## 5. 附加代码/数据校验

- `node --check`：`js/*.js`、`tests/*.mjs`、`tools/*.mjs`、`sw.js` PASS。
- JSON/WebManifest parse：16 个文件 PASS。
- `data/seed.json` SHA-256：`a2a1c5ba78c67fcaa8bf6b9d5f83f4155f31e7014285c8589038759dd84bfc84`。
- `data/relation-low-level-lexemes.json` SHA-256：`962a20764af2112f2d8a70bb1aa929fd06987aefa742699fef1956f905b2e335`。
- `data/vix-json.schema.json` SHA-256：`82a2de2ee1b599b139578002ef2e7e636b8066f67d8e839859963eedac253eb4`。
- 数据世代与 4.2.0 相同：3 Domain / 17 Collection / 6176 Entry（5539 word / 587 phrase / 50 content）/ 7574 Membership / 1240 RelationComponent。

## 6. 自动化不能证明的目标机项

- 首次 native Sticky collapse 是否完全没有 compositor flash；
- non-passive edge guard 是否在所有 iOS Forward 起手中早于系统 history preview；
- 合法 iOS Back 是否只出现一次原生动画且 App 不叠第二 transition；
- 不使用 body-fixed 后，standalone modal 在 rubber-band、nested modal、keyboard 等场景是否完全锁住背景；
- fixed Dock/edge feedback 是否触发 iOS 26 已知 compositor paint 偏差。

这些项目必须真机执行，不能由 Chromium layout 或源码 symbol 检查冒充。

## 7. 正式 ZIP fresh-extract 门禁

正式封装后必须：

1. 全新目录解压正式 ZIP；
2. `sha256sum -c SHA256SUMS.txt` 全部通过；
3. fresh extraction 再执行 `npm run test:all`；
4. 再做 Node syntax / JSON parse；
5. ZIP 本身计算 SHA-256 并输出包外 sidecar/Release Verification。

只有完成该门禁的包才是 4.3.0 正式交付。
