# Vocabulary Index 4.0.2 测试报告

## 自动化结果

2026-08-08 在全新 4.0.2 工作快照执行：

- `npm test`：PASS（6176 Seed Entry；1240 RelationComponent）
- `npm run test:static`：PASS（25 个 Service Worker precache resources）
- `npm run test:runtime`：PASS
- `npm run test:stress`：PASS（125 entries / 158 memberships / 31 relation components synthetic）
- `npm run test:integrations`：PASS（最大 ChatGPT Shortcut URL 8042 chars）
- `npm run test:performance`：PASS（25 次搜索 30.6ms；关系 5.3ms；VIX preflight 2731.5ms）
- `npm run test:layout`：PASS（402×874）
- `npm run test:all`：PASS

## 4.0.2 新增合同

- Sticky 最终边界必须包含字母栏**实测高度**，不得依赖字母栏滚动中的瞬态 top；日期模式字母栏隐藏时不增加该高度。
- `study-date` 不再进入 pending jump；日期刷新保存/恢复当前 scrollY。
- Service Worker 必须预缓存 `css/v4.0.2.css`。
- Modal system shell 存在 theme-color/background best-effort 同步。
- Query chooser 继续 Oxford → Collins → Groq → ChatGPT；Oxford 使用新闭合书本路径。

## 真机边界

自动化不能替代 iPhone 17 Home Screen standalone。必须复核：

1. 全局词汇/短语/非结构总表、域总表、普通词表、word/phrase/content 的字母 Sticky 均紧贴字母栏下方且无镂空。
2. 日期 Sticky 继续位于主顶部栏下方，不错误预留字母栏。
3. 日期模式刷新学习日期后视口不移动。
4. Query chooser 右边界完整，Oxford 闭合书本视觉通过。
5. iOS 顶部系统区：4.0.2 仅能对 Web 内容与系统可读取 theme surface 做 best-effort 同步；若 iOS 26.5.2 仍保留 DOM 不可达的顶部系统带，应记录平台限制。
