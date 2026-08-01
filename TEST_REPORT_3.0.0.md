# Vocabulary Index 3.0.0 RC 测试报告

测试日期：2026-08-01

## 已通过

### 功能与迁移

```bash
npm test
```

覆盖规范化、短语识别、繁体转换、旧 `sources` 迁移、独立上次位置键、人工词性覆盖、PIN 顺序、三种序号模式、Membership 无 `sourceText`、域内唯一、跨域同形词、系统短语表、精确词元关联、投影优先级、模糊搜索、导入解析、Groq Retry-After 与动态分批。

结果：通过。

### 静态应用契约

```bash
npm run test:static
```

覆盖 HTML ID、CSP、模块依赖、Service Worker 预缓存声明、Manifest 相对路径、无内联事件、无 GitHub 云同步运行时代码、修订号冲突保护、浏览位置原子写入和 3.0 版本一致性。

结果：通过。

### 随机事务模型压力

```bash
npm run test:stress
```

执行 600 步确定性新增、复用、短语、来源增加/移除、删除和 PIN 操作；每步重新规范化并验证完整数据不变量。固定随机种子的当前最终状态：115 个词项、114 条来源关系。

结果：通过。

### JavaScript 静态类型

`js/*.js` 使用 TypeScript `checkJs`：零错误。`sw.js` 使用 WebWorker lib：零错误。全部 JS/MJS 通过 `node --check`。

## 实际 Seed 合同

本完整源码包直接包含并保留 2.4.1 的 `data/seed.json`、`data/source/` 和图标原文件。测试脚本额外断言：

- 5,005 个词项；
- 7 个普通词表；
- 6,407 条 Membership；
- 20 条 PhraseToken（10 个双词短语）；
- Membership 全部不存在 `sourceText`。

## 未自动完成

受当前受管 Chromium 策略限制，本地 HTTP 地址返回：

```text
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

因此未声称完成真实浏览器端到端自动化。仍需按人工清单验证：

- iPhone Safari / 主屏幕 PWA 首次原地迁移；
- 离线冷启动；
- Safari 与 PWA 双实例；
- 真实 Groq API、限流和暂停/取消；
- 真实 5,005 词 UI 性能与触控行为。
