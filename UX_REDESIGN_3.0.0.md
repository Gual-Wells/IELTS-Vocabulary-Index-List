# Vocabulary Index 3.0.0 交互重建设计报告

日期：2026-08-01  
交付阶段：Release Candidate 2

## 1. 目标与边界

本轮不回退 3.0 的数据模型，也不取消 3.0 的米色纸张背景、墨绿色主色、Georgia 标题与卡片语言。重建范围严格限定在：

- `index.html` 的交互容器；
- `css/v3.css` 的响应式布局和控件层级；
- `js/v3-ui.js` 的任务流与呈现逻辑；
- UI 静态契约与人工验收清单。

以下模块保持原架构：

- Domain / Collection / Entry / Membership / PhraseToken；
- IndexedDB schema 3 与跨实例修订号保护；
- 2.4.1 数据迁移；
- 搜索、导入、导出、撤销、重做和 Groq 任务控制。

## 2. 2.4.1 与原 3.0.0 的源码级调查

### 2.1 2.4.1 的有效模式

2.4.1 并非视觉上更先进，但它有几个经过实际任务约束的可靠模式：

1. **PIN 是独立 sticky 上下文条**：位于顶栏下方；跳到长列表中部后仍可操作前后 PIN。
2. **iPhone 有固定底部操作栏**：搜索、新增、AI 新增、AI 核查和更多始终可达。
3. **词条主行只承担内容与一个更多入口**：低频动作不占据每一行。
4. **标注审阅同时提供上一条与下一条**。
5. **移动端具有专门的 `max-width` 响应式规则**，不是依赖桌面按钮自动换行。

### 2.2 原 3.0.0 的问题根源

原 3.0.0 将内部数据模型和全部新增能力直接暴露给界面：

- 词表顶部一次显示 10 个近似同级动作；
- PIN 前后跳转位于会滚出视口的顶部工具卡；
- 每条词项永久保留 PIN、标注和详情三个尾部槽位；
- 无标注时仍保留一个空的禁用按钮；
- 点击详情会重建整个词表；
- 首页强制暴露词域、系统短语表和重复的新建入口；
- 响应式规则主要处理宽屏，缺少 iPhone 的独立任务布局；
- AI 审阅只有单方向箭头；
- 固定任务面板和审阅条可能争夺同一底部区域。

这不是单纯的 CSS 密度问题，而是“数据实体直接映射为交互实体”造成的信息架构泄漏。

## 3. 外部设计依据

本轮采用以下平台与无障碍约束：

- Apple Designing for iOS：优先突出主要任务，限制屏幕上的控件数量；高频操作更适合位于屏幕中部或底部。
  - https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Apple Accessibility / Buttons：iOS 高频触控目标采用约 44×44 pt 的命中区域，并保留明确按压反馈。
  - https://developer.apple.com/design/human-interface-guidelines/accessibility
  - https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple Toolbars：工具栏用于作用于当前内容的操作；次级命令可进入 More 菜单。
  - https://developer.apple.com/design/human-interface-guidelines/toolbars
- Apple Sheets / Action sheets：与当前上下文密切相关的详情和动作应在限定范围内完成，而不是持续污染主内容。
  - https://developer.apple.com/design/human-interface-guidelines/sheets
  - https://developer.apple.com/design/human-interface-guidelines/action-sheets
- WCAG 2.2：触控目标、可见焦点和焦点不被覆盖。
  - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-visible
  - https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum

这些依据用于约束交互，而不是把网页伪装成原生 iOS 控件。

## 4. 新交互架构

### 4.1 首页：自适应扁平化

- 只有一个词域时，首页直接展示词表，不强迫用户重复阅读“词域”层级。
- 多词域时恢复分区展示，保留词域隔离能力。
- 系统短语表在用户界面显示为“短语”，实现概念“系统”不再成为主标签。
- 新建词域、管理词域、管理词表统一进入“管理词库”Sheet。
- 全局搜索常驻首页。
- 完整备份与恢复重新回到首页底部的数据安全区。

### 4.2 词表页：内容优先、动作常驻

- 顶部介绍卡只显示词表信息和待核查状态，不再承担 PIN、撤销和全部维护动作。
- 桌面端保留五个高价值动作：搜索、新增、AI 新增、AI 核查、更多。
- iPhone 使用固定底部工具栏提供相同五项任务。
- 撤销与重做进入 sticky 顶栏；iPhone 中搜索由底部工具栏承担，避免顶栏过载。
- 导入、导出、跳到上次位置和词表管理进入“更多”。

### 4.3 PIN：独立持续上下文

PIN 使用独立 sticky 导航条：

```text
‹  PIN · access
   点击重新定位当前 PIN       2/12  ›
```

行为约束：

- PIN 条停靠在顶栏下方；
- 字母导航自动停靠在 PIN 条下方；
- 前后按钮直接跳到相邻 PIN，而不是只改变选择；
- 中间按钮重新定位当前 PIN；
- 跨词表和路由跳转后同步当前 PIN 索引；
- 无 PIN 时整条隐藏，不留下空白。

这直接解决“跳转后已离开顶部，无法继续按 PIN 前后”的问题。

### 4.4 词条行：稳定且低噪声

主行只保留：

- 英文与可选繁体释义；
- 条件式 PIN 状态标签；
- 条件式“待核查”按钮；
- 一个详情与更多按钮。

不再显示空的标注按钮，也不再用三个等权图标压缩词汇内容。

### 4.5 词条详情 Sheet

词表来源、相关短语、组成词、PIN、编辑、来源移除和彻底删除进入详情 Sheet。详情不再通过整表重绘式内联展开实现，因此不会因点击详情重建字母目录和整张词表。

### 4.6 AI 标注与任务层级

- 审阅条同时提供上一条和下一条；
- 编辑、取消标注和退出保持直接可达；
- iPhone 上审阅条位于底部操作栏上方；
- AI 任务面板在审阅条上方继续偏移，避免两个固定面板覆盖；
- 页面底部留白根据当前工具栏和审阅状态动态计算。

## 5. 视觉与可访问性

保留的 3.0 美学：

- `#f5f1e8` 米色背景；
- `#2e5b4b` 墨绿色强调色；
- Georgia 用于标题、计数和索引气质；
- 圆角纸张卡片和低强度阴影。

新增的可靠性约束：

- 高频按钮使用 44px 级命中区域；
- 所有自定义控件具有 `:focus-visible`；
- 按压态不只依赖颜色变化；
- 支持 340、390、719、720、1000px 等关键断点；
- 尊重 safe-area 和 `prefers-reduced-motion`；
- sticky 元素的层级和偏移通过 CSS 变量统一管理。

## 6. 验证

自动验证包括：

- 数据与迁移测试；
- UI ID、CSP、模块、Service Worker 和 Manifest 契约；
- PIN sticky、字母导航避让、移动底栏、44px 目标、可见焦点、上一条/下一条审阅等新增 UX 静态断言；
- JavaScript `checkJs`；
- 600 步确定性压力测试；
- 使用实际 CSS 在 390×844 与 1280×900 代表性结构上进行静态渲染检查。

受受管 Chromium 策略影响，真实站点 URL 与 `file:` URL均被管理员策略阻止，因此未声称完成真实浏览器端到端操作。真机门槛见 `tests/MANUAL_CHECKLIST.md`。
