# Vocabulary Index 4.5.0 变更报告

4.5.0 从正式 4.4.0 完整源码工作树继续构建，不改变 Schema6 / DB5 / Seed4 / VIX2。

## Navigation

- `destructive-v2` → `destructive-v3`。
- 删除 generation/session navigation recovery；PWA runtime restart 直接从 Home 建新 root。
- frame 增加 `browserKey`，由 `navigation.currentEntry.key` 捕获。
- destination classifier 改为 key-based，不再读取 `NavigationDestination.getState()`。
- App Back 改为 `traverseTo(parentBrowserKey)`；Home 改为 `traverseTo(rootBrowserKey)`。
- Home 不再 PUSH 新 root；commit 后旧 frame 变 dead Forward。
- fresh PUSH 清 dead-key bookkeeping，并由浏览器自然截断 physical Forward branch。
- Navigation API 与 `popstate` 改为互斥 owner。
- identity mismatch 不再按 depth 猜 frame。
- runtime live slot 不再 `replaceState()`；仅 boot root 初始化保留一次。

## Page Identity / Interaction

- Collection 作为唯一 recursive frame。
- same Collection Search/Relation/PIN/Annotation/word-phrase target 不再 PUSH。
- Search 选择去除 `PRESENTATION_EXIT_MS` 后置 navigation，跨 Collection PUSH 留在 click activation。
- Home→Collection alphabet reset 使用同步 runtime hydrate，再后台持久化。
- 删除 orphaned 70ms `performPageTransition` 延迟，render 立即提交。
- Renderer 不再解析 root URL 后执行 destructive Home。
- Review renderer 不再自动创建跨 Collection navigation。

## Freeze

- 4.4 Flow-anchor Sticky、rendering suppression、Modal root geometry、whole-app stacking-context removal、PIN/Review/Popover 与视觉体系保持不变。
