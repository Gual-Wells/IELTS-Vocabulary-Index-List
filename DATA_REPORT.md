# Vocabulary Index 4.3.0 数据报告

> 4.3.0 未修改 Seed 内容、计数、来源、关系组件或数据模型；数据结论继承 4.0.0–4.2.0。

- Domain：3
- Collection：17
- Entry：6176（5539 word / 587 phrase / 50 content）
- Membership：7574
- RelationComponent：1240
- Backup Schema：6
- IndexedDB：5
- Seed revision：4
- VIX：2

4.3.0 的 `navigationStack/navigationEpoch/navToken/discardedNavigationTokens` 都只属于页面导航运行时/session，不写入 Seed/IndexedDB/VIX/Full Backup，也不属于数据 Undo/Redo History。Collection-level `viewModes[collectionId]` 仍是普通 Settings；旧 section-keyed mode 不做推断迁移。
