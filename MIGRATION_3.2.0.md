# Vocabulary Index 3.2.0 迁移说明

## 1. 数据库

3.1.1 → 3.2.0 不升级 IndexedDB：

- DB version 仍为 4；
- backup schemaVersion 仍为 4；
- builtInSeedRevision 仍为 3；
- Entry、Membership、PhraseToken、PIN、标注、学习日期和设置原样保留。

## 2. Seed

`data/seed.json` 只把 `appVersion` 更新为 `3.2.0`。业务数据与 3.1.1 一致。

## 3. App Shell

Service Worker 缓存更新为：

```text
gual-vocabulary-index-v3.2.0-ios-pwa-audit-20260802-1
```

升级桥会删除旧的 Vocabulary Index App Shell 缓存，但不操作 IndexedDB。

## 4. 视图状态

两行表项、首页字号、系统侧光和长列表分块均为渲染层变化，不新增持久字段。旧浏览位置继续有效。

## 5. 回滚

回滚到 3.1.1 不需要降级数据库，但 3.2.0 运行期间生成的普通备份仍建议保留。回滚后不会保留 3.2.0 的视觉和性能优化。
