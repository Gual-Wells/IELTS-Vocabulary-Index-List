# Vocabulary Index 4.3.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.3.0 延续 4.0.0 数据世代与 4.2.0 native Sticky/Home 视觉，集中修正真机反馈暴露的 Sticky 收起 transaction、word/phrase mode ownership、单向递归导航和历史 Presentation Layer 割裂。

## 当前正式边界

- 版本：`4.3.0`
- Backup Schema：`6`
- IndexedDB：`5`
- Built-in Seed revision：`4`
- VIX：`2`
- 主目标设备：iPhone 17 标准版，iOS WebKit，添加到主屏幕 standalone
- 数据：IndexedDB，本地优先；Service Worker 离线外壳
- PWA 安装名称：`Vocabulary Index`
- 不包含账号、云同步、学习计划、Dashboard、streak 或后端服务

## 核心语义

1. Domain 分 `structured | nonStructured`；Entry 分 `word | phrase | content`。
2. Membership 是来源事实，Projection 是可见归属；word/phrase/content 全部执行普通 Collection 优先级占有。
3. 系统总表只做投影，不拥有 Entry 状态。
4. Search fuzzy；Relation exact。Raw Relation Graph 全局精确双向；关系开关只做逻辑过滤。
5. 关系导航为域内唯一、域外唯一、非结构唯一、多目标四态。
6. fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 进入 destructive POP；任何 Home 都清 recursive navigation state。
7. Oxford → Collins → Groq → ChatGPT；ChatGPT 使用紧凑 context v2。

## 4.3.0 iPhone 运行时修订

- Date/Alphabet 继续 native Sticky，但收起从跨帧 `remove→measure→scroll` 补偿改为 pre-read geometry + 单提交 collapse/final-scroll transaction；字母栏差异继续由真实 `--content-sticky-top` 几何表达。
- alphabet/date mode 提升为 Collection-level；word/phrase 共享模式，而 scroll/expanded/calendar/browse anchor 继续各 view 独立。
- Safari history 降级为 gesture rail；VIX `navigationStack` 拥有递归 snapshot。Back destructive POP，Home clear all recursive frames，Forward/stale state 由 edge guard + Navigation API + dead token 防护。
- 永久 `navigation-underlay` 从启动即存在，不是 History 空页面，也不在非法手势时临时 render。
- `history.scrollRestoration='manual'`，避免浏览器与 VIX 双重恢复 scroll。
- Presentation 收敛为 Popover / Modal / Dock：Query/Relation 共用轻浮层 lifecycle；Search/Confirm 迁入 retained Modal Stack；PIN/Review 保持 context dock。
- Modal 删除 body-fixed scroll lock 与双 rAF hard reveal，保留 retained parent DOM、48%/20% full-Web backdrop、VisualViewport card geometry。
- PIN 不再为了状态变化重建整个 Entry row；PIN/Review Dock DOM 常驻并使用 opacity/visibility/transform 出入。
- 4.2.0 Query/Oxford/Home wordmark/Global Index Rule/native Sticky containing-block/58px toolbar/longpress 等继续保留。

## 数据世代

Seed 未变：3 Domain / 17 Collection / 6176 Entry（5539 word / 587 phrase / 50 content）/ 7574 Membership / 1240 RelationComponent。

## 验证

```bash
npm run test:all
```

自动测试不代表真实 iPhone standalone 验收。帧级 Sticky、系统 edge gesture、modal background lock 等专项见：

- `tests/MANUAL_CHECKLIST.md`
- `tests/IPHONE_REDUCED_TESTS_4.3.0.md`

## 现行规范入口

- `REQUIREMENT_BASELINE_4.3.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.3.0.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.3.0.md`
- `PRODUCT_MANUAL_4.3.0.md`
- `AUDIT_REPORT_4.3.0.md`
- `TECHNICAL_RESEARCH_4.3.0.md`
- `CHANGE_REPORT_4.3.0.md`
- `TEST_REPORT_4.3.0.md`
- `PROJECT_HISTORY.md`
