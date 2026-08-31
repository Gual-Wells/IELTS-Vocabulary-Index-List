# D2：真实联调与剩余接入阻塞

日期：2026-08-31。版本：4.7.3+D.2。基于 D1 延续 D 线，不开始 A/C/B/E，不合并历史报告中的其他尝试路线。

## 结论

Groq 的目录、查词、核查、搜索联想、补充词条与小批量核查已完成有限真实请求验证。修正了一处真实核查误报，以及设置内的状态/请求隔离问题。

**Collins 尚未打通。** 本轮没有取得真实账号词典列表或真实词条 JSON，因此没有声称修复了“获取账号词典”。本包是可继续测试的部分修正，不是 D 线完成或发布认证。

目标仍为 iPhone 17 标准版 / iOS / Home Screen standalone。桌面内嵌 Chromium 的 402×874 视口仅辅助检查，不替代 iPhone 设备、软键盘、安全区域或 WebKit 验收。

## 已修改

1. `v3-ai.js`：核查请求不再发送空的释义/词性占位字段；提示明确只核查实际提供的内容，缺少可选字段不是错误。保留已提供的释义/词性，不修改 Entry，也不将查词与核查混合。
2. `v3-ui.js`：Groq / Collins 各自有状态栏和 AbortController。编辑密钥立即作废旧请求，按请求对象身份隔离 A→B→A；关闭设置也终止两家请求，旧成功和旧失败均不得回写新界面。目录仅在当前设置弹窗暂存，保存规则保持不变。
3. `v3-provider-runtime.js`：可读的 HTML 403 / Cloudflare challenge 与 JSON 鉴权错误区分；HTTP 200 返回 HTML 也不能进入 ready。浏览器 fetch 不可读时保持网络/CORS/服务验证的未确定诊断，不据此认定密钥或词典权限失效。不打印上游错误正文、密钥或完整请求 URL。
4. `provider-runtime.css`：状态栏沿用主题文本及 help-text 样式，空状态隐藏，长提示可换行。没有改导航、全局样式体系或数据模型。
5. 版本与 Service Worker/升级桥缓存名同步更新到 D2；测试与人工清单增补。

Collins 继续保留 4.7.3/D1 的 HTTPS `accesskey` 查询参数兼容实现，没有未经验证地切换生产鉴权格式。仍为明确选词典、每次查词一次请求、无自动换词典/重试/缓存，不引入公开代理或新后端。

## 真实请求证据（有限样例）

| 项目 | 结果 | 说明 |
| --- | --- | --- |
| 线上版本核对 | PASS | 用户提供的 GitHub Pages 的 index.html、v3-collins.js、v3-provider-runtime.js、sw.js 与 D1 包逐字节哈希相同。仅这四项验证，不泛称全站已核对。 |
| Groq `/models` | PASS | 浏览器真实账户返回 HTTP 200；语音、守卫和未知能力模型仍不可选。 |
| Groq GPT-OSS-20B 查词 | PASS | abandon，通过严格 schema 并渲染真实结果。 |
| Groq Qwen 3.8-27B 查词 | PASS | take care of，通过 JSON object 模式与本地类型校验。 |
| Groq 单项核查 | 修正后 PASS | 修正前 abandon 被误报缺少词性；修正后带现有释义、空词性返回 ok；recieve 返回 issue 并建议 receive。仅有限语义样例，不保证模型零误报。 |
| Groq 搜索联想/词条建议 | PASS | “环境保护”返回 12 个检索词；天气主题建议返回 2 项。 |
| Groq 批量核查 | PASS | 两个合成 Entry（拼写错词与 content 句式），完成一批结构验证；未对用户词库运行批量写入。 |
| Collins 账号词典 | BLOCKED | 浏览器 legacy query 请求不可读；一次同服务 header 方式诊断也不可读。未获得可解析的 API 响应。 |
| Collins 终端直连 | BLOCKED | HTTP 403、text/html、cf-mitigated: challenge、验证页，无允许跨域响应头。未进入可验证的 JSON 鉴权/目录环节。 |
| iPhone 17 standalone | NOT_RUN | 需要用户真机。 |

网络环境不可混同：本机终端对 Groq 也得到 403，而内嵌浏览器同一用户密钥能取得 200。Collins 的失败不能推断所有网络/设备都失败，也不能据此判断密钥无效或授权词典为空。

## Collins 需要的下一项依据

[官方 REST 路由文档](https://api.collinsdictionary.com/api/v1/documentation/html/)列出 GET dictionaries 与 search/first 的路由和参数，但当前可取得内容没有足以确认该账号鉴权和浏览器接入条件的说明。[官方申请页面](https://www.collinsdictionary.com/collins-api)要求申请需要的词典产品。因此仍需账号接入邮件/控制台官方示例，或供应商确认当前 endpoint、鉴权方式、允许来源、网络验证要求与词典授权。

这些信息不应包含密钥。不要把密钥发给公共 CORS 代理，不使用 no-cors 冒充成功，不用抓取官网页面替代账号词典 API。如果供应商只允许服务端调用，需要另行确认受控后端及部署授权；GitHub Pages 前端改动不能赋予上游跨域权限。本轮没有创建或部署后端，也未修改远端 GitHub 仓库/Pages 设置。

## 本地回归

- Provider Node 测试：23/23 PASS，包含空元数据、HTML/验证页、不泄漏正文、CORS 不可读、无额外重试、body 阶段超时/取消与陈旧结果隔离。
- 原有 core / static / runtime-symbol / runtime-behavior / stress / integration / performance：全部 PASS。
- TypeScript 5.8.3 对全部 js/*.js 显式 checkJs：PASS（不是只依赖会跳过 tsc 的 runtime-symbol 脚本）。
- 本地模拟 UI：两家状态不互盖；Collins A→B→A 的迟到成功不恢复作废目录；旧失败不覆盖新目录；关闭重开设置不受旧模型请求影响，PASS。
- 402×874：无页面横向溢出，设置刷新按钮实测 44px，错误提示换行和原有字体/颜色体系可读，PASS。该结果是辅助检查，不是 iPhone 验收。
- Python layout-contract-check：NOT_RUN（缺少其所需 Playwright 环境；脚本原有 Linux 浏览器路径与当前 Windows 不匹配）。不宣称完整 test:all 命令通过。

## 数据与安全边界

Schema 6 / IndexedDB 5 / Seed 4 / VIX JSON 2 不变。原始词库、PIN、关系/学习状态机制未变；D1 文件保留为历史报告，不改写其当时的 NOT_RUN 结论。

真实联调用密钥仅通过对应官方服务请求，QA 的 Storage 为临时内存替身，未写入源代码、交付包或测试凭证文件。测试页面和模拟脚本仅在本地使用，不进入 GitHub 部署包。建议用户测试结束后撤销或轮换在对话中提供的临时密钥。
