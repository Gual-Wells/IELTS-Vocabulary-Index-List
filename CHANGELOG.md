# Changelog

## 5.1.0 — 2026-09-10

- 正式结束 alpha 系列，数据权威固定为 `VIX -> Personal Mirror -> 完整 Seed 世代 -> VIX`；IndexedDB 只承担即时交互与离线性能。
- 发布私有 Personal Mirror ChatGPT Site，以 D1 保存唯一最新隐藏快照与文件元数据，以 R2 保存 Mirror 文件；提供管理、调用与配对页面。
- Site、VIX Function、VIX 数据交换与 Mirror 文件改为版本无关协议/capability，不随应用版本或 Seed 世代无意义升级。
- Mirror Layer 2 选择提交与普通 VIX increment 共用事务，并在成功后自动同步最新快照及文件状态；保留手动同步入口和同步锁。
- 运行模型收敛为单一繁体 `gloss`、Entry 级 `partsOfSpeech`、Entry 上下文 PIN 与 membership 顺序；移除运行时来源目录、来源标签和双释义。
- 页面数据交换只接受 `vix-data-exchange/1` JSON；旧 CSV/TXT/Markdown、CSV 导出和 Schema Backup 入口退出产品路径。
- 删除 Cloudflare Bridge 与旧 Seed 三方增量协调器；撤销/重做、AI 核验、annotations、WebMCP 和 Google TTS 退出产品路径。
- Groq 查询模型与语音模型/voice 分开设置；iOS 使用系统 TTS 兜底。
- 新增当前词表“全部展开”，保留虚拟化；多层页使用递进 inset 与周边悬浮阴影，不使用暗色蒙版。
- 新增下一 Seed 独立固化器和质量硬门禁；量化记录当前 revision 8 的缺失与泛化废话释义，不用机械填充掩盖问题。

## 5.0.0-alpha.14 — 2026-09-08

- iOS/WebKit 将 `G:...` 式 Token 首字母改为小写时，PWA 仅在原值收到 401 后尝试一次大小写恢复；验证成功才写回本机，Bridge 认证规则不变。
- 凭据遮罩只作用于真实输入值，空字段和 placeholder 恢复正常显示；Bridge/Groq 过程与正常状态不再常驻设置页面。
- Bridge 页面不再打开即探测，保存不再同步等待整份 Mirror Context；配置提交后在后台合并同步并预热远程文件目录。
- Groq 查询词与英文例句增加 Google Chirp 3 HD 发音；只有点击播放才经 Bridge 合成，同一结果弹窗内临时复用，关闭即释放。
- Bridge 加密保存 Google TTS Key，新增独立验证、删除与合成端点；状态、保存和测试不会预先合成语音。
- Mirror 文件选择器去掉大型状态卡和空白容器，改为紧凑的路径、搜索与文件行；多文件的选择、查看、当前状态与永久删除保留。
- 远程目录失败时保留本机快照并提醒，不再把不同浏览器缓存或暂时连接失败表现成权威空目录；URL、Token 或实例变化时使不匹配快照失效。
- 恢复最顶层弹窗独占滚动，阻止触摸和滚轮在边界穿透到父弹窗或页面；父层保持原尺寸、清晰度和主题。
- Mirror Context 与导入同时阻断 Unicode replacement character 和纯问号释义；启用释义的目标词域拒绝无有效释义候选。
- 词汇、短语和用法继续同等匹配；低级组件只使用独立审核词库，不绑定 A1/A2。
- Seed revision 8 合并同一内置词条的全部不同释义项，并以 Seed 7 字段基线保护用户修改；Bridge 升级为 1.4.0，Mirror 4、Schema 6 与 DB 5 不变。

## 5.0.0-alpha.13 — 2026-09-08

- iOS Bridge 凭据输入改为非密码语义的遮罩文本框，关闭拼写、纠错和自动大写，降低 Password AutoFill 改写 Token 的可能。
- PWA 同时发送 Bearer 和专用 Device Token 请求头；Bridge 对冲突凭据失败关闭，仅在私有 Worker 日志记录脱敏指纹。
- Bridge 文件目录改为扫描 Durable Object 实际 run 记录，可从丢失的旧索引恢复，并移除 200 份时静默删除旧文件的行为。
- Mirror 选择器改为远程文件夹式目录，支持搜索、状态、更新时间、选择与永久删除；本机目录快照用于即时打开。
- Mirror 提醒和通用 toast 移到整个弹窗栈之上；多条提醒使用叠层视觉，确认当前项后立即显示下一项。
- 设置页的 Bridge 与 Mirror 移到词库和数据之后；函数与个性化指令改为独立集成资源区，不再伪装成普通操作按钮。
- Mirror 输入拒绝 Unicode 替换字符和纯问号释义；旧损坏释义在列表中不再显示为 `???`。
- Bridge 更新为 1.3.0；Mirror 4、Schema 6、DB 5 与 Seed revision 7 不变。

## 5.0.0-alpha.12 — 2026-09-07

- Mirror 管理改为 Bridge 远程文件库：多文件目录、按需读取、审核记录回写与永久删除。
- 首页 Mirror 按钮只控制当前已选文件的开启或关闭；未选择文件时禁用。
- 移除下载请求、手动导入、待审核队列、归档和恢复等旧产品路径。
- 收件轮询只传元数据；管理弹窗先显示再联网；Context 对相同版本与数据修订避免重复上传。
- Mirror 开关不再读取 IndexedDB 或重建全库，关闭时复用结构索引，开启时只构建允许条目的稀疏关系视图。
- 新文件提醒改为不占正文的叠层卡，逐条确认后消失；嵌套父弹窗保持原尺寸和清晰度。
- Bridge 更新为 1.2.0；Mirror 4、Schema 6、DB 5 与 Seed revision 7 不变。

## 5.0.0-alpha.11 — 2026-09-07

