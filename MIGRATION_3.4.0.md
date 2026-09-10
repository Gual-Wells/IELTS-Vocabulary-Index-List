# Vocabulary Index 3.4.0 迁移说明

## 迁移摘要

- 应用版本：3.3.1 → 3.4.0
- Backup schema：4 → 5
- IndexedDB 数据库版本：保持 4
- Seed revision：保持 3
- VIX format/version：保持 `vix-json` / 1
- Seed 业务内容：不变

## 1. 自动升级入口

3.4.0 启动时会读取现有 IndexedDB 数据并交给统一迁移器。Schema 3、4 和 5 均可被读取；最终状态规范化为 Schema 5。

迁移过程不会因为系统总表模型变化而创建新的词汇或短语 Entry。全局和域内系统总表由现有 Entry 与 Membership 动态投影生成。

## 2. StudyStamp 从共享词形日期迁移到具体 Entry

### Schema 5 规范

每条学习日期必须绑定具体 Entry：

```json
{
  "scope": "entry",
  "key": "entry:<entryId>",
  "entryId": "<entryId>",
  "reviewDate": "YYYY-MM-DD",
  "reviewedAt": "ISO timestamp"
}
```

### 旧 Entry 日期

旧备份中已明确绑定 Entry 的日期直接保留并规范化。

### 旧全局词形日期

旧版可能存在按 `kind + normalizedText` 共享的全局日期。3.4.0 不会把这条日期复制给所有跨域同形 Entry。

迁移规则：

1. 找到迁移前域顺序下旧全局总表会采用的代表 Entry；
2. 将旧日期迁移到该具体 Entry；
3. 其他跨域同形 Entry 保持未标注；
4. 迁移报告记录存在多个候选的词形，便于人工复核。

这一规则保守地复现旧界面当时实际操作的对象，避免把一个旧学习行为扩散成多个不同语义个体的日期。

## 3. 日期冲突合并

重命名或导入可能使两条具体 Entry 日期需要合并。处理顺序：

1. 保留 `reviewDate` 较晚者；
2. 日期相同，保留 `reviewedAt` 较晚者；
3. 仍相同，保留 revision 较高者；
4. 不弹出人工选择窗口。

## 4. PIN 与 Annotation

PIN 和 Annotation 本来即绑定具体 Entry。3.4.0 只修正投影视图和归一化行为：

- 不再把全局 PIN 或位置自动重映射到另一个同形代表 Entry；
- 系统总表直接显示具体 Entry 的现有 PIN 和 Annotation；
- 调整独立域顺序不修改这些状态。

## 5. 全局总表变化

Schema 4 的全局总表通常只显示跨域同形组中的一个代表 Entry。Schema 5 运行时投影会显示组内所有具体 Entry。

这不会增加备份中的 Entry 数量；只是原本已存在的 Entry 现在都可在全局入口中看到。

页面总数仍按唯一规范文本组显示，因此页面实际渲染行数可能大于标题中的总数。

## 6. 位置与设置

- 合法的具体 Entry 上次位置继续保留；
- 若上次位置 Entry 已被删除或不再属于该投影，则该位置被清除；
- 不再使用同形代表 Entry 替代失效位置；
- 视图模式、日历月份和编号模式继续保留；
- “字母内编号”设置语义升级为“小标题内编号”，存储值无需更改。

## 7. 回滚限制

3.4.0 的 Schema 5 备份不能直接恢复到只理解 Schema 4 的 3.3.1。需要回滚时，应使用升级前下载的 3.3.1 完整备份。

不要通过手工删除 `schemaVersion` 或修改 JSON 版本号伪装降级，这会破坏 StudyStamp 语义。

## 8. 推荐升级流程

1. 在 3.3.1 中导出一份完整备份；
2. 部署完整 3.4.0 包；
3. 从主屏幕完全关闭旧实例并重新启动；
4. 等待自动迁移完成；
5. 检查跨域同形词、PIN、Annotation 和学习日期；
6. 导出一份新的 Schema 5 完整备份；
7. 按 `tests/MANUAL_CHECKLIST.md` 完成真机验收。
