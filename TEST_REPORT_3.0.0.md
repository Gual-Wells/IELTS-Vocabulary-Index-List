# Vocabulary Index 3.0.0 RC2 测试报告

测试日期：2026-08-01

## 已通过

### 功能与迁移

```bash
npm test
```

覆盖规范化、短语识别、繁体转换、旧 `sources` 迁移、独立上次位置键、人工词性覆盖、PIN 顺序、三种序号模式、Membership 无 `sourceText`、域内唯一、跨域同形词、系统短语表、精确词元关联、投影优先级、模糊搜索、导入解析、Groq Retry-After 与动态分批。

结果：通过。

### 静态应用与 UX 契约

```bash
npm run test:static
```

除原有 HTML ID、CSP、模块依赖、Service Worker、Manifest、跨实例修订号和无云同步契约外，本轮新增断言：

- PIN 存在独立 sticky 导航条；
- PIN 不再位于会滚出视口的顶部按钮矩阵；
- 字母导航按 PIN 条高度避让；
- iPhone 操作栏固定在安全区上方；
- 词条详情进入 Sheet，不使用 `expandedEntries` 整表重绘状态；
- AI 审阅同时具备上一条与下一条；
- 高频触控目标达到 44px 级别；
- 自定义控件具备 `:focus-visible`。

结果：通过。

### 随机事务模型压力

```bash
npm run test:stress
```

执行 600 步确定性新增、复用、短语、来源增加/移除、删除和 PIN 操作；每步重新规范化并验证完整数据不变量。固定随机种子的最终状态：115 个词项、114 条来源关系。

结果：通过。

### JavaScript 静态类型

```bash
tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable js/*.js

tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution Bundler --lib ES2022,WebWorker sw.js
```

结果：零错误。全部 JS/MJS 另通过 `node --check`。

### 完整 Seed 合同

- 5,005 个词项；
- 7 个普通词表；
- 6,407 条 Membership；
- 20 条 PhraseToken（10 个双词短语）；
- Membership 全部不存在 `sourceText`。

### 代表性静态渲染

使用交付 CSS 与真实界面结构，在以下视口生成静态渲染用于布局检查：

- 390×844：单词域首页；
- 390×844：滚动到长词表中部，确认顶栏、PIN、字母导航和底部工具栏的堆叠；
- 1280×900：桌面首页。

该步骤验证 CSS 布局，不等同于真实浏览器业务端到端测试。

## 未自动完成

受受管 Chromium 策略限制，本地 HTTP 和 `file:` 页面均被组织策略阻止，因此未声称完成真实应用 URL 的浏览器 E2E。仍需按人工清单验证：

- iPhone Safari / 主屏幕 PWA 首次迁移；
- PIN 在真实惯性滚动与安全区中的持续可达性；
- 输入法、键盘弹出和 Sheet 高度；
- 离线冷启动与 Service Worker 更新；
- Safari 与 PWA 双实例；
- 真实 Groq API、限流和暂停/取消；
- 真实 5,005 词 UI 性能。