- Mirror 4 将词汇、短语和用法设为同等优先级，已有词匹配与库外候选均携带类别、重要度和原文证据。
- Mirror 审核改为材料总开关、两层结果、分类组与单条四级联动；提交后保存为材料库，可独立启用、关闭、归档、恢复和查看来源。
- 低级组件过滤从 A1/A2 词表中解耦，改用经人工审核的 244 项独立闭类词与语法噪声词库；只抑制单词组件关联，不抑制短语或用法。
- Bridge 1.1.0 支持 Mirror 4，并在确认后保留可恢复结果；旧 Mirror 3 运行仍可接收。
- VIX Function 显式以 UTF-8 字节提交 JSON，修复 Windows PowerShell 5.1 将简繁中文转成问号的问题。
- 恢复嵌套弹窗的可见覆盖关系，并统一设置、Bridge、Mirror 与查询弹窗的尺寸、层级和控件风格。

## 5.0.0-alpha.10.5 — 2026-09-07

- 修复完整 23,917 词 Mirror Context 作为单值写入 Durable Object 时触发 `SQLITE_TOOBIG` 的问题。
- Bridge 以不超过 512 KiB 的语料分片持久化，并在全部分片成功后切换活动清单；读取时按原协议透明重组。
- 保留旧单值 Context 的读取兼容；下一次 VIX 同步会自动改用分片，不迁移或清空用户数据。
- Bridge 更新为 1.0.5；Mirror 3 对外协议、Schema 6、DB 5 与 Seed revision 7 不变。

## 5.0.0-alpha.10.4 — 2026-09-06

- 修复 Cloudflare `workerd` 不支持 `redirect: "error"` 导致 Groq 模型目录和查询在发出请求前直接失败的问题。
- Bridge“测试”现在验证输入框中的候选 Groq Key，且测试过程不会保存或覆盖 Key；输入框为空时测试已保存配置。
- Groq 传输异常保留脱敏后的运行时日志，前端仍只接收不含凭据的错误信息。
- Bridge 更新为 1.0.4；Mirror、Durable Object 数据、数据库与 Seed 版本不变。

## 5.0.0-alpha.10.3 — 2026-09-06

- 修复 Groq 保存接口在未验证上游和写后解密时提前报告成功的问题；替换失败会保留旧 Key。
- Bridge 页面区分“安全不回显”和“没有保存”，已保存时显示留空保留状态。

- 修复 Bridge 配置的双重真相：状态检查现在验证 Groq Key 实际可解密，不再把 Durable Object 中“有记录”误报为可用。
- Groq 密钥信封加入非秘密密钥指纹；Worker 版本中的 Master Key 与持久记录不匹配时返回明确错误。
- Bridge 保存改为候选配置链路：验证 Token、探测真实 Groq 模型、上传当前 Mirror Context，成功后才提交本机 URL/Token 与模型目录。
- 从 Bridge 返回设置页时同步真实模型状态，不再保留旧的 500 状态或旧模型目录。
- 查询方式弹窗从历史四列缩为 Oxford、Groq 两列内容宽度。
- 部署流程改为三个 Worker Secret 一次配置、一次 Deploy，并明确 Master Key 不随代码升级轮换。

## 5.0.0-alpha.10.2 — 2026-09-06

- Bridge“测试”从 Token 健康检查升级为完整 Groq 模型链路检查，不再把“已存 Key”误报成“Groq 可用”。
- Bridge 分别报告 Groq Key 无法解密、Bridge 无法连接 Groq与上游 HTTP 错误，替代无意义的统一 500。
- 嵌套弹窗打开时彻底隐藏父弹窗，关闭后恢复原层，消除 Mirror 下方露出设置页按钮的问题。
- 新弹窗强制从顶部开始；Bridge 状态移到操作按钮前，下载入口恢复 VIX 主题颜色并缩短文案。
- Mirror 导入改为 VIX 按钮和文件名，不再显示未整理的原生文件控件与重复标题。
- 查询菜单只在键盘调用时聚焦 Oxford，触摸调用不再留下单个选项的粗重焦点框。

## 5.0.0-alpha.10.1 — 2026-09-06

- Bridge Master Key 最低长度调整为 12 个字符，兼容密码管理器生成的十几位随机密码。
- Bridge“测试”增加明确的进行中、成功提示和 Groq/Mirror 状态，不再把结果藏在弹窗底部。
- Bridge“保存”先验证连接再落本机配置；保存 Groq Key 时显示独立阶段与明确错误。
- Bridge 设置不再顺带上传完整 Mirror Context 或读取收件箱，Mirror 同步回到 Mirror 页面显式执行。
- Worker 声明三个必需 Secret，固定启用 `workers.dev`，并关闭随机 Preview URL。
- PWA 数据结构保持 Schema 6 / DB 5 / Seed revision 7，不触碰现有词库和学习状态。

## 5.0.0-alpha.10 — 2026-09-06

- PWA 回归 GitHub Pages；私域 Worker 与 Access 不再属于产品架构。
- 退役 Collins 与 ChatGPT 查询的全部运行逻辑、查询 UI 和设置 UI；旧 Collins 实现移入独立历史包。
- 新增版本无关的 VIX Bridge：分权 Device/Agent API、Mirror 收件箱、加密 Groq Key 和 Groq 代理。
- 新增 VIX Function 与精确 `VIX:` 任务协议；实现冻结上下文、候选结果和提交确认链路。
- Mirror 候选支持材料、字母、单词三级选择；取消零写入，提交执行一次事务并更新关系。
- Groq 输出收敛为便携回忆：短释义、提示、搭配、用法提醒和多例句；移除发音定位。
- 管理词库拖动改为草稿排序，只有保存才提交，取消不修改数据库。
- PWA 更新不重置 Schema 6、DB 5、Seed revision 7 或个人学习状态。

## 5.0.0-alpha.9 — 2026-09-05

- Collins 失败响应带回不含密钥、查询词与正文的精简诊断，不再依赖 Cloudflare 日志页面。
- 对缺少 `cf-mitigated` 标头的 HTML 403 也执行一次有界备用身份重试。
- 分开识别上游 401、JSON 403、HTML 403 与 challenge，避免把边缘拦截误报成密钥无效。
- 显式启用 100% Workers Logs 采样、持久化与查询串脱敏；设置随仓库部署，无需手工改控制台。
- 把前端构建接入 Wrangler 部署流程，防止源码仓库不含 `dist/` 时部署旧 PWA 资产。

