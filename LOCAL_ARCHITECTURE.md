# 3.0 本地架构

## 数据关系

```text
Domain
├── Collection (normal)
├── Collection (system-phrases, exactly one)
├── Entry (word | phrase)
│   ├── Membership -> normal Collection
│   ├── PhraseToken[] (phrase only, rebuildable)
│   ├── Pin? (at most one)
│   └── Annotation? (at most one)
└── Settings.lastPositions
```

### Entry

词项身份为：

```text
domainId + normalizedText
```

词性不参与身份。英文文本仅保存在 Entry。

### Membership

来源关系只保存：

```text
id, entryId, collectionId, sourceLabel, sourceOrder, createdAt, updatedAt
```

**不保存 `sourceText`。** 修改 Entry 文本时无需同步多份英文镜像，因此不会再次出现旧版“核心词形与来源词形不一致”的耦合缺陷。

### PhraseToken

从短语 Entry 文本确定性重建。反向关联使用精确 `normalizedToken`，不使用字符串包含。

## IndexedDB

数据库名称沿用 `gual-vocabulary-index`，版本提升为 3。3.0 新对象仓库统一使用 `v3` 前缀，旧对象仓库只在首次迁移时读取：

- `v3Domains`
- `v3Collections`
- `v3Entries`
- `v3Memberships`
- `v3PhraseTokens`
- `v3Pins`
- `v3Annotations`
- `v3Settings`
- `v3History`

首次迁移在一个 readwrite 事务中整体写入新仓库。普通写入、撤销和重做均在 IndexedDB 原生回调中直接排队，避免 Safari 在 Promise 间隙自动提交事务。

## 多实例

- `BroadcastChannel('gual-vocabulary-index-v3')` 广播修订号。
- 每次业务修改、完整恢复、撤销和重做均带 `expectedRevision`。
- 修订号不一致时安全中止，不静默覆盖。
- 上次位置使用单独的原子“读取—合并—写回”事务，不进入撤销历史，也不会用陈旧对象覆盖其他词表位置。
- IndexedDB `versionchange` 时主动关闭旧连接。

## PWA

- Service Worker 缓存命名空间：`gual-vocabulary-index-v3.0.0`。
- 导航使用 network-first，离线回退应用壳。
- HTML meta 版本与入口模块版本不一致时阻止启动，避免旧 HTML / 新 JS 混用。
