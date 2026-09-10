# Vocabulary Index 4.4.0 使用手册

4.4.0 不改变词库和导入格式，主要修复 iPhone PWA 的 Sticky、返回历史和 Modal 背景稳定性。

- **字母/日期 Sticky**：标题仍是原生 Sticky。长列表中收起时使用真实 flow anchor 计算位置；不再因 section 边框造成每次约 1px 的累计上移。
- **长位移收起**：支持的浏览器使用无动画 View Transition 作为 rendering-suppression transaction，先在完整旧布局中完成 root scroll，再删除 body，避免把大 DOM shrink 与 `scrollTo()` 同步提交。
- **返回**：VIX 使用 destructive-v2。页面身份由 generation + token 决定，返回后离开的递归页立即死亡；Forward 不提供撤销返回。
- **Home**：Home 创建新的 root generation，而不是按当前深度 `history.go(-N)`。业务数据、PIN、学习日期、标注、API Key、浏览锚点和数据 Undo/Redo不受影响。
- **Modal**：打开 Settings/Search/Confirm 不再修改 html/body overflow，也不重新测背景 Sticky；背景只由 retained modal layer + inert/touch/focus guard 锁定。
- **Navigation underlay**：4.3 的永久 underlay 已删除，应用与 Safari 之间不再人为插入 whole-app stacking substrate。
- **数据世代**：Schema6 / DB5 / Seed4 / VIX2，与 4.3 完全兼容。

自动化通过不代表 iOS system gesture/compositor 已真机验收；请执行 `tests/MANUAL_CHECKLIST.md` 与 `tests/IPHONE_REDUCED_TESTS_4.4.0.md`。
