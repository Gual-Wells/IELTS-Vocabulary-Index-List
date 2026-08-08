# Vocabulary Index 4.0.2 iPhone PWA 部署与回滚

## 部署

1. 部署完整 4.0.2 文件树，不做局部覆盖。
2. 确认 `index.html` 按顺序加载 `css/v4.0.0.css`、`css/v4.0.1.css` 与最新 `css/v4.0.2.css`。
3. 确认 `manifest.webmanifest` 与 Apple Touch Icon 使用 `V` 图标。
4. 确认 Service Worker cache 名为 `gual-vocabulary-index-v4.0.2-runtime-convergence-20260808-1`。
5. 在 Safari 打开 Pages URL，刷新至 4.0.2，再从主屏幕 standalone 冷启动复核。

## 3.5.x → 4.0.2 首次启动

4.0 是内容世代硬断代。检测到旧 DB 时，启动页先允许下载 3.5.x 完整备份或明确不备份，再要求确认替换。替换会清除旧 Seed、用户自建内容、PIN、日期、Annotation、浏览状态与 Undo/Redo；Groq/Collins Key、模型选择和一般显示偏好不属于内容世代，继续保留。

## 旧文件

- VIX v1：不兼容。
- 旧 Full Backup Schema：不兼容。
- 3.5.x 备份用于回滚 3.5.x，而不是导入 4.0.2。

## 回滚

4.0.2 继承 4.0.0 的硬断代，不能用 Schema 6 数据直接回滚到 3.5.2。需要回滚时：

1. 恢复 3.5.2 完整源码；
2. 清理 4.0.2 PWA/站点数据；
3. 使用升级前导出的 3.5.x 完整备份在对应旧版本恢复。

## 真机部署检查

重点检查：4.0.1→4.0.2 无数据迁移；全局/域/普通 Collection 的 word/phrase/content 字母模式 Sticky 均位于字母栏下方且无镂空；日期 Sticky 不预留字母栏；日期刷新学习日期保持原视口；Query chooser 右边框完整、Oxford 闭合书本；retained Modal Stack、离线冷启动、长按、四态关系、外部 App 返回和 Collins/Groq CORS/Abort 均无回归。iOS 26.5.2 顶部系统带若仍不可动态着色，按平台限制记录。
