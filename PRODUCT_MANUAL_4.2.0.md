# Vocabulary Index 4.2.0 使用手册

4.2.0 不改变数据格式，主要更新 iPhone PWA 的字母 Sticky、根导航、首页视觉和浮层。

- **字母浏览**：真实字母小标题直接使用浏览器原生 Sticky。展开组吸顶后会在所属字母列表结束时自然随列表底部退场；收起组不会持续悬浮。点击吸顶标题收起后，标题留在字母栏正下方。
- **日期浏览**：继续使用同一原生 Sticky 语义；刷新学习日期时当前视口保持不动。
- **返回**：左上 `←` 返回上一递归页面。递归深度达到 2 后旁边出现 Home；点 Home 会一次回首页并清除页面导航历史，不清任何词汇数据、PIN、学习日期、标注、设置或 Undo/Redo。
- **查询**：Oxford → Collins → Groq → ChatGPT。Query menu 从右侧动作区向左展开，与表项边框留出小间隙。Oxford 使用与另外三枚统一视觉尺度的新 closed-book outline。
- **首页**：Topbar `Vocabulary Index` 使用独立产品 wordmark；Hero 大字仍是“词汇索引”。“全局”与 Domain 标题同级，不再使用淡大矩形框，而以轻量 Index Rule 区分。切换图标在“管理”左侧。
- **非结构**：全局入口名称为“全局非结构总表”。
- **Modal**：页面/Topbar 变暗完全由真实 backdrop 完成；嵌套子弹窗使用自己的浅一层 backdrop。iOS 系统最顶部如果不属于 Web viewport，则不承诺随 Modal 动态变暗。
- **PWA 名称**：`Vocabulary Index`。
- **数据世代**：Schema 6 / DB 5 / Seed 4 / VIX 2；4.1.0 → 4.2.0 无迁移。

真机验收以 `tests/MANUAL_CHECKLIST.md` 为准。