## 5.0.0-alpha.8 — 2026-09-05

- Collins 查词请求改用明确的 VIX 服务端标识，不再依赖 Cloudflare 子请求的默认指纹。
- 仅在 Collins 明确返回 `cf-mitigated: challenge` 时，以第二个透明服务端标识重试一次；其余错误不重试。
- 单次用户查词最多两次上游尝试，但月度配额只扣减一次；密钥继续只放在 `accessKey` 请求头中。
- 增加不含查询词、响应正文与密钥的恢复诊断；保留 `cf-ray` 便于后续向 Collins 核查。

## 5.0.0-alpha.7 — 2026-09-04

- Collins `search/first` 改用官方文档中的无尾斜杠规范路径，并拒绝携带 Secret 跟随意外重定向。
- 识别 Collins 上游的 `cf-mitigated: challenge`，与 Secret 无效、限流、网络失败和非 JSON 响应分别报告。
- Cloudflare Observability 只记录上游状态、内容类型和挑战标志，不记录查询词、URL、响应正文或 Secret。
- 明确当前边界：VIX 不绕过 Collins 的服务防护；若 API 路径持续被挑战，需要 Collins 放行 API 客户端或提供获准的服务端接入方式。

## 5.0.0-alpha.6 — 2026-09-04

- 修复 alpha.5 在 Access 登录后仍返回 `access_required` 的确定性故障。
- 按 Cloudflare Workers Static Assets 的官方边界删除应用内 `ctx.access` 重复检查；Worker-level Access 作为唯一外层认证边界。
- 删除已无意义的本地 Access identity 模拟和 `access-jwt.js`，继续保持固定 `vix-private` Worker、单一 Access 应用与一次性 Secret 配置。
- 保留 alpha.5 的能力识别、健康检查、运行时发布允许列表和可续传首次 Seed 导入。

## 5.0.0-alpha.5 — 2026-09-04

- Collins 改为由单一 Worker-level Access 边界保护，API 仅检查 `ctx.access`，移除应用 AUD 重复校验。
- Worker 固定命名为 `vix-private`，新增运行能力与健康检查接口。
- Cloudflare 静态资源改为 `dist/` 允许列表，源码、工具、测试、报告与源数据不再上传。
- 首次 Seed 导入分批提交、显示进度并可从完整批次恢复。
- Service Worker 只预缓存应用壳，Seed 分片按需读取与缓存。

## 5.0.0-alpha.3 — 2026-09-03

- 修复 Cloudflare Access + Static Assets 下 API 取不到 `ctx.access`/assertion header 导致的 Collins 401；增加已签名 `CF_Authorization` Cookie 回退校验。
- 管理词库拖动改为直接子项事件委托与逐帧排序，避免词域/词表重复监听及 iPhone 布局抖动。
- 将默认蓝色来源链接改为产品内说明卡片与来源摘要。
- Built-in Seed revision 升至 6：计算机术语 1,121 → 1,421，通用英语搭配 50 → 326；已安装 revision 5 的设备也会自动三方合并。
- Cloudflare Worker 标识继续使用 `vix-5-alpha2`，既有 Access、Durable Objects 与 Secret 无需重配。

## 5.0.0-alpha.2 — 2026-09-02

- 兼并 D/A/C/B/E：同源 Collins Worker Bridge、Structural→Effective Mirror、Seed5、Session Capsule、发布闭环。
- Collins 浏览器 Key 退役；固定两本词典；Key 仅存 Worker Secret；Cloudflare Access、一次上游请求和月度硬预算。
- Worker 对 Access JWT 执行 RS256/JWKS、issuer、AUD 与时间声明校验；占位配置失败关闭，伪造头不再具有授权意义。
- 新增 Seed5 13 个通用集合、来源 pin/SHA-256/许可与广泛社区材料策略；22,910 Entry、60,857 Membership。
- 新增 Seed4→当前设备→Seed5 字段级三方迁移、独立迁移备份和单事务回滚。
- 新增 SHA-256 Runtime Seed 分片，消除 43 MB 单文件部署限制。
- 新增 Mirror CURRENT/ACTIVE 生命周期、slot-only Session Capsule、Durable Object capability transport。
- 版本统一为 `5.0.0-alpha.2`；Schema6/DB5/VIX2 保持，Seed revision 升为 5。

## 4.7.3 — 2026-08-11

- 退役4.7.1/4.7.2 opacity-blink Buffered State Commit；Manual Word/Phrase、Alphabet/Date继续4.7.2 TOP+collapsed合同，但改为Atomic Visual Commit；
- Mode切换先同步hydrate runtime state/render/TOP，再执行durable IndexedDB persistence，持久层I/O不再位于全透明视觉窗口；
- Home Global取消34ms fade-out + 52ms fade-in，改atomic card replace + 0.97→1轻settle；Root Home取消整App fade-to-zero；
- Relation改为Stable Row Shell + `.entry-relation-slot`局部accordion；toggle不再`replaceWith()`整个Entry row，也不启动root semantic correction；
- VirtualEntryList从单向materialization升级为placeholder↔materialized/parked双向生命周期；park前保存measured height与layout cache，清空远端row DOM、保留Entry映射并重新observe；
- programmatic semantic scroll增加72ms rolling resident sweep，transaction finish与user scrollend再次退休远端chunk，解决全局总表A→Z后live DOM单调累积；
- 新增`css/v4.7.3.css`、完整4.7.3 Requirement/Impact/Audit/Research/Change/Migration/UX/Manual/Test/iPhone Reduced文档；
- 生命周期表述更正：`single-slot-vix-v1`是4.7.x已继承现行导航架构，不是4.7.3待决事项；
- Schema6 / DB5 / Seed4 / VIX2、Push/Pop/LetterRail/Modal/Sticky与4.7.2 switch semantic contract不变。

