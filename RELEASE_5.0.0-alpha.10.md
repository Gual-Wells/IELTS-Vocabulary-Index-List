# Vocabulary Index 5.0.0-alpha.10

## 交付

- 回归 GitHub Pages 作为唯一 PWA 前台。
- 新增版本无关的个人 Bridge，集中保存 Groq Key，并承载 Groq 与 Mirror 传输。
- 新增本地 VIX Function 与 `VIX:` 个性化指令协议。
- 实现 Mirror 3 冻结上下文、结果收件、分层勾选和单事务导入。
- Groq 改为便携回忆结构：短释义、记忆提示、搭配、用法提醒和多例句。
- Oxford 保留现有 iOS 跳转；移除没有受支持自动填词协议的入口。
- 退役的查询服务完整实现与相关测试已移入独立逻辑历史包，不进入产品运行时或发布目录。

## 不变项

- IndexedDB 数据与个人学习状态继续本地保存。
- Seed revision 7、Schema 6、DB version 5 不变。
- PWA 不需要删除重装。
