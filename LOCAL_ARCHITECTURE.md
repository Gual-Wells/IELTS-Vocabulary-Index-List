# Vocabulary Index 3.0.7 本地架构

## 模块

- `v3-upgrade.js`：旧应用壳缓存升级桥；
- `v3-app.js`：启动、版本一致性和 Service Worker；
- `v3-ui.js`：浏览、导航、管理、AI、设置和数据交换界面；
- `v3-store.js`：业务状态、索引、PIN、位置和跨实例同步；
- `v3-db.js`：IndexedDB Schema 3、迁移、内置 Seed 修订和原子写入；
- `v3-model.js`：实体、规范化、备份校验、投影和繁简处理；
- `v3-import.js`：旧列表格式和完整备份解析；
- `v3-exchange.js`：VIX JSON 规范化、内容导出、合并/替换计划和差异统计；
- `v3-data-worker.js`：在 Worker 中解析 JSON 并执行内容预检；
- `v3-ai.js`：Groq 模型目录、AI 新增和核查；
- `sw.js`：离线应用壳和用户确认式更新。

## 数据层

持久实体：Domain、Collection、Entry、Membership、PhraseToken、Pin、Annotation、Settings、History。

运行时派生：全局总表、全局短语表、词域总词表、词汇—短语关系索引、同形词索引。

`settings.contentSources` 保存内容来源目录；Groq API Key 仍位于 localStorage，不进入备份。

## 计算机术语分类

内置 Seed 修订 2 为 544 个普通词增加四个用户可见主分类 Membership。隐藏来源 Collection 的 Membership 继续保存，但 `buildProjection()` 明确排除隐藏 Collection，避免其抢占普通词表优先投影。

## 数据交换流水线

```text
文件文本 + 当前完整备份 + 面板目标
→ v3-data-worker.js
→ JSON.parse
→ normalizeVixPackage
→ planVixImport
→ 差异、冲突、下一份完整备份
→ UI 预览
→ 自动下载恢复备份
→ replaceWithBackup 单事务提交
```

内容导入不逐项修改 Store，也不逐词重绘。Worker 返回计划前不触碰 IndexedDB。

## VIX 与完整备份

- VIX JSON：内容交换，可按全局、独立域或词表执行 merge / replace；
- Schema 3 完整备份：精确恢复内容和个人状态。

总表和 PhraseToken 不由外部文件直接维护：总表运行时派生，PhraseToken 根据短语文本重建。

## PWA 更新

活动 Worker 始终从同代缓存提供 App Shell。新 Worker 安装完成后保持 waiting，用户确认后发送 `SKIP_WAITING`，随后重新载入一次。

## Seed 还原路径

`v3-ui.js → v3-store.js/resetToSeed → v3-db.js/replaceWithCanonicalSeed → data/seed.json`。读取后复用完整恢复事务，一次替换业务表和设置表，并清空历史表。
