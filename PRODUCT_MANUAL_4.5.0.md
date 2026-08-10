# Vocabulary Index 4.5.0 使用手册

4.5.0 的主要变化是返回历史重新实现；词库、导入格式和 4.4 Sticky/Modal 使用方式不变。

- **进入词表**：从首页进入 Collection 会建立一个返回层。
- **同词表定位**：Search、Relation、PIN、Annotation 只要目标仍属于当前 Collection，就只定位/切换当前视图，不新增返回层。
- **返回**：左上 Back 或 iOS 左边缘手势返回逻辑上一层 Collection；离开的递归页在 commit 后失效。
- **首页**：第二层及以上出现 Home；点击后直接回原首页并清空递归页。旧页不能通过 Forward 恢复为 live VIX page。
- **视图切换**：word/phrase、alphabet/date 不新增 history。
- **重新启动 PWA**：从首页开始，不恢复上一次递归栈。

自动测试不能替代 iOS 系统手势验收；请按 `tests/IPHONE_REDUCED_TESTS_4.5.0.md` 做目标机检查。
