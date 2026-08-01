# Vocabulary Index 3.0.1

面向 iPhone Safari / 主屏幕 PWA 的本地优先英语词汇与短语索引。Windows Chrome 用于辅助管理。

## 日常路径

```text
进入词表 → 展开字母 → 浏览 → 点按复制 → 外部词典查询 → 返回原位置
```

## 3.0.1 交互原则

- 普通词表只显示词汇；短语表只显示短语。
- 两类词表使用同一页面、字母索引、行高和操作结构。
- 词汇行向下展开相关短语；短语行向下展开组成词汇。
- 展开内容不显示“相关短语”“组成词汇”等解释标题。
- PIN 直接位于每一行；存在 PIN 时仍提供可连续使用的 sticky 导航。
- 词性保留在数据层，但从浏览、搜索、编辑和详情界面隐藏。
- 每个词表独立保存上次位置；词表内恢复不会跨表。
- 搜索支持全部、词域、具体词表三级范围。
- 所有词表（含短语）顺序通过拖动管理。
- 子操作使用弹窗栈，关闭子层后返回原操作状态。
- 搜索打开时锁定背景视口，避免 iOS 键盘把页面整体顶起。

## 数据与功能

- Domain / Collection / Entry / Membership / PhraseToken；
- 词域内唯一、跨词域允许同形内容；
- 词汇与短语双向关系；
- 可选繁体释义；
- TXT / Markdown / CSV / JSON 导入；
- 完整 JSON 备份与 2.4.1 → 3.0 迁移；
- 撤销、重做、PIN、标注和词表内位置；
- Groq 动态模型目录、AI 新增、分批核查；
- 用户确认式 PWA 更新和离线应用壳。

## 验证

```bash
npm run test:all

tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution Bundler js/*.js
```

## 部署

ZIP 根目录就是仓库根目录。整体替换仓库项目文件时保留 `.git`，不要与旧覆盖分支合并。

部署前先导出完整 JSON；部署后完全关闭旧 Safari / 主屏幕实例，再重新打开并按 `tests/MANUAL_CHECKLIST.md` 验收。

## 文档

- `PRODUCT_MANUAL_3.0.1.md`：产品功能手册；
- `UX_SPEC_3.0.1.md`：交互硬约束；
- `CHANGE_REPORT_3.0.1.md`：本轮重构说明；
- `DATA_FORMATS.md`：数据与导入格式；
- `DATA_REPORT.md`：内置数据和投影计数；
- `MIGRATION_3.0.0.md`：2.x 迁移说明；
- `DEPLOY.md`：部署与回滚；
- `TEST_REPORT_3.0.1.md`：验证结果与边界。
