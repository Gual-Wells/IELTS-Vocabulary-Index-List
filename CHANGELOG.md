# Changelog

## 2.0.2

- 修复进入任意词表时 `getExpandedGroups is not defined` 导致列表无法渲染的问题。
- 修复桌面宽屏仍显示移动端底部操作栏的问题。
- 更新 Service Worker 缓存版本，避免继续加载 2.0.1 的错误模块。

## 2.0.0 — 2026-07-31

- 从单文件原型完整重构为无构建 ES Modules 静态项目。
- 使用 IndexedDB 替代 `localStorage` 词库。
- 引入全局唯一词汇与来源词表模型。
- 实现词性合并、词表优先级和自动回落。
- 移除动态内联事件与字符串拼接事件处理器。
- 重写事务化 JSON/Markdown/CSV/TXT 导入。
- 增加持久撤销/重做、完整备份、Markdown/CSV 导出。
- 增加多书签、上次浏览位置和统一模糊搜索。
- 重写 Groq 中文搜索、AI 新增和只读 AI 核查。
- 增加响应式 iPhone/桌面布局、PWA、离线缓存和 CSP。
- 将七份上传词表生成全局去重的 5,005 词初始种子。
