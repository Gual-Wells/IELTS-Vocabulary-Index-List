# Vocabulary Index 3.3.0 迁移说明

## 1. 数据库

3.2.0 → 3.3.0 不升级 IndexedDB：

- Schema：4；
- DB version：4；
- Seed revision：3。

原有 Domain、Collection、Entry、Membership、PhraseToken、PIN、Annotation、StudyStamp、设置和位置可直接继续使用。

## 2. Seed

`data/seed.json` 仅将 `appVersion` 更新为 `3.3.0`。排除该元数据字段后，与 3.2.0 Seed 的规范化 SHA-256 完全一致：

```text
c223f2f363a60b9580ad9e95dbafb57525570924a56a653c0707a75dec2fe5c8
```

## 3. Service Worker

新缓存：

```text
gual-vocabulary-index-v3.3.0-ios-shell-20260802-1
```

升级桥会删除旧 App Shell 缓存并重新加载，不清理 IndexedDB。

## 4. 首次打开

1. 部署完整 3.3.0 目录；
2. 等待更新提示；
3. 选择立即更新或完全关闭主屏幕应用后重开；
4. 检查设置中的版本号；
5. 不要清除 Safari 网站数据。

## 5. 回滚

3.3.0 与 3.2.0 使用相同数据库版本，因此可以静态文件回滚。但回滚前仍应导出完整备份；3.3.0 的新视觉和滚动行为不会在旧前端中保留。
