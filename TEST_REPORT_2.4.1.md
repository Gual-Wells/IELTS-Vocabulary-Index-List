# 2.4.1 测试报告

## 自动测试

- `npm test`：通过。
- 全部 JavaScript 与 Service Worker 语法检查：由测试脚本执行并通过。
- Store 集成测试确认 `dismissAnnotation()` 完成后内存状态立即为 `null`，排除 IndexedDB 提交后 Store 未更新。
- 静态回归断言确认 `annotations` 通知调用 `refreshRenderedAnnotationBadges()`。
- 静态回归断言确认取消标注使用删除前索引选择相邻审阅项。

## 尚需真机确认

在 iPhone Safari/PWA 中依次测试：

1. 打开包含多个标注的词表；
2. 进入审阅模式；
3. 取消首项、中间项和末项；
4. 确认对应词条的“待核查”徽标立即消失；
5. 确认审阅导航进入正确相邻项，且无需退出或重新进入词表。
