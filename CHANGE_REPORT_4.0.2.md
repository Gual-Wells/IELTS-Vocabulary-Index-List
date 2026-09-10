# Vocabulary Index 4.0.2 变更报告

4.0.2 不改变数据世代，针对 4.0.1 真机复核暴露的几何与连续性问题做局部收口：

- 修正顶部 Chrome 计算：字母模式的内容边界固定为“基础顶部 Chrome + 字母栏实测高度”，不再依赖字母栏尚未吸顶时的瞬态位置。
- 由同一边界驱动 Sticky Heading、active 字母、程序跳转和阅读视口，覆盖全局/域/普通 Collection 与 word/phrase/content。
- 修复 Sticky 实际生成却被字母栏覆盖，以及由此暴露的字母栏下方镂空。
- 日期模式刷新学习日期改为原位更新，不再 `pendingJumpReason = study-date` 跳到今天。
- Query chooser 再向左校准；Oxford 重绘为闭合书本，四 Provider 统一深色描边。
- Modal 打开/关闭同步系统 theme-color 和页面底色到蒙版合成色，作为 iOS standalone 顶部系统区的 best-effort 融合。
- 新增 `css/v4.0.2.css`；Service Worker cache generation 升级到 4.0.2。
