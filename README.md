# Vocabulary Index 4.0.2

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.0.2 延续 4.0.0 的内容世代与 4.0.1 的 retained Modal Stack，专门修正真机顶部几何、Sticky 遮挡/镂空、日期刷新连续性和 Query chooser 细节。

## 当前正式边界

- 版本：`4.0.2`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX：`2`
- 主目标设备：iPhone 17 标准版，Safari 添加到主屏幕
- 数据：IndexedDB，本地优先；Service Worker 离线外壳
- 不包含账号、云同步、学习计划、Dashboard、streak 或后端服务

## 核心语义

1. Domain 分 `structured | nonStructured`；Entry 分 `word | phrase | content`。
2. Membership 是来源事实，Projection 是可见归属；word/phrase/content 全部执行普通 Collection 优先级占有。
3. 系统总表只做投影，不拥有 Entry 状态。
4. Search fuzzy；Relation exact。Raw Relation Graph 全局精确双向；关系开关只做逻辑过滤。
5. 关系导航为域内唯一、域外唯一、非结构唯一、多目标四态。
6. fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 恢复完整快照。
7. Oxford → Collins → Groq → ChatGPT；ChatGPT 使用紧凑 context v2。

## 4.0.2 iPhone 修订

- 顶部内容边界统一为：**基础顶部 Chrome 实测底边 + 可见字母栏实测高度**。不再根据字母栏滚动中的瞬态 top 判定是否占位。
- 字母栏可见时，Sticky Heading、active 字母、程序跳转和阅读边界共享同一测量值；日期模式字母栏隐藏后自动退化为基础顶部边界。
- 该逻辑统一覆盖全局总表、域总表、普通词表和 word/phrase/content。
- 日期模式刷新学习日期只更新 StudyStamp，保留当前 scroll 位置，不再自动跳到今天。
- Query chooser 相较 4.0.1 再左移并保留完整右边框；Oxford 重绘为闭合书本，四 Provider 统一深色描边。
- Modal Stack 保持 4.0.1 设计；打开 Modal 时同步 theme-color/页面底色为第一层蒙版的合成色，尝试让可控的系统壳区域连续。
- iOS 26.5.2 Home Screen PWA 若仍显示系统绘制、DOM 不可达的顶部状态条区域，属于 WebKit 平台边界；本版不通过强制黑色状态栏破坏浅色常态页面。

## 数据世代

4.0.2 不改 Seed。当前仍为：

- Domain：3
- Collection：17
- Entry：6176（5539 word / 587 phrase / 50 content）
- Membership：7574
- RelationComponent：1240

NAWL/CET/TEM/COCA 与通用英语释义仍属于后续数据建设，不在本次运行时修订范围。

## 验证

```bash
npm run test:all
```

自动测试不代表真实 iPhone standalone 验收；真机专项见 `tests/MANUAL_CHECKLIST.md`。

## 现行规范入口

- `REQUIREMENT_BASELINE_4.0.2.md`
- `SEMANTIC_IMPACT_MATRIX_4.0.2.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.0.2.md`
- `PRODUCT_MANUAL_4.0.2.md`
- `PROJECT_HISTORY.md`

`PREUPDATE_ROADMAP_2026-08-04.md` 仅作为历史决策来源保留。
