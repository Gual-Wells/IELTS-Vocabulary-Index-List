# Vocabulary Index 4.4.0 迁移

4.3.0 → 4.4.0 **无业务数据库 schema 迁移**。

- Backup Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

## 保留

Entry、Domain、Collection、Membership、RelationComponent、PIN、StudyStamp、Annotation、Settings/API Key、用户内容、手动浏览锚点、数据 Undo/Redo 原样保留。

## 有意重置的运行时状态

### Navigation generation

4.4.0 使用 `destructive-v2` 与新的 session key。4.3 `destructive-v1` navigation stack/token 不迁移；首次进入 4.4 建立干净 root generation。只影响页面递归历史，不影响业务数据库。

### Sticky transaction

无持久数据迁移。旧 section expanded 状态若通过当前 session 恢复，仍使用相同 expanded set；收起算法由 flow anchor/新 transaction 接管。

## PWA shell/cache

Service Worker cache generation 升级为 `v4.4.0-runtime-correctness-20260810-1`。部署必须完整覆盖文件树并等待新 SW 生效。