## 4.7.2 — 2026-08-11

- 修复4.7.1 Buffered State Commit越权改写既有切换完成态：手动Word/Phrase与Alphabet/Date恢复4.6的TOP + collapsed合同；
- Date下Word/Phrase不再把来源日期映射到目标view；Alphabet→Date重新按目标数据latest-valid-month初始化；
- 删除active manual switch的`transientModeSwitchAnchor` / `transientViewSwitchTarget`及nearest-group映射；
- Same-Collection Search/Relation跨view只在hidden buffer执行一次Entry semantic landing，删除buffer后第二次`jumpToEntry()`；
- 抽取`entryJumpSemanticPosition()`统一标准38% reading-anchor；
- 新增`enqueuePresentationIntent()`，Collection/Back/Home/View/Mode串行，删除busy-time silent return；View/Mode toggle执行时计算实时目标；
- Buffer期间只暂时阻断Collection content与非切换底栏工具，View/Mode按钮可继续排队；
- Manual View/Mode增加失败回滚；runtime tests改为强制4.6 switch oracle并禁止4.7.1 transient contract；
- Service Worker升级到`v4.7.2-switch-contract-repair-20260811-1`，新增runtime-only`css/v4.7.2.css`与完整4.7.2生命周期文档；
- `single-slot-vix-v1`本版保持，但正式记录为相对4.6 `destructive-v3`的独立待决架构差异；
- Schema6 / DB5 / Seed4 / VIX2、42/960 virtualization、4.7.0 Push及4.7.1 Pop/Root Buffer/LetterRail/Modal/Relation不变。

## 4.7.1 — 2026-08-11

- 建立 Semantic Motion Gate：运动只用于真实空间/层级/局部来源关系；representation/category switch退出人为方向动画；
- 4.7.0新 Collection Push完全冻结；Back拆出约282ms独立Pop时序，降低前半程过快完成；
- Home撤销双surface scale Hierarchy Reset，改为Root Buffered Commit；
- Word/Phrase、Alphabet/Date撤销named View Transition + TOP reset，改为非重叠Buffered State Commit；
- 新增transient semantic anchor，在隐藏render/measure阶段保持当前Entry/letter/date邻域，不维护四份隐藏view state；
- Home global structured/non-structured只buffer `.global-grid`，不再full Home硬切；
- LetterRail删除continuous 52px locus与raw semanticVelocity camera bias，改唯一active cell + 38–62% safe-zone camera；
- Modal普通backdrop视觉透明，Card open使用`@starting-style`，close收缩到86/102ms级并同步108ms retained lifecycle；
- Relation Panel新增轻量local reveal；multi-target relation导航前immediate hide popover；
- Reduce Motion覆盖JS semantic scroll与LetterRail camera；4.7.0意外扩散的Dock/Popover token恢复140ms；
- Service Worker升级到`v4.7.1-semantic-motion-gate-20260811-1`；同步完整4.7.1 Requirement/Impact/Audit/Research/Change/Migration/UX/Manual/Test/iPhone Reduced生命周期文档；
- Schema6 / DB5 / Seed4 / VIX2、42/960 virtualization、native Sticky、Single Browser Slot和业务语义不变。

## 4.7.0 — 2026-08-10

- 撤销 Safari History Rail：standalone runtime 只有一个 root browser slot；内部页面不再 `pushState`/`traverseTo`，Back/Home 完全由 VIX recursive stack 执行；
- 新增 `v3-motion-runtime.js`，建立 Alphabet physical↔semantic axis、non-linear timing、semantic/physical duration 与 continuous LetterRail camera；
- Letter/Entry/PIN/Date/Return Top 改为真实连续 root scroll，目标 motion 前先 prewarm 目标 viewport Chunk/geometry；
- 顺序 A→…→X 使用真实 `.section-flow-anchor` 与相邻逻辑字母等权时间坐标，降低尾部 W/X 极端路径 visible reconvergence；
- LetterNav 从 3.5.x instant-nearest/edge-guard 硬跟随升级为 continuous locus/camera；手动横拖不动正文且保持到下一次页面纵向 motion；
- Page Push/Pop、Home Hierarchy Reset、Word/Phrase Sibling Swap、Alphabet/Date Reindex Morph、Modal spring-like open/fast close 建立独立 motion semantics；
- Word/Phrase 与 Alphabet/Date 普通切换继续 TOP+collapsed，并明确不保留四份隐藏页面状态；Date target calendar month重新初始化；
- Date Calendar 明确 query/jump-only，不加入 LetterNav 式实时动态跟随；
- 42 Entry / 960px virtualization、4.4 native Sticky、retained Modal geometry、Schema6 / DB5 / Seed4 / VIX2保持；
- Service Worker cache升级到 `v4.7.0-single-slot-motion-20260810-1`，新增4.7 CSS/motion runtime precache；
- 同步新增4.7 Requirement/Impact/Audit/Research/Change/Migration/UX/Manual/Test/iPhone Reduced生命周期文档。

## 4.6.0 — 2026-08-10

- 建立 ScrollCoordinator 单一 root-scroll ownership；所有旧异步 scroll writer 通过 epoch 失效，Virtual Chunk 不再自行 `scrollBy()`；
- LetterNav 改用 4.4 `.section-flow-anchor` natural coordinate，active-letter/Sticky/reading viewport 统一 ContentTop；
- 42-entry / 960px lazy virtualization 保留，新增 stable chunk key、frame-local measured-height cache 和 batched materialization；
- frame snapshot 增加 semantic position，`scrollY` 降级 fallback；Navigation API Back 改为 `scroll:manual` + `event.scroll()` first pass + semantic verify/correction；
- transaction 完成前禁止 authoritative scroll snapshot 持久化；Sticky collapse 接入 coordinator lease，但 4.4 几何/Rendering suppression 算法不改；
- Search cross-Collection PUSH 前 hard-close transient Search surface 并经过一个 presentation fence，降低 stale native history snapshot；
- Service Worker 首次 `clients.claim()` 不再触发 reload，只有显式“立即更新”armed controllerchange 才 reload；
- 4.5 `destructive-v3` Navigation、4.4 Modal/Sticky/whole-app stacking removal、Schema6 / DB5 / Seed4 / VIX2 全部冻结。

