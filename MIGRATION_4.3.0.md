# Vocabulary Index 4.3.0 迁移

4.2.0 → 4.3.0 **无业务数据库 schema 迁移**。

- Backup Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

## 保留

Entry、Domain、Collection、Membership、PIN、StudyStamp、Annotation、API Key、用户内容、手动浏览锚点、数据 Undo/Redo 原样保留。

## 有意不迁移的运行时状态

### 1. 旧 viewModes section key

4.3.0 只读取 `viewModes[collectionId]`。旧 `viewModes[collectionId:word|phrase|content]` 不用于推断新 Collection mode；用户明确不要求这种旧状态兼容。

### 2. 4.2 navigation history/session

4.3.0 使用 `destructive-v1` navigation model。无法验证的新模型 token/session 不从 4.2 pageSnapshot 猜测恢复，直接建立干净 Home root。该行为只重置页面导航状态，不清业务数据库。

## PWA shell/cache

Service Worker cache generation 升级到 4.3.0。若进行主屏幕 shell/gesture 真机验收，应按既有备份流程确保数据安全后使用最新安装态验证；这不是数据 schema 迁移要求。
