# Vocabulary Index 4.5.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.5.0 不改变 4.0 内容世代，也不重新设计 4.4 已通过真机验证的 Sticky / Modal；本版专门重建 4.4.0 失败的递归导航系统。

## 当前世代

- App：`4.5.0`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX exchange：`2`
- Navigation：`destructive-v3`（VIX logical stack + browser rail key）

## 4.5.0 Navigation Rail

- Collection 是唯一递归 page/frame；word/phrase、alphabet/date、calendar、展开组、搜索/关系/PIN定位都属于当前 frame presentation state，不创建 browser history。
- VIX `token` 是逻辑 frame identity；`NavigationHistoryEntry.key` 是 Safari browser rail slot identity；不再用 depth、URL、`history.state` 或 `NavigationHistoryEntry.getState()` 猜身份。
- 真正跨 Collection 的 PUSH 在用户操作同步调用栈内立即执行 `history.pushState()`，随后读取 UA 当前 entry key；不得先 await IndexedDB、Modal exit 或 70ms page timer。
- App Back 使用 `navigation.traverseTo(parent.browserKey)`；Home 使用 `traverseTo(rootBrowserKey)`。只有 traversal commit 后才 destructive POP/CLEAR。
- Home 不再 PUSH `ROOT2`；回到原 root 后，旧递归页成为 dead Forward，下一次 fresh PUSH 由浏览器自然截断该 Forward branch。
- 支持 Navigation API 时仅 `navigate` 是 traversal owner；`popstate` 只存在于无 Navigation API fallback，不再通过 timeout/token 对两个 owner 消重。
- runtime 仅在启动建立 root 时允许一次 `replaceState()`，捕获 root key 后不再 rewrite live rail slot，规避 Safari 26.x 已知 traversal-key 风险。
- 删除 4.4 遗留 70ms page transition timer；跨 Collection render 立即提交。

## 4.4 真机结果在 4.5 中冻结

- Sticky 长位移收起：真机不再闪白，累计漂移消失。
- retained Modal：打开/关闭不再破坏背景 Sticky。
- 4.4 撤掉 whole-app stacking context 后出现的更厚重/稳定视觉质感不回滚；4.5 不新增视觉调参。

## 当前文档

- `REQUIREMENT_BASELINE_4.5.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.5.0.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.5.0.md`
- `PRODUCT_MANUAL_4.5.0.md`
- `AUDIT_REPORT_4.5.0.md`
- `TECHNICAL_RESEARCH_4.5.0.md`
- `CHANGE_REPORT_4.5.0.md`
- `TEST_REPORT_4.5.0.md`
- `MIGRATION_4.5.0.md`
- `tests/IPHONE_REDUCED_TESTS_4.5.0.md`

历史版本文档保留为生命周期事实；当前实现与约束以 4.5.0 文件为准。