## 4.5.0 — 2026-08-10

- 4.4.0 `destructive-v2` 导航实现整体撤销，重建为 `destructive-v3`：VIX logical stack 与 Safari browser rail 分离；
- Collection 成为唯一 recursive frame；word/phrase、alphabet/date、同 Collection Search/Relation/PIN/Annotation 定位全部不再创建 history slot；
- browser rail identity 改用 `NavigationHistoryEntry.key`，App Back/Home 改为 `navigation.traverseTo(key)`；不再混用 `history.state` 与 `NavigationDestination.getState()`；
- 真正跨 Collection PUSH 在用户操作同步调用栈内立即 `history.pushState()`，随后捕获 UA key；Home mode 持久化与 Modal exit 不再位于 PUSH 前；
- Home 不再 PUSH 新 ROOT2：精确 traverse 回原 root，commit 后清 live frames 并将旧 keys 标记 dead Forward；fresh PUSH 由浏览器自然截断 Forward branch；
- Navigation API 与 popstate 改成互斥 traversal owner，删除 4.4 token+1200ms 双事件消重；
- runtime live history slot 不再 `replaceState()`；仅 boot root 初始化允许一次 replace，然后捕获 root key；
- Renderer 不再依据 URL/hash 反向 destructive clear；identity mismatch 不再按 depth 猜 frame；
- 删除 orphaned 70ms page transition timer与 Search 140ms 后置导航；
- 4.4 真机已通过的 Sticky、Modal 与 whole-app stacking-context removal 全部冻结；Schema6 / DB5 / Seed4 / VIX2 不变。

## 4.4.0 — 2026-08-10

- Sticky 收起改用真实 in-flow anchor 几何，消除父 1px border 导致的累计上移；
- 长位移 collapse 改为 scroll-settle → collapse，支持时使用无动画 View Transition rendering suppression，退出 4.3 同步 DOM shrink + root scrollTo；
- Navigation 升为 destructive-v2：generation+token 为身份，depth 降级为诊断，snapshot persistence 不再改写 browser token；
- Back 恢复同步 hydrate runtime state、单次 render，随后异步 persistence；Home 改新 generation root PUSH，不再 history.go(-depth)；
- Forward/stale destination 由 Navigation API + 实际右邻 edge guard 拒绝，不再 commit 后 history bounce；
- 删除 permanent navigation underlay 与 whole-app stacking context；
- Modal 不再改变 html/body modal class/overflow，并拆分 modal/page viewport geometry；
- 新增 Sticky geometry / Navigation classifier 纯 runtime 模块与行为测试；
- Schema6 / DB5 / Seed4 / VIX2 及业务语义不变。

## 4.3.0 — 2026-08-09

- Sticky collapse 从跨帧 remove/measure/scroll 补偿重构为 Date/Alphabet 共用 pre-read + 单提交事务；保留 native Sticky 与 LetterNav 动态几何。
- alphabet/date mode 提升为 Collection-level；word/phrase 共享 mode，页面位置类状态继续 viewKind 独立；不迁移旧 section mode。
- 建立 VIX destructive navigation stack：Back POP 销毁离开 frame，Home clear all recursive state，Forward/stale destination 三层防护；browser history 只保存最小 token/depth/epoch。
- 增加常驻 `navigation-underlay` 与 standalone edge guard；启用 `history.scrollRestoration=manual`。
- Presentation 收敛为 Popover/Modal/Dock；Search/Confirm 迁入 retained custom Modal Stack。
- 删除 body-fixed modal scroll lock 与 double-rAF hard reveal；保留 parent DOM、48%/20% backdrop、VisualViewport geometry、full-Web backdrop。
- PIN 不再 whole-entry rerender；PIN/Review Dock 改常驻 DOM reveal/exit。
- 同步 4.3.0 需求、UX、架构、审计、调研、迁移、手册、测试、影响矩阵与 iPhone reduced-test 文档。
- Schema6 / DB5 / Seed4 / VIX2 与 4.0.0 业务语义不变。

## 4.2.0 — 2026-08-09

- Alphabet Sticky 从独立 mirror 回归真实 `.letter-heading` native sticky；浏览器恢复 collapsed 自然退出、section-bottom push-off、真实点击锚点与 section side rails；JS metrics 只负责 active 字母；
- Query chooser 改为 relation multi-target 风格右缘挂接，再左退 10px；viewport inset 12px，浮层与 Entry 框线 gap 13px；
- Oxford 放弃旧参考图几何忠实，重设计为与 Collins/Groq/ChatGPT optical bounds 一致的紧凑 closed-book outline；
- 撤销 4.1.0 System Shell Surface 动态染色实验；custom/native backdrop 恢复 full Web viewport，不再运行时修改 theme-color/root/topbar；
- Home `Vocabulary Index` 顶栏使用独立 serif Product Wordmark；Hero 大字“词汇索引”保持；
- `全局` 标题恢复 Domain 同级 15px/740，删除 3.x 遗留淡完整矩形框，改为标题与动作之间的轻量 Index Rule；
- Topbar 新增 Root Home：depth>=2 显示 Back+Home；Home 一次回 root，并用 `navigationEpoch` 失效旧 recursive pageSnapshot/forward history 语义，不清业务数据或 Undo/Redo；
- 保留 4.1.0 的字母 cell border、parallel switch、PWA 名称、全局非结构总表、Entry secondary gap、日期 StudyStamp 原位刷新；
- 新增 `css/v4.2.0.css`，Service Worker cache generation 升级 4.2.0；同步完整生命周期文档。

## 4.1.0 — 2026-08-08

