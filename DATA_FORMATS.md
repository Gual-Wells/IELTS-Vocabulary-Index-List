# Vocabulary Index 数据格式

> 4.4.0 runtime note：Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2 与 4.3.0 完全相同。本版只更新 Sticky/Navigation/Modal runtime ownership；Seed、完整备份和 VIX 内容交换格式无迁移。

## 1. Full Backup

完整备份继续包含 Domain、Collection、Entry、Membership、RelationComponent、PIN、Annotation、StudyStamp、Settings、Undo/Redo 所需状态。API Key 不写入 Seed/VIX 内容交换文件。

`schemaVersion` 必须为 6。4.4.0 可读取同一 Schema6 世代的完整备份；不同 schema 世代继续拒绝隐式导入。

## 2. VIX JSON

VIX format version 继续为 2。4.4 没有新增/删除任何 VIX 字段；Domain/Collection/Entry/Membership/RelationComponent 的身份与冲突规则全部沿用 4.0–4.3。

## 3. Seed

Built-in Seed revision 继续为 4。当前固定内容计数：3 Domain / 17 Collection / 6176 Entry / 7574 Membership / 1240 RelationComponent。

## 4. Runtime state 与内容格式分离

4.4 `destructive-v2` navigation generation/token、Sticky transaction、Modal presentation 都属于 runtime/session state，不进入 Seed/VIX 数据格式。Navigation session 在版本升级时可以安全重建 root，不影响业务数据。
