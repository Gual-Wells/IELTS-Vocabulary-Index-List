# Vocabulary Index 4.1.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.1.0 延续 4.0.0 数据世代与 4.0.1 retained Modal Stack，集中修正 4.0.2 真机仍暴露的 Top Chrome/Sticky/字母栏边框、Provider 菜单、一级表项密度、Home identity 与系统壳蒙版同步。

## 当前正式边界

- 版本：`4.1.0`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX：`2`
- 主目标设备：iPhone 17 标准版，Safari 添加到主屏幕 standalone
- 数据：IndexedDB，本地优先；Service Worker 离线外壳
- PWA 安装名称：`Vocabulary Index`
- 不包含账号、云同步、学习计划、Dashboard、streak 或后端服务

## 核心语义

1. Domain 分 `structured | nonStructured`；Entry 分 `word | phrase | content`。
2. Membership 是来源事实，Projection 是可见归属；word/phrase/content 全部执行普通 Collection 优先级占有。
3. 系统总表只做投影，不拥有 Entry 状态。
4. Search fuzzy；Relation exact。Raw Relation Graph 全局精确双向；关系开关只做逻辑过滤。
5. 关系导航为域内唯一、域外唯一、非结构唯一、多目标四态。
6. fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 恢复完整快照。
7. Oxford → Collins → Groq → ChatGPT；ChatGPT 使用紧凑 context v2。

## 4.1.0 iPhone 修订

- Top Chrome 几何以真实 DOM rect 为唯一真值，删除 `visualViewport.offsetTop + 72` 强制地板；字母 Sticky 只在字母栏真实吸顶后 engaged。
- 字母栏改为 cell-owned border：每格 top/right/bottom，A/首格 left；disabled 只灰字形，结构线不灰。
- 字母 Sticky 标题补齐结构边界，日期 Sticky 与字母 Sticky 共用同一 Top Chrome 模型。
- 日期模式刷新学习日期继续原位，无 `study-date` 目标跳转。
- Query chooser 使用明确 viewport edge inset；Oxford 按用户参考图重绘合上书本 SVG，其余 Provider 造型不擅自更换。
- 一级表项繁体/来源 secondary line 继续收紧，同时保持同 Y 与 44px 操作触控区域。
- Home 全局区改为左侧“上→ / 下←”平行反向切换图标、右侧“管理”；Home 大字仍为“词汇索引”，topbar 改为 `Vocabulary Index`。
- `全局非结构内容` 展示名改为 `全局非结构总表`，稳定 ID 不变。
- Modal system shell 按 retained stack 深度累计合成 48% 第一层 + 20% 后续层；theme-color/root/topbar 同步一个最终颜色，custom backdrop 从 topbar 下方开始，避免 topbar 二次蒙版。
- iOS 26.5.2 若仍存在 viewport 外 system strip，最终以真实 iPhone 结果记录平台边界；不通过破坏常态布局的 `black-translucent` 冒险绕过。

## 数据世代

Seed 未变：3 Domain / 17 Collection / 6176 Entry（5539 word / 587 phrase / 50 content）/ 7574 Membership / 1240 RelationComponent。

## 验证

```bash
npm run test:all
```

自动测试不代表真实 iPhone standalone 验收；真机专项见 `tests/MANUAL_CHECKLIST.md`。

## 现行规范入口

- `REQUIREMENT_BASELINE_4.1.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.1.0.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.1.0.md`
- `PRODUCT_MANUAL_4.1.0.md`
- `AUDIT_REPORT_4.1.0.md`
- `CHANGE_REPORT_4.1.0.md`
- `TEST_REPORT_4.1.0.md`
- `PROJECT_HISTORY.md`
