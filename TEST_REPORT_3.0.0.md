# Vocabulary Index 3.0.0 测试报告

测试日期：2026-08-01

## 1. 自动功能与真实 Seed 合同

```bash
npm test
```

结果：`run-tests: OK`

覆盖：

- 英文规范化、短语识别和精确词元；
- 简体输入到通用繁体的当前转换实现；
- 2.4.1 分类、来源、人工词性、PIN、标注和上次位置迁移；
- Domain / Collection / Entry / Membership / PhraseToken；
- 词域内唯一和跨词域同形词；
- 系统短语表、相关短语和组成词；
- 三种序号模式；
- TXT、Markdown、CSV、JSON 解析；
- Groq Retry-After 和动态分批。

完整 Seed 断言：

- 5,005 个 Entry；
- 7 个普通词表；
- 6,407 条 Membership；
- 20 条 PhraseToken；
- Membership 不包含 `sourceText`。

## 2. 静态应用与 UX 契约

```bash
npm run test:static
```

结果：`static-tests: OK`

覆盖：

- HTML ID 唯一、CSP 和无内联事件；
- 模块依赖和 Service Worker 预缓存；
- 无运行时 GitHub 云同步代码；
- 动作、详情、搜索、表单和确认容器分离；
- 无永久移动端底栏；
- PIN / 标注 sticky 上下文及互斥；
- 字母导航避让上下文控制器；
- `jumpToEntry()` 局部展开并禁止调用整表重绘；
- 手动滚动位置保存；
- 当前词表词性显示；
- AI 模型目录持久化和禁止品牌硬编码；
- PWA 用户确认更新；
- 3.0 视觉变量、44px 触控目标和可见焦点。

## 3. 压力模型

```bash
npm run test:stress
```

结果：`stress-tests: OK (115 entries, 114 memberships)`

固定随机种子执行 600 步新增、复用、短语、来源增加/移除、删除和 PIN 操作。每步重新规范化并检查域内唯一、关系完整性和 Membership 无重复英文。

## 4. JavaScript 静态类型与语法

浏览器模块：

```bash
tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution bundler --lib ES2022,DOM js/*.js
```

Service Worker：

```bash
tsc --allowJs --checkJs --noEmit --target ES2022 --module ES2022 \
  --moduleResolution bundler --lib ES2022,WebWorker sw.js
```

结果：零错误。

全部 JavaScript / MJS 使用 `node --check` 通过。HTML 可解析，CSS 花括号平衡。

## 5. 完整包验证

候选完整 ZIP 已解压到空目录并重新执行：

- `sha256sum -c SHA256SUMS.txt`：全部文件通过；
- `npm run test:all`：全部通过；
- 全部 JS/MJS `node --check`：通过；
- 浏览器模块与 Service Worker 分别执行 `checkJs`：零错误；
- HTML 解析和 CSS 结构检查：通过；
- 本地 HTTP 对 index、Manifest、CSS、全部模块、Seed、图标和 Service Worker 的资源请求：全部 HTTP 200；
- 与 3.0 RC/2.4.1 基线逐字节比对：`seed.json`、`seed-report.json`、七份源词表和三个图标完全一致。

最终 ZIP 在更新本报告后再次生成，并重复同一套解压复测。

## 6. 未声称完成

当前环境中的受管 Chromium 无法稳定完成应用 Seed 初始化后退出，因此没有把截图或真实浏览器 E2E 声称为已通过。

仍需用户在实际部署地址完成：

- iPhone Safari 与主屏幕 PWA；
- Safe Area 和虚拟键盘；
- 复制后进入牛津词典、返回原位置；
- PIN 连续导航；
- 真实 Groq 模型刷新、AI 新增和 AI 核查；
- 429/5xx/断网、暂停、取消和部分结果；
- 离线冷启动；
- PWA 更新提示；
- Safari 标签页与主屏幕双实例。