- Top Chrome 以真实 DOM rect 为唯一几何源，删除 VisualViewport + 72px 混合硬下限；字母栏未真实吸顶前不展示 Sticky mirror；
- 字母栏重构为按钮单元格拥有结构边框：每格 top/right/bottom，首格 left；disabled/empty 只灰前景，不灰结构线；
- 字母 Sticky 补齐结构边界，日期/字母模式共享统一顶部几何；
- 日期模式刷新学习日期继续保持当前 viewport，不恢复 `study-date` 目标跳转；
- Query chooser 使用明确 viewport edge inset；Oxford 严格按用户参考图重绘“合上的书”SVG；
- 一级 Entry secondary line 再收紧，繁体与来源保持同 Y，操作触控尺寸不缩；
- Home 全局区切换改为左侧“上→ / 下←”平行反向箭头图标，管理按钮置右；大字“词汇索引”保留，topbar/PWA 安装名统一 `Vocabulary Index`；
- “全局非结构内容”展示名更新为“全局非结构总表”，稳定 ID/Schema/Seed/VIX 不变；
- Modal system shell 改为按 retained stack depth 逐层 alpha compositing（48% 第一层、20% 后续），同步 theme-color/root/fixed topbar，custom backdrop 从 topbar 下缘以下开始，避免双重蒙版；
- 新增 `css/v4.1.0.css`，Service Worker cache generation 升级 4.1.0；同步完整生命周期文档。


## 4.0.2 — 2026-08-08

- 修正 4.0.1 字母 Sticky 几何：内容顶部边界统一为基础 Chrome 实测底边 + 字母栏实测高度，不再依赖字母栏瞬态 flow 位置；
- 同一边界统一覆盖全局/域/普通 Collection 与 word/phrase/content，消除 Sticky 被字母栏遮挡和同源镂空；
- 日期模式刷新学习日期保持当前视口，不再自动跟随被刷新 Entry 跳到今天；
- Query chooser 再左移并保证右边框露出；Oxford 重绘为闭合书本，四 Provider 统一深色描边；
- Modal 打开/关闭同步 theme-color 与页面底色到第一层蒙版合成色；iOS 26.5.2 若仍保留 DOM 不可达顶部状态条，作为 WebKit 平台限制记录；
- Schema 6 / DB 5 / Seed 4 / VIX 2 与全部 4.0.0 业务语义保持不变。

## 4.0.1 — 2026-08-08

- 真机反馈收口：重建 Sticky 为普通分组标题 + 单一展示层 + metrics 二分定位，消除字母栏镂空与滚动扫描迟滞；
- `app-dialog`/action 改为 retained modal stack，父层 DOM/输入/滚动保留，子层独立 backdrop + inert；
- Settings/管理词库/action 使用受限管理高度，删除无必要常驻说明文字，card 两帧稳定后 reveal；
- 补齐 content normal/two-line/extreme，收紧繁体/来源 secondary row；
- 查询菜单增加 Provider 副字，仅重绘 Oxford/ChatGPT 对齐现有 Collins/Groq；设置 checkbox 改产品视觉；
- Modal Host 改为应用 DOM 全屏遮罩并延伸至 safe-area；状态栏维持 light-page 友好的 `default`，Schema6/DB5/Seed4/VIX2 与 4.0.0 数据语义不变。

## 4.0.0 — 2026-08-08

- 合并原 3.6.0/4.0.0 候选路线为单一 major generation；Schema 6 / DB 5 / Seed 4 / VIX 2，旧导入硬断代；
- Domain 增加 structured/nonStructured 与可逆 relationExcluded；新增“通用英语搭配” nonStructured Domain；
- Entry 扩展为 word/phrase/content，POS/contentType 作为属性；word/phrase/content 全部执行普通表优先级占有；
- PhraseToken 中心关系升级为通用 RelationComponent，全局精确匹配并双向维护；新增默认开启的“关闭低级词汇关联”逻辑过滤；
- 关系导航改为域内唯一／域外唯一／非结构唯一／多目标四态，多目标展示全部有效目标；
- 搜索范围统一，搜索保持 fuzzy 且与 relation exact 彻底解耦；
- 查询入口固定 Oxford → Collins → Groq → ChatGPT；Collins/Groq 使用可取消 session；ChatGPT context 升级 v2 并显著缩短 Shortcut URL；
- fresh Home→Collection 固定 alphabet/top/collapsed/word-first；recursive Back 继续恢复完整页面快照；
- dialog 去全屏 shell，sticky 使用统一 DOM 几何，longpress 增加 350ms invisible grace；普通 UI 文本默认不可选，编辑控件白名单恢复；
- bottom toolbar 保持 58px 视觉尺寸且不恢复 Home Indicator 白带；来源 secondary Y 与繁体释义统一；
- Home Screen PWA icon 改为 Vocabulary Index `V`；
- 同步 4.0.0 生命周期、架构、数据、UX、迁移、测试与影响矩阵文档。

## 3.5.2 — 2026-08-04

- 以唯一可信的 3.5.1 Clean Rebuild 完整包为基线，不引用两份已废弃 3.5.1 错版；
- 一级表项拆为序号、词汇信息栈、控件信息栈，删除来源触发的隐藏繁体释义占位；
- 繁体释义与独立域来源采用一致次级行指标，各自独立扩展并纵向居中，来源单行右对齐省略；
- sticky 小标题与顶部有效底边零缝隙，Overlay 几何更新合并为每帧一次；
- 字母轨道人工横滑改为状态锁，页面顶部 A 与页面底部 # 均不会因固定延迟或边界回弹立即归位；
- 浏览锚点长按达到阈值后先保存、抬手后提示，Pointer Cancel 保留已完成保存但不显示 Toast；
- 底部工具栏试行固定 58px，删除独立安全区白带；禁用按钮只灰化图标，结构分隔线保持原色；
- native dialog 使用稳定全屏根层，内部卡片才跟随 VisualViewport，查询／关系菜单同步避让底部停靠栏；
- 字母／日期、词汇／短语普通切换统一进入顶部且全部分组收起，删除 Entry 映射和目标页旧状态缓存；
- 递归返回快照补充 mode、calendarMonth 和统一 expandedGroups；
- 日期模式的具体日与“未标注”支持展开／收起，年／月保持结构标题；
- Manifest 启动颜色统一为 `#fafafa`，最新 CSS 由 `v3.5.2.css` 替换 `v3.5.1.css`；
- 封装 3.6.0 查询 Provider 与 4.0.0 Seed／Domain 模型为暂定路线，等待 3.5.2 真机验收；
- Backup Schema 5、IndexedDB 4、Seed revision 3、VIX 1 和业务 Seed 保持不变。

