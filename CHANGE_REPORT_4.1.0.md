# Vocabulary Index 4.1.0 变更报告

4.1.0 不改变数据世代，集中完成 4.0.2 真机未闭环问题和本轮确认的首页/图标/系统壳视觉需求。

- 顶部几何：移除 `visualViewport.offsetTop + 72` 强制下限；Top Chrome 以连续可见 DOM rect 为唯一真值。字母 Sticky 仅在字母栏真正吸顶后启用。
- 字母栏：重构为 cell-owned border；每格 top/right/bottom，首格 left；empty/disabled 仅灰文字，不再灰结构线。
- 字母 Sticky：补齐结构 heading 边界，保持不透明；与日期模式共享同一顶部几何模型。
- 日期 StudyStamp：继续原位刷新，不恢复旧 `study-date` target jump。
- Query chooser：使用 22px viewport edge inset；Oxford 按用户参考图重新绘制“合上的书”SVG；其余 Provider 造型不擅自重画。
- 一级 Entry：secondary line padding 15→10、bottom 4→2，并同步压缩 metadata row min-height；繁体与来源继续同 Y。
- Home：切换控件改为“上→ / 下←”平行反向箭头图标并置于管理按钮左侧；大字“词汇索引”保留，topbar 改 `Vocabulary Index`。
- PWA identity：Apple Home Screen title、manifest name/short_name 统一为 `Vocabulary Index`。
- 文案：`全局非结构内容` → `全局非结构总表`，只改运行时展示名。
- Modal shell：用 48% + 后续 20% retained backdrop 深度实时做 alpha compositing；theme-color、root shell、topbar/safe-top 同步一个结果；custom backdrop 从 topbar 底边以下开始，避免双重合成。
- 新增 `css/v4.1.0.css`；Service Worker cache generation 升级到 4.1.0。
