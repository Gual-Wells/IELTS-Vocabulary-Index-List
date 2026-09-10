# Vocabulary Index 4.0.1 变更报告

4.0.1 仅收口 4.0.0 真机暴露的 UI/运行时问题，不改变内容世代。

## 主要变更

- 字母真实分组标题不再 sticky；新增单一 `sticky-letter-heading` 展示层。active section 使用 section metrics + 二分定位，ResizeObserver 在惰性块/展开高度变化后重测，避免滚动时扫描整页标题。
- `app-dialog` / action dialog 改为自有 retained modal host。父弹窗保留真实 DOM 并设为 inert；子弹窗独立叠层，关闭只移除顶层。Settings→管理词库、词表操作→设置等不再 snapshot/replace。
- modal card 两帧稳定后 reveal；backdrop 先出现，移除 4.0.0 的可见首帧闪现路径。
- Settings、管理词库和 action 卡片使用受限管理高度；body 自滚动。Settings 删除 Collins CORS、低级词关系等常驻解释段落。
- content Entry 新增 normal/two-line/extreme 布局，极长文本获得横向滚动能力。
- 一级 row 的繁体/来源 secondary line 从 60/68px 档收紧至约 54/64px 档，并继续共用 bottom metric。
- Query chooser 增加 Provider 副字并略左移；仅 Oxford/ChatGPT SVG 向现有 Collins/Groq 风格重绘。
- “关闭低级词汇关联” checkbox 使用产品绿色自绘状态，原生 checkbox 语义保留。
- 保留 `apple-mobile-web-app-status-bar-style=default`，由全屏 Modal Host + `viewport-fit=cover` 覆盖 safe-area，避免浅色常态页面因 `black-translucent` 引入状态栏前景反差风险。
- App/package/runtime 更新至 4.0.1；Service Worker 新建独立 cache generation。

## 未变更

数据模型、Seed 内容、Relation/Search 语义、VIX/Backup schema、底栏 58px、长按生命周期及其他既有图标不变。
