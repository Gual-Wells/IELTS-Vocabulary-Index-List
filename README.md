# Vocabulary Index 3.3.1

面向 iPhone Safari“添加到主屏幕”场景的本地优先英语词汇与短语索引。

## 平台边界

- 主要运行方式：iPhone standalone PWA；
- 单用户、单设备、本地 IndexedDB；
- 无账户、云同步或远程业务数据库；
- 公开部署的其他访问者使用各自独立的浏览器数据。

## 3.3.1

3.3.1 是 3.3.0 真机审计后的功能、数据完整性、状态切换、性能与视觉修正版。主要修复：

- 全局词汇／短语总表“返回上次位置”的作用域键；
- 跨词表、模式和分区的位置去重污染；
- 删除、重命名、替换后可能产生的孤儿学习日期；
- 系统短语表 VIX 替换遗留失效 Membership；
- 程序化跳转被 Store 重绘提前清空；
- 关系跳转指向实际不可见普通表；
- 标注审阅在 iPhone 上缺少逐条处理控件、离开当前词表及全局聚合不完整；
- AI 标注批次整库重建与旧 Entry 结果回写；
- 首页紧凑顶栏错位、序号遮挡、顶部透底、返回顶部遮挡和关联附着件视觉过重；
- 二级关系跳转图标、关闭按钮、长文本横滑提示和管理页计数表达；
- 重复渲染、重复路由事件及覆盖层几何冲突。

高危操作不再自动下载备份。执行前先显示小型选择窗口：选择“下载备份”或“不下载”都会继续进入该操作本身的确认流程；该选择只决定是否下载，不承担许可或阻止作用。

## 不变项

- IndexedDB Schema：4；
- DB version：4；
- Seed revision：3；
- VIX format：1；
- Oxford URL Scheme 不变；
- ChatGPT 继续使用名为 `AI查询` 的快捷指令和 URL 文本输入；
- Seed 业务内容不变，仅 `appVersion` 更新为 3.3.1。

## 数据概况

- 独立域：2；
- Entry：6,126；
- Membership：8,072；
- 全局去重词汇：5,322；
- 全局短语：587；
- 计算机术语：544 词、577 短语，繁体释义覆盖 100%。

## 当前文档

- `AUDIT_REPORT_3.3.1.md`
- `CHANGE_REPORT_3.3.1.md`
- `TEST_REPORT_3.3.1.md`
- `UX_SPEC_3.3.1.md`
- `PRODUCT_MANUAL_3.3.1.md`
- `MIGRATION_3.3.1.md`
- `tests/MANUAL_CHECKLIST.md`
- `DATA_FORMATS.md`
- `SECURITY.md`

## 本地运行

必须通过 HTTP(S) 打开：

```bash
python3 -m http.server 8000
```

## 测试

```bash
npm run test:all
```
