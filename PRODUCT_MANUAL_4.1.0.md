# Vocabulary Index 4.1.0 使用手册

4.1.0 延续 4.0.x 数据语义，主要更新 iPhone 真机视觉和 PWA shell。

- 首页：大字仍为“词汇索引”；顶部栏显示 `Vocabulary Index`。全局区左侧双向平行箭头切换 structured/nonStructured，右侧“管理”进入管理功能。
- 全局非结构入口显示为“全局非结构总表”。
- 字母浏览：字母按钮自身拥有完整结构边框；禁用字母只变淡字形。字母栏吸顶后，当前字母 Sticky 标题紧贴其下方。
- 日期浏览：日期标题直接贴主顶部 Chrome；刷新学习日期只更新数据，屏幕保持原位。
- 查询：Oxford → Collins → Groq → ChatGPT；菜单保留右侧安全空间。Oxford 图标为用户参考图语义的合上书本。
- 弹窗：retained Modal Stack 不变；顶部 shell 根据实际弹窗层数累计变暗。若 iOS 26.5.2 的 system strip 不接受动态 tint，则以平台限制记录。
- PWA 主屏幕名称：`Vocabulary Index`。
- Backup/VIX：Schema 6 / VIX 2，无 4.1.0 数据迁移。

真机验收以 `tests/MANUAL_CHECKLIST.md` 为准。
