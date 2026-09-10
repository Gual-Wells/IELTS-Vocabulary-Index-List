# Vocabulary Index 4.2.0 迁移

4.1.0 → 4.2.0 **无数据迁移**。

- Backup Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

更新内容仅涉及 runtime/CSS/Service Worker/生命周期文档。现有 Entry、Membership、PIN、StudyStamp、Annotation、Settings、用户内容原样保留。

`navigationEpoch` 只用于浏览器页面导航历史失效，不写入业务数据库，也不是 Undo/Redo 数据历史。

PWA 安装名称仍为 `Vocabulary Index`，本版不要求为了数据迁移重新安装；若需验证 Home Screen shell/cache，可按既有备份流程后重新添加到主屏幕。
