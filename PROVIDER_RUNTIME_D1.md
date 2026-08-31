# D1 — Provider Runtime 与查询 UI

日期：2026-08-31。基线：用户提供的 4.7.3 源码；工作快照：`4.7.3+D.1`。

## 范围与交付状态

D 线代码及本地验证完成；真实 Provider 联调和 iPhone 真机验收尚未完成，不是已验收稳定版。历史报告与附件仅用于辨认问题，没有整体移植 alpha1，也没有把讨论稿当作已落地实现。

本次只改 Provider 业务契约、传输生命周期、查询/设置 UI 及测试和缓存资源清单。A（Mirror）、C（Seed 5）、B（Session Capsule/远程交互）、E（最终发布收口）均未开始。

## 用户可见变化

### Groq

- 默认“查词释义”：词头、发音/词性、释义、例句与用法。请求不携带现有 gloss / 词性 / 关系作为核查材料。
- 可切换“核查现有内容”：单独传入现有内容，呈现结论、理由与修订建议。
- 两者都是阅读参考，不自动编辑 Entry、不生成标注。原批量 AI 核查仍是独立流程。
- 查询中可取消，完成/取消/失败后可重新查询；可在其上打开设置再返回。
- 模型“能力兼容”与“账号可用性”分开判定。未知、语音、守卫、agentic 模型不会因出现在 `/models` 就被视为可用。

### Collins

- 新增明确的“词典代码”；手动填写或显式获取账号词典后选择。不猜默认词典，不自动轮询多词典。
- 每次查词只请求一次所选词典的 `search/first`，没有后续 entries 请求。
- 保留义项、例句、发音、词性、列表与版权文字，不压平为长文本。
- 用惰性 template 解析，再复制允许的结构与文本。不挂载原始 HTML、脚本、样式、事件属性、图片或可执行链接。
- 404、鉴权、网络/CORS、格式错误有明确状态；不自动重试或转到其他词典。用户可主动重新查询或打开 Collins 网站。
- 目录仅用于本次设置；词典结果只用于本次弹窗，不写 IndexedDB、localStorage、备份或应用缓存，关闭时清空结果 DOM。

### 现有 UI 体系

复用 retained modal 栈、`.field` 表单、现有按钮/字体及 `--surface` / `--text` / `--muted` / `--line` / `--accent*` 色彩变量。新增样式限定于 Provider 区域，未调整根滚动、导航、Sticky、LetterRail、Entry row 或虚拟列表。

Browser 技能的真实页面检查促成了两处细节修正：词典下拉框继承原表单样式，义项列表保留 `list-item` 编号。没有另建视觉主题。

## 模块与运行契约

| 文件 | 职责 |
| --- | --- |
| `js/v3-provider-runtime.js` | 类型化错误、HTTP/JSON 传输、超时、取消、有限重试、单次查询状态 |
| `js/v3-groq-contracts.js` | 精确模型能力表、分用途 JSON Schema、解码与业务校验 |
| `js/v3-ai.js` | Groq 模型目录、查词/核查、搜索/导入建议及原批量核查接口 |
| `js/v3-collins.js` | 旧密钥兼容、显式词典配置、目录获取与单次查词 |
| `js/v3-provider-views.js` | Groq 分区结果视图、Collins 安全结构复制 |
| `js/v3-integrations.js` | 保留 Oxford/ChatGPT，兼容再导出旧 Collins 入口 |
| `js/v3-ui.js` / `css/provider-runtime.css` | 设置草稿、查询状态、用途切换、取消/重试、主题样式 |

HTTP 200 不等于 `ready`：需通过 JSON 读取、完成原因/拒绝检查、字段类型/长度与业务校验、视图构造。取消覆盖响应体读取与重试等待。每个弹窗有独立会话和请求序号，关闭/换用途后迟到响应不能更新当前 UI。

Groq 仅对网络、超时、429、5xx 最多额外尝试 2 次；退避有上限并尊重可接受范围内的 Retry-After，超过等待上限就失败。JSON/Schema 错误、拒绝、截断、401/403 不盲目重试，不偷偷换模型或响应格式。

能力表使用精确 ID：GPT-OSS 20B/120B 使用严格 JSON Schema；Llama 3.1 8B、Llama 3.3 70B、Qwen 3.6/3.8 27B 使用 JSON Object 加本地校验。Preview 明示。此表需维护；实际账号目录需刷新，不能保证内置模型永远在线。

设置刷新是草稿，不保存密钥/选择；保存时才提交。密钥变化使旧账号 active 目录失效。旧不兼容模型保留可见，但查询前拒绝执行，需用户选择可用模型。

## 兼容性不变量

