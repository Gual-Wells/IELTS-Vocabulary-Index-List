# Vocabulary Index 4.2.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.2.0 延续 4.0.0 数据世代与 retained Modal Stack，集中修正 4.1.0 真机暴露的 Alphabet Sticky mirror、Root Home 缺口、Query/Oxford、Home 顶部视觉与失败的 System Shell 动态染色实验。

## 当前正式边界

- 版本：`4.2.0`
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
6. fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 恢复完整快照；Root Home 一次销毁当前递归导航语义并回根。
7. Oxford → Collins → Groq → ChatGPT；ChatGPT 使用紧凑 context v2。

## 4.2.0 iPhone 修订

- Alphabet heading 回归 native `position: sticky`，删除独立 Sticky mirror；浏览器恢复 collapsed 自然退出、section-bottom push-off/退场、真实 heading 点击锚点和 section side rails。
- `alphabetSectionMetrics + ResizeObserver + 二分查找` 保留，仅负责字母栏 active/横向轨道。
- Query chooser 采用 relation multi-target 风格的右缘挂接并再左退 10px，viewport inset 12px、纵向 gap 13px。
- Oxford 重新设计为紧凑 closed-book outline，视觉面积与 Collins/Groq/ChatGPT 对齐。
- 撤销 4.1.0 System Shell Surface Controller；DOM 变暗完全由真实 backdrop 完成，不再动态染 theme-color/root/topbar。
- Home topbar `Vocabulary Index` 使用独立 serif Product Wordmark；Hero 大字“词汇索引”保持。
- `全局` 与 Domain heading 同为 15px/740；移除遗留完整淡矩形框，改为轻量 Index Rule。
- Topbar 新增 Root Home：depth>=2 显示在 Back 右侧；一次回首页并通过 `navigationEpoch` 失效旧 pageSnapshot，不清 PIN/StudyStamp/Annotation/Settings/Undo-Redo。
- 保留 4.1.0 已确认项：字母 cell-owned border、parallel switch（左）+ 管理（右）、PWA 名称、`全局非结构总表`、Entry secondary gap、日期 StudyStamp 原位刷新。

## 数据世代

Seed 未变：3 Domain / 17 Collection / 6176 Entry（5539 word / 587 phrase / 50 content）/ 7574 Membership / 1240 RelationComponent。

## 验证

```bash
npm run test:all
```

自动测试不代表真实 iPhone standalone 验收；真机专项见 `tests/MANUAL_CHECKLIST.md`。

## 现行规范入口

- `REQUIREMENT_BASELINE_4.2.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.2.0.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.2.0.md`
- `PRODUCT_MANUAL_4.2.0.md`
- `AUDIT_REPORT_4.2.0.md`
- `CHANGE_REPORT_4.2.0.md`
- `TEST_REPORT_4.2.0.md`
- `PROJECT_HISTORY.md`
