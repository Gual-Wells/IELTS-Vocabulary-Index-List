# Vocabulary Index 4.1.0 UX 规格

- Home topbar：`Vocabulary Index`；Home large title：`词汇索引`。
- Home 全局区：左为“上行向右 / 下行向左”的平行切换图标，右为“管理”。切换图标在两种状态使用同一形状，aria-label 表达目标状态。
- PWA Home Screen 名称：`Vocabulary Index`。
- “全局非结构总表”是全局 content projection 的显示名称。
- Alphabet cell：每个按钮有 top/right/bottom；A/首格有 left。disabled 不改变任何结构线。
- Alphabet sticky：字母栏未吸顶不展示；吸顶后紧贴字母栏下缘，背景不透明，不漏出滚动内容。
- Date sticky：无字母栏时直接贴主 Chrome；与 alphabet heading 使用一致的边界语言。
- Study date refresh：更新后 viewport 不移动。
- Query chooser：右侧至少保留设计 edge inset；Oxford 图标严格沿用参考图构型重绘。
- Entry metadata：繁体与来源保持同 Y，主行/副行间距进一步收紧，触控面积不变。
- Modal shell：depth 1 对应 48% backdrop 合成，depth≥2 每层继续叠 20%；topbar/root/theme-color 使用同一个最终 surface，custom backdrop 从 topbar 下方开始。