- 保留旧 Groq/Collins 密钥键与 Groq 模型选择键，不要求重录旧密钥。
- Collins 新增 `gualVocabulary.collinsDictionaryCode`；老用户首次需配置，未配时明确提示，不自动猜测。
- Seed、关系、Collection、membership、PIN、学习日期、内容世代不改。
- Backup Schema 6、IndexedDB 5、Seed 4、VIX JSON 2 不变，无新增数据迁移。
- 保留批量核查函数/控制器；返回 Entry ID 必须属于本批次，内容条目不接收词性修订，坏输出不进入批量回调。
- Oxford/ChatGPT 查询及数据交换功能未改。
- 新资源已加入 SW 预缓存；`v3-upgrade.js` 的缓存标识与本次 SW 对齐，避免误删当前缓存。未改变原有用户确认更新方式。
- 数据导出器中的历史 appVersion 元数据维持原状，不在 D 线扩展成全仓版本清理，留 E 线评估。
- 与原始 ZIP 的 274 项 SHA256 基线比较：262 项原文件不变，12 项原文件按 D 范围修改，无缺失文件；Seed/关系/数据核心文件未改。

## 验证结果

Windows 本地环境，浏览器使用模拟响应，不读取真实 Provider 密钥、不发真实 Provider 请求。

| 验证 | 结果 |
| --- | --- |
| `node --test tests/provider-tests.mjs` | PASS，19/19 |
| run-tests / static / runtime-symbol / runtime-behavior / stress / integrations / performance | PASS |
| TypeScript 5.8.3 全量 `js/*.js` checkJs，ES2022 + DOM | PASS，单独实际执行，不是依赖可选检查的跳过逻辑 |
| Seed 基本回归 | PASS，6,176 Entry / 1,240 relation component |
| SW 静态清单 | PASS，43 项、无重复、文件存在、缓存代际对齐 |
| 25 次搜索 / relation / VIX preflight | PASS，约 57.1ms / 8.6ms / 4411.1ms，仅本机参考 |
| 402×874 浏览器 UI | PASS：设置保存/取消、模型过滤、词典获取、查词/核查、嵌套返回、错误/空结果、取消、关闭释放、迟到响应隔离；无横向溢出 |
| Collins 安全渲染 | PASS：2 个义项保留；script/img/href/onclick 未进入结果，模拟脚本未执行 |
| `tests/layout-contract-check.py` | NOT_RUN：缺 Python playwright；脚本还硬编码 Linux Chromium 路径 |
| 真实 Groq / Collins 账号请求 | NOT_RUN |
| iPhone 17 / iOS standalone、软键盘、PWA 安装升级 | NOT_RUN |

19 项测试覆盖契约隔离、严格类型/长度、截断/拒绝/畸形输出、未知模型、旧目录兼容、设置草稿、Collins 单请求与错误不重试、超时/取消/过期会话、批量 ID 与内容语义等。

### 重复浏览器验证

以正确 JavaScript MIME 类型服务 `project`，在**新的本地 origin/端口**打开 `/tests/provider-browser.html`。测试入口复制正式页面壳，先加载 `provider-browser-fixture.js`；正式 index 与 SW 不引用夹具。

夹具用内存 Storage 与假密钥隔离 Provider 设置，不读取真实密钥，禁用本页 SW 注册，拦截 Provider fetch。它不隔离整个 IndexedDB，因此不能使用已有用户词库的 origin。关闭测试页后夹具消失。测试入口不是正式应用入口。

开发者工具可设置 `window.__vixProviderFixture.mode`：`ready` / `invalid` / `empty` / `delay`。`delay` 故意忽略 abort，通过 `window.__vixProviderFixture.releases.splice(0).forEach(f => f())` 释放，检验陈旧响应隔离；`calls` 仅记模拟请求，不记密钥。

## 尚需确认的外部接口

Collins 官方公开 REST 文档确认了目录及 `search/first` 路径；本轮鉴权细节页受访问限制，没有真实账号验证 CORS、授权词典及内容格式。暂保留基线 HTTPS `accesskey` 查询参数兼容方式，不能据此宣称官方鉴权已确认或生产联调已通过。未增加代理、绕过机制或后端。

此兼容方式的密钥随 HTTPS 请求发送给 Collins，仍可能出现在服务端访问记录或开发者网络面板；代码不打印 URL/原始错误体，禁用 referrer、缓存及重定向。上线前应依据官方账号说明确认鉴权、CORS 与授权。若必须增加代理，应先单独确认架构/部署范围。

Groq 也需用选定模型实测查词、核查、批量核查与错误处理；模拟测试不是服务可用性证明。

本轮核对的官方资料：

- [Groq Models](https://console.groq.com/docs/models)：模型范围与目录。
- [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs)：严格 Schema 与 JSON Object 的差别。
- [Groq API Reference](https://console.groq.com/docs/api-reference)：请求/响应字段。
- [Collins API](https://api.collinsdictionary.com/api/v1/documentation/html)：目录及查询路径。

## 后续

先审阅 D1 行为/UI，再按 `tests/MANUAL_CHECKLIST.md` 补齐账号与真机验收。下一条实施线为 A，不自动启动 C/B/E。
