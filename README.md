# Vocabulary Index 3.2.0

面向 iPhone Safari 主屏幕 PWA 的本地优先英语词汇与短语索引。

## 平台边界

- 唯一主要运行方式：Safari“添加到主屏幕”后的 standalone PWA；
- 单用户、单设备、本地 IndexedDB；
- 无账户、云同步或多设备合并；
- 其他人打开公开仓库时使用各自本地数据，不会影响本机。

## 3.2.0

- 首页字号与信息层级收敛；
- 系统总表增加低强度侧向渐变；
- 一级表项改为“文本信息行＋操作行”；
- 英文不再任意断行，繁体释义恢复可读空间；
- 所有一级操作保持 44px 触控区域；
- 长列表按块惰性渲染；
- SVG 图标缓存；
- 关联惰性解析；
- 滚动位置追踪限流；
- sticky 背景模糊移除；
- standalone PWA 后台 viewport 异常防御。

## 数据概况

- 独立域：2；
- 全局去重词汇：5,322；
- 全局短语：587；
- 计算机术语：544 词、577 短语，繁体释义覆盖 100%。

## 文档

- `AUDIT_REPORT_3.2.0.md`
- `PRODUCT_MANUAL_3.2.0.md`
- `UX_SPEC_3.2.0.md`
- `CHANGE_REPORT_3.2.0.md`
- `MIGRATION_3.2.0.md`
- `TEST_REPORT_3.2.0.md`
- `DATA_FORMATS.md`
- `SECURITY.md`

## 本地运行

必须通过 HTTP(S) 打开：

```bash
python3 -m http.server 8000
```

在 iPhone Safari 访问部署地址，再通过分享菜单添加到主屏幕。

## 测试

```bash
npm run test:all
```
