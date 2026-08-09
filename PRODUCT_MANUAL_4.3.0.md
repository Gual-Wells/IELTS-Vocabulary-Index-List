# Vocabulary Index 4.3.0 使用手册

4.3.0 不改变词库数据格式，主要改变 iPhone PWA 的 Sticky 收起、word/phrase 模式、返回栈和弹出层运行方式。

- **字母/日期模式**：同一 Collection 的词汇和短语共享 alphabet/date。切词汇/短语不会意外切回另一排序模式；各自浏览位置、展开组和日历月份仍独立。
- **Sticky 收起**：字母和日期都继续使用真实 native Sticky。收起使用统一事务，字母模式自动以字母栏下缘为边界，日期模式以 Top Chrome 下缘为边界。
- **返回**：`←` 或 iPhone 合法返回手势返回上一递归页面，并销毁刚离开的递归状态；不提供 Forward 恢复刚被返回掉的页面。
- **Home**：任何路径到 Home 都清空递归栈。Home 不删除 PIN、学习日期、标注、设置、API Key、浏览锚点或数据 Undo/Redo。
- **非法 Forward 手势**：应用常驻安全底色层，并在 standalone 下用 edge guard + Navigation API + dead token 三层防护。该手势的最终系统 preview 行为仍必须以 iOS 26.5.2 真机验收为准。
- **Query/Relation**：继续是轻浮层，使用统一柔和出现/退出生命周期；Query 的 4.2 定位、Provider 顺序和图标不变。
- **Modal**：Settings、管理、Search、Confirm 等统一进入 retained Modal Stack。父弹窗在子弹窗下面真实保留；背景由 48%/20% backdrop 自然叠加。打开/关闭不再把 body 改成 fixed。
- **PIN/Review**：继续是底部 context dock。PIN 不再为了按钮状态重建整个一级词条；Dock DOM 常驻并柔和 reveal/exit。
- **系统顶部**：Web 可绘制区域由 backdrop 变暗；iOS viewport 外 system strip 不承诺动态同步。
- **数据世代**：Schema6 / DB5 / Seed4 / VIX2。

真机验收以 `tests/MANUAL_CHECKLIST.md` 与 `tests/IPHONE_REDUCED_TESTS_4.3.0.md` 为准。
