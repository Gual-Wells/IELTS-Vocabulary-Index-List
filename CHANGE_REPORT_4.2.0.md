# Vocabulary Index 4.2.0 变更报告

4.2.0 以 4.1.0 完整源码为冻结基线，不改变数据世代。

- Alphabet Sticky：删除独立 mirror DOM/renderer，恢复真实 `.letter-heading` native sticky；JS metrics 只负责 active letter。由浏览器恢复 collapsed 自然退出、section-bottom push-off、真实点击锚点和 parent side rails。
- Sticky collapse：继续使用与 Date 相同的 `toggle*WithAnchor + overflow-anchor` 补偿，点吸顶字母标题收起后真实标题保持在字母栏下缘。
- Query chooser：从“按钮中心+固定左偏”改为 relation multi-target 风格的右缘挂接，再左退 10px；viewport inset 12px，垂直 gap 13px。
- Oxford：重新设计紧凑 closed-book outline，缩小 optical bounds，与 Collins/Groq/ChatGPT 视觉面积一致。
- Modal/PWA：撤销 4.1.0 System Shell Surface Controller；不再动态写 theme-color/root/topbar。custom/natively top-layer backdrop 恢复 full Web viewport；嵌套层继续 48%/20% 真 alpha 叠加。
- Home wordmark：Topbar `Vocabulary Index` 使用独立 serif 产品字标；Hero 大字“词汇索引”和 eyebrow 不变。
- Global scope：去除 3.x 遗留淡矩形边框；“全局”恢复 15px/740 Domain 同级标题，标题与右侧动作之间新增轻量 Index Rule。
- Root Home：Topbar 左侧新增 Home icon，depth>=2 显示；Back/ Home 分离。Home 一次回 root 并通过 `navigationEpoch` 失效旧递归 pageSnapshot，不清业务数据/Undo/Redo。
- 保留 4.1.0：字母 cell-owned border、parallel switch、管理顺序、PWA 安装名、全局非结构总表、Entry secondary gap、日期 StudyStamp 原位刷新。
- 新增 `css/v4.2.0.css`；Service Worker cache generation 更新为 `v4.2.0-native-sticky-navigation-20260809-1`。
