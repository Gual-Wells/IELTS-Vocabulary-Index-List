# Vocabulary Index 3.1.1

本地优先、按独立域组织的英语词汇与短语索引。主要面向 iPhone Safari／主屏幕 PWA，并兼容 Windows Chrome。

## 3.1.1

- 完整保留 3.1.0 的学习日期、复合普通表、日期模式和关联导航；
- 一级词汇与短语表项新增牛津英汉辞书查询控件；
- 一级表项新增 ChatGPT 新聊天查询控件；
- 牛津只发送英文纯文本；
- ChatGPT 发送当前条目的完整上下文 JSON；
- 全局聚合项发送其全部独立域实例；
- Schema 4、Seed revision 3 和词库数据不变。

## 数据概况

- 独立域：2；
- 全局去重词汇：5,322；
- 全局短语：587；
- 计算机术语：544 词、577 短语，繁体释义覆盖 100%。

详见：

- `PRODUCT_MANUAL_3.1.1.md`
- `UX_SPEC_3.1.1.md`
- `CHANGE_REPORT_3.1.1.md`
- `MIGRATION_3.1.1.md`
- `DATA_FORMATS.md`
- `DATA_REPORT.md`
- `TEST_REPORT_3.1.1.md`

## iPhone 外部查询依赖

ChatGPT 快捷指令名称必须为 `AI查询`，并使用 `Start conversation with ChatGPT` 接收快捷指令输入。牛津英汉辞书通过其 App URL Scheme 直接打开。

## 本地运行

本项目是静态 PWA，必须通过 HTTP(S) 打开，不能直接双击 `index.html`。

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000/`。

## 测试

```bash
npm run test:all
```

## 数据原则

- 所有可编辑内容属于某个独立域；
- 全局总表无独立新增入口；
- 总表由 Entry 派生，不写入 Collection；
- VIX 内容 JSON 不包含个人学习状态；
- 完整备份用于设备迁移和灾难恢复。
