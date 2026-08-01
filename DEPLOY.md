# Vocabulary Index 3.0.4 部署与回滚

## 1. 部署前

1. 在当前线上版本导出完整 JSON；
2. 单独保留旧源码 ZIP 和 2.4.1 JSON；
3. 关闭该 Pages 地址的其他 Safari 标签页和主屏幕 PWA；
4. 核对完整 ZIP 的 SHA-256；
5. 将 ZIP 解压到临时目录，确认 `index.html` 位于解压根目录。

## 2. GitHub Desktop 完整替换

1. 当前分支切到 `main`；
2. 确认没有正在进行的 merge；
3. 打开本地仓库目录；
4. 保留隐藏的 `.git`，删除其余旧项目文件；
5. 将完整 ZIP 根目录中的全部内容复制到仓库根目录；
6. GitHub Desktop 中检查 Added / Modified / Deleted；
7. 提交：`Replace repository with Vocabulary Index 3.0.4 full source`；
8. Push origin。

不要合并旧的 `agent/vocabulary-index-3.0.0-rc` 或其他覆盖分支。

## 3. 发布后

1. 等待 GitHub Pages 部署完成；
2. 首次打开时，3.0.4 升级引导可能自动刷新一次，以清除旧应用壳缓存；该过程不删除 IndexedDB；
3. Safari 打开 Pages 地址；
4. 看到更新提示后点击“立即更新”；
5. 完全关闭并重新打开主屏幕 PWA；
6. 检查设置中的版本为 `3.0.4`；
7. 按 `tests/MANUAL_CHECKLIST.md` 验收；
8. 验收通过后导出新的 3.0.4 完整 JSON。

## 4. 从 2.4.1 迁移

首次运行会在单个 IndexedDB 升级流程中迁移旧数据。迁移后：

- 旧分类变为普通词表；
- 建立默认词域；
- 每个词域建立系统短语表；
- 同形词按词域合并；
- 词性变为 Membership `sourceLabel`；
- PIN、标注、序号和上次位置映射到新 ID。

迁移前后的 JSON 都应保留。

## 5. 回滚

代码回滚不能自动把 Schema 3 数据降级成 2.4.1 数据结构。需要回滚时：

1. 保留当前 3.0 完整 JSON；
2. 部署旧版完整源码；
3. 使用升级前保存的 2.4.1 JSON 恢复；
4. 不要尝试把 3.0 JSON直接导入 2.4.1。

## 6. 缓存处理

正常更新通过顶部更新提示完成。只有在已经导出完整备份、确认 Pages 文件正确且更新提示长期失效时，才考虑清理对应网站数据。清理网站数据会删除 IndexedDB、API Key 和模型设置。
