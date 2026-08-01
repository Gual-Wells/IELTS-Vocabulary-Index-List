# Vocabulary Index 3.0.0

面向 iPhone Safari / 主屏幕 PWA 的本地优先英语词汇索引、连续定位与复制工具。Windows Chrome 用于辅助管理。

## 产品主线

```text
进入词表 → 展开字母 → 浏览英文与当前词表词性 → 点按复制 → 外部词典查询 → 返回原位置继续
```

真 3.0 保留 3.0 RC 的米色纸张、墨绿色和 Georgia 视觉语言，同时重建了 2.4.1 中更成熟的连续浏览行为。

## 主要能力

- 点按词条主体只复制英文；
- 字母分组局部展开，不重建整表；
- PIN sticky 连续导航，跳转后仍可前后操作；
- 主动恢复上次浏览位置，手动滚动防抖记录；
- 当前词表、当前词域和全局搜索；
- 独立词条动作、详情、搜索、编辑和确认容器；
- Domain / Collection / Entry / Membership / PhraseToken；
- 词域内唯一、同词词性合并、跨词域允许同形词；
- 系统短语索引、相关短语和组成词；
- 可选繁体释义，但默认不进入主列表；
- TXT / Markdown / CSV / JSON 预览导入；
- 完整 JSON 备份、2.4.1 → 3.0 迁移、撤销与重做；
- Groq 动态模型目录、AI 新增、分批核查和标注审阅；
- 用户确认式 PWA 更新和离线应用壳。

## 快速检查

```bash
npm run test:all
```

可选静态类型检查：

```bash
tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution bundler --lib ES2022,DOM js/*.js

tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution bundler --lib ES2022,WebWorker sw.js
```

## 部署

ZIP 根目录就是仓库根目录。完整替换仓库时保留 `.git`，其余项目文件使用本包内容替换，再提交和推送。不要再合并旧 `agent/*` 覆盖分支。

部署前：

1. 从旧版导出完整 JSON；
2. 保留 2.4.1 备份；
3. 关闭同站点的其他 Safari/PWA 实例；
4. 部署完整文件树；
5. 按 `tests/MANUAL_CHECKLIST.md` 完成 iPhone 真机验收。

## 文档

- `PRODUCT_MANUAL_3.0.0.md`：产品功能手册；
- `UX_SPEC_3.0.0.md`：交互不变量；
- `PREPRODUCTION_REPORT_3.0.0.md`：议定的预制作规格；
- `CHANGE_REPORT_3.0.0_TRUE.md`：本轮制作变更；
- `DATA_FORMATS.md`：数据和导入格式；
- `MIGRATION_3.0.0.md`：迁移说明；
- `DEPLOY.md`：部署与回滚；
- `TEST_REPORT_3.0.0.md`：测试边界。
