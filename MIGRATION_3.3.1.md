# Vocabulary Index 3.3.1 迁移说明

## 1. 数据库

3.3.0 → 3.3.1 不升级 IndexedDB：

- Schema：4；
- DB version：4；
- Seed revision：3。

Domain、Collection、Entry、Membership、PhraseToken、PIN、Annotation、StudyStamp、设置和位置直接继续使用。

## 2. Seed

`data/seed.json` 仅将 `appVersion` 更新为 `3.3.1`。删除 `appVersion` 后，与 3.3.0 Seed 完全一致，规范化 SHA-256：

```text
c223f2f363a60b9580ad9e95dbafb57525570924a56a653c0707a75dec2fe5c8
```

## 3. 运行时软引用修复

首次正常 Store 规范化或后续 mutation 时会：

- 清理失效的 Entry／Global StudyStamp；
- 重映射全局 PIN 和全局上次位置代表 Entry；
- 清理失效 ViewMode、CalendarMonth 和 LastPosition；
- 不修改仍然有效的个人学习状态。

## 4. Service Worker

新缓存：

```text
gual-vocabulary-index-v3.3.1-ios-shell-20260802-2
```

升级桥只替换 App Shell，不清理 IndexedDB。

## 5. 更新步骤

1. 部署完整 3.3.1 目录；
2. 等待更新提示并选择立即更新，或完全关闭主屏幕应用后重开；
3. 在设置中确认版本 3.3.1；
4. 按人工清单验证全局上次位置、序号、关系、标注和弹窗；
5. 不要清除 Safari 网站数据。

## 6. 回滚

3.3.1 与 3.3.0 使用同一数据库版本，可以静态文件回滚。回滚前建议导出完整备份；旧前端不会包含本版软引用和状态机修复。
