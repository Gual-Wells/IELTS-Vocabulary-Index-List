# Vocabulary Index 3.5.0 迁移说明

## 数据版本

- Backup Schema：5（不变）
- IndexedDB DB version：4（不变）
- Seed revision：3（不变）
- VIX version：1（不变）

3.5.0 不迁移 Entry、Membership、PIN、Annotation 或 StudyStamp。3.4.0 数据可直接打开。

## 设置兼容

普通词表的浏览模式开始按 `collectionId:viewKind` 保存。读取时继续兼容旧的 collection 级模式值；首次在词汇或短语视图切换模式后写入新键。

旧上次位置仍按 `collection + mode + section` 读取。词汇和短语视图继续使用 `word`／`phrase` section，不丢失 3.4.0 已保存位置。

## 运行时变化

旧的复合普通表页面状态不会原样恢复为双分区页面。进入普通词表时默认进入词汇视图；之后两个视图分别保存页面快照。

Service Worker 缓存升级为 3.5.0。若主屏幕 PWA 仍显示旧界面，应在更新提示中选择立即更新并重新打开。
