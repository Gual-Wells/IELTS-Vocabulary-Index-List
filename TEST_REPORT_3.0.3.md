# Vocabulary Index 3.0.3 测试报告

验证范围：功能回归、静态交互契约、600 步压力测试、性能回归契约、JavaScript 语法与 `checkJs`。

性能硬约束：

- 关系读取不得调用 `backupFromState()`；
- 搜索不得调用 `backupFromState()`；
- PIN 不得调用全量 `mutate()` 或 `buildProjection()`；
- 连续搜索输入必须合并；
- 25 次 5,005 条数据本地搜索需在测试阈值内完成。

真机浏览器响应仍以部署后的 iPhone 验收为最终依据。
