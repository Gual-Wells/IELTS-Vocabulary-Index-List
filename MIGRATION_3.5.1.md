# Vocabulary Index 3.5.1 迁移说明

## 数据迁移

无。

- Backup Schema：5（不变）
- IndexedDB version：4（不变）
- Seed revision：3（不变）
- VIX version：1（不变）

3.5.0 数据库可直接由 3.5.1 打开。Entry、Membership、PIN、AI 标注、学习日期、繁体释义、浏览模式和页面状态均不进行批量改写。

## 缓存升级

3.5.1 使用独立 Service Worker Cache 名称：

```text
v3.5.1-clean-rebuild-20260803-1
```

安装后应等待更新提示并重新启动 standalone PWA，避免旧页面继续持有 3.5.0 资源。

## 错版警告

此前两份 3.5.1 ZIP 已废弃。不要：

- 从其源码继续修改；
- 将其 JS/CSS 文件覆盖到本版；
- 依据其 SHA256 或生命周期文档判断当前版本。

从错版返回时，优先安装本清洁重建包。由于 Schema 未变，不需要导出后清库；但正式升级前仍建议保留完整备份。