## 3.5.1 — 2026-08-03

- 从 3.5.0 完整源码清洁重建，不使用两份已撤回 3.5.1 错版源码；
- 统一主要弹窗的视觉视口 Shell、物理居中标题、内部宽度与滚动所有权；
- 手动模式切换不再恢复目标模式旧位置：正文保持当前 Entry，顶部／日历状态回顶部；
- 原上次位置改为手动浏览锚点：短按跳转、长按保存，滚动和程序跳转不自动覆盖；
- 字母栏改为首尾警戒区提前跟随，加入方向滞回、手势结束同步和 A/# 硬边界；
- 保留并验证字母标题／导航完整展开链，新增运行时符号与 TypeScript checkJs 防截断测试；
- 序号与英文组成主行，繁体释义与英文左边缘对齐；
- 跨域来源改为表项框内右下元信息，与释义共享第二行，不再造成额外顶部增高；
- 无关系条目保留不可见首操作槽，日期和其余控件保持对齐；
- 日历新增外侧双箭头年跳转，单箭头月跳转向内移动；
- Backup Schema 5、DB 4、Seed revision 3、VIX 1 与主体数据模型保持不变；
- 两份旧 3.5.1 包标记为已废弃、警告性历史，不得继续引用。

## 3.5.0 — 2026-08-03

- 保留 3.4.0 的 Schema 5、系统总表具体 Entry 投影、全局计数和序号模型；
- 普通词表拆分为词汇／短语独立视图，分别保存模式、位置和展开状态；
- 恢复任务型底部五项工具栏，顶部字母轨道只包含字母；
- 建立应用内部页面快照和返回栈，修复跨词表返回首页及同页跳转失效；
- 字母跟随取消平滑追赶，真实小标题自身 sticky，删除复制式毛玻璃标题；
- 重写一级表项：序号正文前置、可选日期不占空位、关系按钮回到操作区、删除右侧附着轨道；
- 无释义／有释义条目分别采用紧凑单行／双行，修复长词、短语和横滑裁切；
- 跨域来源副字移到表项边框右上角；
- PIN／标注导航重新设计为完全不透明、紧凑、直角的底部停靠栏；
- 固定弹窗增加 iOS body 固定和 touchmove 边界锁，阻止背景滑动穿透；
- 查询总入口图标保持不变，仅重绘 Oxford／ChatGPT 选项图标并缩小锚定菜单；
- 结构性 UI 改为直角或极小圆角，移除残留渐变、结构阴影、毛玻璃和目标高亮竖线；
- 保留普通词汇的词表优先级占有机制，优先级仍用于宏观词汇归属调配；
- AI 人工标注保护、单任务聚合 Undo、Abort 与增量导入事务等待进一步收口；
- 同步更新 `PROJECT_HISTORY.md` 和 3.5.0 全套交付文档；
- Backup Schema 5、IndexedDB DB version 4、Seed revision 3、VIX 1 保持不变。

## 3.4.0 — 2026-08-03

- 将全局与域内词汇／短语总表统一为具体 Entry 的特殊投影视图；
- 全局跨域同形词与同形短语改为分别显示具体 Entry，按独立域顺序排列，冲突行显示来源副字；
- 全局唯一计数与实际渲染行数分离，并实现连续、字母小标题和日期小标题三套组序号规则；
- 学习日期升级为具体 Entry 状态，完整备份 Schema 升至 5，兼容迁移 Schema 4；
- 搜索改为范围优先，修复普通表、域内表和全局表的结果漏失；
- 关系跳转改为唯一域内、唯一域外、多目标三态，多目标使用锚定扁平选择菜单；
- AI 核查增加真正 Abort、过期结果保护和单任务单条撤销历史；
- VIX 导入增加 Revision 过期保护，歧义裸键按脏归属跳过并报告；
- 新增滚动字母温和跟随、真实 sticky 字母标题及稳定折叠锚点；
- 修复顶栏标题与置顶图标居中，释放无序号和空日期空间，增加可见短语真实溢出升级；
- 首页删除左侧装饰线，并去除全局渐变、系统卡片渐变及廉价阴影；
- 新增 `PROJECT_HISTORY.md`，作为每次完整 ZIP 必带的正式全生命周期交接文件；
- IndexedDB DB version 4、Seed revision 3、VIX 1 和业务 Seed 内容保持不变。

## 3.3.1 — 2026-08-02

- 修复全局词汇／短语总表上次位置作用域及跨模式去重；
- 修复删除、重命名和替换后的孤儿学习日期与失效 Membership；
- 修复 pending jump、重复 render、重复路由和关系不可见目标；
- 修复 iPhone 标注逐条操作、当前词表审阅和全局聚合；
- AI 标注改为局部事务并增加旧 Entry 快照保护；
- 修复首页顶栏、序号遮挡、返回顶部遮挡、顶部透底和覆盖层位置；
- 收口关联附着件、二级跳转、横滑提示、弹窗关闭和管理计数；
- 高危操作改为“下载备份／不下载”选择，两项均继续后续确认；
- Schema 4、Seed revision 3、VIX 1 和业务 Seed 保持不变。

## 3.3.0 — 2026-08-02

