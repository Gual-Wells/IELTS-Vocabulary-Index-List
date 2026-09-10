# Vocabulary Index 4.0.0 UX 规格

## Home

任何方式进入 Home，全局区默认结构化状态：全局词汇 + 全局短语。显式切换后显示全局非结构内容；该开关不持久化。

## Collection fresh entry

从 Home 进入：alphabet、top、all collapsed。structured Collection 有 word 时优先 word；只有 phrase 时 phrase；nonStructured 为 content。历史页面状态不得覆盖 fresh entry。

## Row

一级表项维持左右独立信息/控件布局。独立域来源仍位于右侧下部，但其 secondary-line Y/baseline 使用与繁体中文释义相同的布局判定，不采用独立绝对 bottom 逻辑。

## Toolbar

底部五项结构保持。58px 是当前真机合适视觉高度；nonStructured 保留结构但 word/phrase switch 灰度禁用。无独立 Home Indicator 白带。

## Relations

有效目标 1 个时分别显示域内、域外、非结构三类图标；>=2 显示多目标。多目标菜单可同时包含三种来源，不做同域优先过滤。

## Search

所有入口使用同一 Scope 系统，入口只改变默认值。普通 Collection 搜整个当前有效可见投影，而不是只搜当前 word/phrase view。结果保留跨域具体 Entry。

## Dialog

全为居中卡片；不同任务决定面积；保留现有圆角。Backdrop 覆盖屏幕，卡片不做全屏 shell。不使用出现位移动画；键盘/VisualViewport 真变化才重新计算。

## Longpress / Selection

普通 UI 文本不可系统长按选择。长按浏览锚点 520ms 成立即保存，release 后显示反馈；350ms invisible grace 阻止迟到 click/select/contextmenu/callout。input/textarea/contenteditable 恢复原生选择。

## Query

Oxford → Collins → Groq → ChatGPT，四个入口位置稳定。Provider 查询不更新学习日期/PIN，不改变浏览模式；关闭结果页后旧异步响应不得再更新界面。
