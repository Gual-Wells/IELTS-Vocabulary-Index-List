# Seed4 → Seed5 迁移合同

数据库 Schema 为 6 且 `builtInSeedRevision < 5` 时执行三方迁移；新安装直接写 Seed5。

1. Seed4 是公共祖先，当前 IndexedDB 是用户分支，Seed5 是产品分支。
2. 内置字段仍等于 Seed4 时采用 Seed5；用户改过则保留当前值。
3. 用户删除保持删除；Seed5 真正新增的记录正常加入。
4. 用户新增域、词表、词条、Membership 全部保留。
5. PIN、Annotation、StudyStamp 与有效 LastPosition 强制保留可见依赖。
6. 语义相同的旧/新集合和词条在设备上沿用旧 ID。
7. Seed5 退休记录仅在当前未改且无用户引用时删除。

迁移前把当前快照写入独立 IndexedDB `vix-seed-migration-backups-v1`，状态先为 `pending`。主库在单个 readwrite transaction 中提交；失败自动回滚并把备份记为 `rolled-back`，成功后记为 `committed` 并设置 Seed revision 5。

Undo/Redo 历史在 Seed 大版本迁移后清零，避免旧历史引用已重排的内置数据；内容与用户状态不会因此丢失。

alpha.2 没有自动降级迁移。回到 4.7.3 前应导出当前 Schema6 备份并在隔离副本验证。

