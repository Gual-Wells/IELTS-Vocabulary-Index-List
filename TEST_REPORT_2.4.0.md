# Vocabulary Index 2.4.0 — 测试与核验报告

## 结论

静态、模型、数据、模块和本地 HTTP 资源检查全部通过。当前环境不能执行真实 iPhone Safari 或受管 Chromium 页面自动化，也没有使用用户的真实 Groq API Key，因此不声称完成真实 API 和真机端到端测试。

## 自动化覆盖

### 核心数据

- 七份源词表解析；
- 6,421 条原始记录归并为 5,005 个全局唯一词条；
- A1 → A2 → B1 → B2 → C1 → AWL → AVL 归属优先级；
- 来源词性合并、人工改名、来源回落和全局去重；
- JSON 备份结构、来源、归属、词性、PIN、标注和设置一致性；
- 导入解析、CSV 未闭合引号、Markdown 标题边界和 50,000 条模型压力不变量；
- 撤销、重做、初始化、恢复和序号设置软冲突。

### UI 与导航静态回归

- 所有 HTML ID 唯一；
- `ui.js` 引用的元素均存在；
- 普通进入不默认展开字母；
- 显式 accordion、render generation 和导航 generation 仍存在；
- 不存在原生 `<details>`/`toggle` 状态机；
- 词条成功插入后才标记分组已填充；
- 标注审阅栏、全局入口、当前词表入口、上一条/下一条和 AI 核查暂停控件存在；
- 无 `innerHTML`、`eval`、内联事件或动态脚本注入。

### Groq 模型目录

使用 mock localStorage 和 mock fetch 验证：

- 当前选择模型会进入历史目录；
- `/models` 活跃结果排序、过滤并持久化；
- 刷新后保留此前选择但本次未返回的模型；
- 最近活跃列表与历史列表分离；
- 刷新时间被保存；
- 设置页逻辑可以仅依赖缓存打开。

### AI 核查

- 97 条测试词汇按 token 目标和单批数量动态拆分，所有词恰好进入一个批次；
- 输入 token 估算为确定性函数；
- token 余额不足时等待 token reset；
- request 余额接近耗尽时等待 request reset；
- 两种限制同时存在时选择更长等待；
- 429 转换为带状态码和 retry-after 的 `GroqRequestError`；
- 成功响应读取 usage、finish reason 和速率响应头；
- AI 布尔值使用严格 `=== true`，字符串 `"false"` 不会成为异常；
- 运行时代码没有按 Qwen、Llama 或 OSS 名称建立策略分支。

### PWA 和资源

- Manifest `start_url`、`scope` 和图标相对路径；
- 180/192/512 三个 PNG 尺寸；
- Service Worker 版本缓存名为 2.4.0；
- 安装阶段绕过 HTTP 缓存取得统一版本资源；
- 只清理本应用缓存命名空间；
- 全部预缓存资源通过本地 HTTP 返回检查。

## 执行命令

```text
npm test
node --check js/*.js
node --check sw.js
tsc --noEmit --allowJs --checkJs（DOM 模块）
tsc --noEmit --allowJs --checkJs（WebWorker）
本地 HTTP + curl 预缓存资源检查
```

## 未完成项目

- iPhone Safari 和主屏幕 PWA 的视觉、触控和后台生命周期；
- Windows Chrome 的真实响应式视觉检查；
- 真实 Groq `/models`、70B/OSS 核查、429 等待和速率响应头；
- 真机跨词表标注审阅；
- 剪贴板、iOS JSON 下载和牛津快捷指令；
- 真实双实例并发。

请使用 `tests/MANUAL_CHECKLIST.md` 完成部署后验收。
