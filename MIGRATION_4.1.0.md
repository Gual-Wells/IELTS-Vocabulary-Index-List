# Vocabulary Index 4.1.0 迁移

4.0.2 → 4.1.0 **无数据迁移**。

- Backup Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

更新替换运行时/CSS/Service Worker/展示文案与 PWA identity。现有 IndexedDB、PIN、StudyStamp、Annotation、Settings、用户内容原样保留。

由于 Home Screen 安装名称与 Web App shell 元数据变化，正式真机验收建议在确认线上文件更新后删除旧主屏幕 PWA并重新“添加到主屏幕”，再验证 `Vocabulary Index` 名称及系统顶部行为。该重装步骤不等于数据迁移；执行前应按既有备份流程保护本地数据。
