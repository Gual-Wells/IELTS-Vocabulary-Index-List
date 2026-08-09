# Vocabulary Index 4.4.0

Vocabulary Index 是面向 iPhone 主屏幕 PWA 的本地英语学习索引。4.4.0 延续 4.0 数据世代与 4.3 已收敛的 Collection-level mode / Presentation family，集中修正真机暴露的 Sticky 长位移、destructive navigation identity/restore、Modal background geometry ownership。

## 当前版本

- 版本：`4.4.0`
- Backup Schema：6
- IndexedDB：5
- Built-in Seed revision：4
- VIX：2
- Navigation：`destructive-v2`
- 主目标：iPhone 17 / iOS 26.5.2 / Home Screen standalone

## 4.4.0 Runtime Correctness

- Sticky：新增真实 `.section-flow-anchor`；收起几何不再从 section border-box 猜 natural top；长位移按 scroll-settle → collapse，并在支持时用无动画 View Transition rendering suppression。
- Navigation：generation+token 为身份，depth 降为诊断；snapshot persistence 不 rewrite browser token；Back 同步 runtime hydrate、异步 persistence；Home 新 generation root PUSH；Forward/stale pre-commit guard。
- Visual surface：删除 4.3 permanent navigation underlay 与 whole-app stacking context。
- Modal：open/close 不再改变 html/body modal class/overflow；Modal VisualViewport 与 page Sticky geometry 分离；root app inert 暂保留等待目标机 A/B。
- Tests：新增 pure runtime behavior tests，覆盖 Sticky target math 和 destructive-v2 classifier。

## 测试

```bash
npm run test:all
```

自动化 PASS 不等于 iOS 真机 compositor/gesture PASS。真机执行：

- `tests/MANUAL_CHECKLIST.md`
- `tests/IPHONE_REDUCED_TESTS_4.4.0.md`

## 当前规范

- `REQUIREMENT_BASELINE_4.4.0.md`
- `SEMANTIC_IMPACT_MATRIX_4.4.0.md`
- `LOCAL_ARCHITECTURE.md`
- `DATA_FORMATS.md`
- `UX_SPEC_4.4.0.md`
- `PRODUCT_MANUAL_4.4.0.md`
- `AUDIT_REPORT_4.4.0.md`
- `TECHNICAL_RESEARCH_4.4.0.md`
- `CHANGE_REPORT_4.4.0.md`
- `TEST_REPORT_4.4.0.md`
- `MIGRATION_4.4.0.md`

历史版本文档保留为生命周期事实；当前实现以 4.4.0 文件为准。
