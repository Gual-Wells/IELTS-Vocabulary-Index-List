# Vocabulary Index 3.5.1 迁移说明（对齐重做版）

- Backup schema 保持 5；
- IndexedDB DB version 保持 4；
- Seed revision 保持 3；
- 不执行数据迁移；
- Service Worker cache 更新为 `v3.5.1-ios-shell-20260803-3`，用于替换已撤回的第一次 3.5.1 Shell；
- 浏览位置的存储键不变，但其语义改为用户手动保存的浏览锚点；旧有效位置可以继续作为初始锚点使用，之后仅在用户长按时更新。
