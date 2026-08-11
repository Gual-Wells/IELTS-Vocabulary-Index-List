# Vocabulary Index 4.7.2 测试报告

## 自动测试合同

4.7.2 反转了 4.7.1 中错误合法化 transient neighborhood 的测试要求：

- `transientModeSwitchAnchor` / `transientViewSwitchTarget` / nearest-group helpers 不得存在于 active UI；
- Manual Word/Phrase 必须包含 TOP position、collapsed groups、目标 view `getCalendarMonth()`；
- Manual Alphabet/Date 必须包含 TOP position、collapsed groups、Date latest-valid-month；
- same-Collection 跨 view target 在 buffered commit 之后不得再次 `jumpToEntry(entryId)`；
- 单次 landing 必须继续保留目标 group materialization、PIN sync 与 jump highlight，不以第二次 scroll transaction 换取这些副作用；
- busy-time `if (bufferedStateCommitInProgress) return` 不得存在；
- 必须存在 `enqueuePresentationIntent()`；View/Mode toggle 必须在实际执行时解析当前状态，避免队列中的陈旧 target/section；
- Buffer 不得把整个 Bottom Toolbar 设为 inert；非切换工具显式暂时 inert；
- Single Browser Slot 现有静态合同仍保持；本版不把它误写成 4.6 `destructive-v3` 等价实现；
- 原 seed/relation/stress/integration/performance/layout tests 继续运行。

## 2026-08-11 工作树正式测试

`npm run test:all`：**PASS**。

- run-tests：PASS（6176 seed entries；1240 relation components）
- static-tests：PASS（37 precache resources）
- runtime-symbol-tests：PASS
- runtime-behavior-tests：PASS
- stress-tests：PASS（125 entries；158 memberships；31 relation components）
- integration-tests：PASS（max Shortcut URL 8042 chars @ data）
- performance-tests：PASS（27.3ms / 25 searches；4.1ms relations；2818.1ms VIX preflight；仅作为本地回归门禁，不作为 iPhone 真机性能指标）
- layout-contract-check：PASS（402×874）

逐文件语法/格式复核：**PASS**。

- 25 个 JS/MJS：`node --check` 全部通过；
- 16 个 JSON/WebManifest：全部重新解析通过。

## 真机未可自动证明

- TOP + collapsed 的第一次可见帧是否在 iOS 26.5 compositor 上完全无旧新残影；
- 极端快速连点串行执行多个短 buffer 的感知延迟；
- View/Mode 混合快速输入在真机上的触感是否符合“按实际执行状态串行生效”；
- same-Collection target 是否在 120Hz 录屏中完全无二次位置修正；
- iOS WebKit 在 deep virtual layout 下是否仍有异常 boot/Home 反馈；
- Single Slot 导航模型相对 4.6 历史合同的产品取舍。

## 封装门禁

正式交付阶段在**最终 ZIP 外部交付摘要**记录并复核：

- ZIP integrity；
- fresh extract `sha256sum -c SHA256SUMS.txt`；
- fresh extract `npm run test:all`；
- ZIP SHA-256 与文件数量。

之所以不把最终 ZIP 自身 SHA-256 写回包内，是为了避免自引用导致每次写入哈希后 ZIP 内容再次变化。真机项目保持“待验收”，不得由自动测试代替。