- 重构为状态栏安全的固定紧凑导航＋滚动大标题；
- 首页返回恢复离开前的位置，冷启动仍从顶部开始；
- PIN、标注审阅和首页黄色警告条改为不参与布局的覆盖层；
- 分离固定工具区与横向字母轨道，修复“返回上次位置”重影；
- 标题跳转统一停在动态顶部下方，条目跳转使用上部阅读锚点；
- 弹窗按确认、表单、操作、搜索和锚定菜单分别设计；
- 输入窗口默认不聚焦，不自动弹出键盘；
- 一级表项回归紧凑结构，统一预留右侧关联附着轨道；
- 普通词汇和释义单行共同横滑，长短语两行压缩，极限短语使用约 1.5 倍高度双区布局；
- Oxford 与 ChatGPT 合并为双图标查询菜单，传输协议保持不变；
- AI 标注条目采用红色渐变警告，增加当前词表和全局一键撤销；
- Seed 重置改为先下载完整备份、再用小型确认窗确认；
- 统一重绘主要操作、关系、查询、警告和导航图标；
- 保留并扩展分块渲染、关系索引、局部事务和滚动限流性能保护。

## 3.2.0 — 2026-08-02

- 运行目标收敛为 iPhone Safari 主屏幕 PWA；
- 首页字号与层级重构，删除重复 Hero；
- 系统总表增加淡侧向渐变；
- 一级表项改为文本信息行与操作行；
- 长列表分块渲染、SVG 缓存和关系惰性解析；
- 滚动位置追踪与可见性查询优化；
- 移除 sticky 背景模糊；
- 增加 standalone PWA 后台 viewport 恢复防御。

## 3.1.1 — 2026-08-02

- 一级表项新增牛津英汉辞书直接查询；
- 一级表项新增 ChatGPT 新聊天快捷指令集成；
- 新增 `vix-entry-context` v1 条目上下文 JSON；
- 全局聚合项导出全部独立域实例；
- 不修改 Schema、Seed revision 或词库内容。

## 3.1.0 — 2026-08-02

- 新增一级词汇与短语的手动学习日期、日期刷新、日期排序、简易日历、年月日三级标题和未标注区。
- 字母模式与日期模式分别保存浏览位置；复合普通表的词汇区与短语区分别保存两种模式的位置。
- 普通表改为词汇区＋短语区，普通 Membership 同时支持 word 和 phrase。
- 全局与独立域短语总表重新引入字母导航和字母标题。
- 新增普通表双区互跳和页面级返回顶部。
- 总表统一命名，并保持严格单类型。
- 关联跳转只进入普通表；总表只许跳出，不许跳入。
- 全局总表确认为系统聚合投影，不拥有独立新增内容。
- Schema 与 IndexedDB 升至 4，新增 StudyStamps。
- Seed revision 升至 3，将通用英语及计算机术语短语分类到普通表。

## 3.0.7 — 2026-08-01

- 将 544 个计算机术语普通词划分为四个互斥普通词表：计算机基础与系统、软件开发与数据、网络/云与安全、人工智能。
- 保留总词表和唯一短语表，577 条短语不拆分。
- 首页继续使用全局层与独立词域层的视觉封装。
- 首页设置新增统一“数据交换”中心。
- 新增 VIX JSON 内容交换格式，支持全局、独立域、词表三级导入导出。
- 支持增量合并、选定范围完整替换、差异预检、释义冲突处理和自动恢复备份。
- JSON 解析与差异计算移入 Web Worker，提交阶段只进行一次数据库恢复事务。
- 内置 Seed 修订升至 2，既有 3.0.5 数据库可幂等补充四个分类词表。

## 3.0.5

- 首页增加全局与独立词域的视觉封装；
- 新增 1,121 项“计算机术语”内置词域；
- 默认开启繁体释义；
- 支持既有 Schema 3 数据库幂等合并新内置域；
- Collection 支持隐藏内部来源。

## 3.0.4

- 新增全局短语表。
- 固定全局和词域的总表/短语表顺序。
- 短语组成词改跳优先普通词表。
- 新增统一阅读锚点、高亮、准星占位和 SVG 图标。
- 繁体释义改为表项行内显示。
- 关联子项恢复文字复制，跳转使用独立控件。

## 3.0.3 — 2026-08-01

- 修复 3.0.2 高频路径中的整库复制、重复关系计算和 PIN 全量事务。
- 建立词汇—短语、短语—组成词及跨词域同形词内存索引。
- 搜索输入合并执行，并增加性能防回归测试。

## 3.0.2 — 2026-08-01

- 严格分离普通词表的词汇投影与短语表的短语投影。
- 普通词表保留字母分组；短语表改为无首字母标题的平面列表。
- 行内展开双向关系并按字典序排列。
- PIN 改为行内直接操作。
- 删除独立详情弹窗和所有词性展示。
- 修复上次位置跨表跳转和重复入口。
- 搜索增加全部 / 词域 / 词表三级范围。
- 管理页改为拖动排序。
- 增加栈式弹窗返回和 iOS 搜索视口锁定。
- 压缩首页卡片，消除上部过量留白。
- 移除“词项”等重复说明文字。
- 使用独立 3.0.2 Service Worker 缓存。
- 修复空关系面板显示 `null`。
- 取消字母、搜索和关联跳转的平滑等待。
- 搜索不再自动聚焦，减少 iOS 键盘开合抖动。
- 新增全局总表与每个词域的总词表。
- 关联子项从复制改为优先跨表跳转。
- 多实例写入冲突自动同步并重试一次。
- 移除触控残留焦点框与管理器多层边框。


## 3.0.0 — 2026-08-01

- 引入词域、词表、Entry、Membership、短语实体、PhraseToken、繁体释义和 2.x 迁移。
- 引入 Groq 模型目录、AI 新增、分批核查和标注审阅。
# 5.0.0-alpha.4 — 2026-09-04

- 管理词库改为草稿排序，拖动不写库，点击保存时一次性原子提交。
- 删除产品中的 Seed 数据来源入口及公开说明文件，精简设置页说明文字。
- 词表卡片与标题区域不再显示来源副标或回车图标。
- Built-in Seed revision 升至 7：计算机术语 1,421 → 1,583，通用英语搭配 326 → 595。
- 低级词汇关联由 Seed A1/A2 自动生成，从 84 项扩展到 2,303 项。
