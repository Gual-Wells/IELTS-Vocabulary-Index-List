# Vocabulary Index 4.2.0 本地架构

## 1. 架构目标

单设备、local-first、iPhone standalone PWA。优先保证数据身份、投影一致性、可恢复递归导航和低摩擦浏览；不为桌面、多端同步或服务端增加额外复杂度。

## 2. 模块

- `js/v3-model.js`：Schema 6 实体、规范化、投影、精确关系组件、搜索、校验。
- `js/v3-db.js`：IndexedDB 5、Seed 4、完整备份、硬断代内容世代替换。
- `js/v3-store.js`：内存状态、Projection、Raw/Effective Relation Graph、事务操作。
- `js/v3-ui.js`：Home/Collection shell、recursive History + Root Reset、Top Chrome 几何、native alphabet/date Sticky、retained Modal Stack、longpress、搜索与 Provider UI。
- `js/v3-exchange.js`：VIX v2 导入/导出与预检。
- `js/v3-import.js`：文本/CSV/JSON 输入；拒绝旧世代 Full Backup。
- `js/v3-ai.js`：Groq 模型发现、批量 AI 核查、临时词汇查询。
- `js/v3-integrations.js`：Oxford、Collins、ChatGPT 紧凑上下文。
- `js/v3-upgrade.js`：4.x cache bridge。
- `sw.js`：离线外壳与版本化缓存。

## 3. 数据身份与投影

`Domain → Collection ← Membership → Entry` 是内容事实链。所有 Entry kind 都执行普通 Collection 优先级占有。系统总表为虚拟投影；global 包括全局词汇、全局短语、**全局非结构总表**。稳定全局 content ID 为 `__global_all_content`。

## 4. 关系层

`RelationComponent → Raw Graph → Effective Graph`。Search fuzzy 与 Relation exact 完全分离；Domain relationExcluded 与低级词汇开关只做 Effective projection。

## 5. 导航与 History

- Fresh Home→Collection：alphabet/top/collapsed/word-first。
- Recursive Back：`pushState` + `pageSnapshot` 恢复 collection/viewKind/mode/calendarMonth/scroll/expandedGroups/relation state。
- Root Home：depth>=2 可见；一次 `history.go(-appNavigationDepth)` 回 root，同时递增 `navigationEpoch`。旧 epoch（包括 0/升级前状态）在 `popstate` 中不再可恢复。
- Root Home 清理 Navigation History/临时 expanded/jump/homeScroll，不清业务 Undo/Redo、PIN、StudyStamp、Annotation、Settings 或手动浏览锚点。

## 6. Top Chrome / Sticky

- 基础 Top Chrome 从 `.topbar/.update-banner/.home-annotation-banner` 连续 DOM rect 实测，不使用 VisualViewport + 固定 72px 混合地板。
- `--sticky-base-top` = 基础 Chrome 底边；alphabet `--content-sticky-top` = base + 字母栏实测高度；date = base。
- `.letter-heading`、`.date-day-title`、`.date-unmarked-heading` 都是真实 native sticky heading。
- Alphabet section metrics + ResizeObserver + 二分查找只负责 active letter；视觉吸附、containing-block push-off 和 collapsed 生命周期由浏览器 CSS Sticky engine 负责。
- 字母栏结构边框属于 button cell；disabled 只改变 glyph color。

## 7. Modal / PWA shell

Custom application dialogs 使用 retained stack：父层 DOM 保留/inert，子层有自己的 20% backdrop；第一层 backdrop 48%。4.2.0 不再人工合成 system shell color：`.modal-layer-backdrop` 覆盖完整 Web viewport，Topbar/正文/父 modal 由真实 alpha compositing 自然变暗；当前最上层 card 处于自己 backdrop 之上正常显色。

`theme-color` 与 iOS status-bar style 常态固定为 `#fafafa` / `default`。若 iOS 26.5.2 system strip 位于 Web viewport 外，它可在 Modal 时保持系统色，不再为此污染 Web Topbar。

## 8. Entry / Provider / Input

- Traditional gloss 与 source-domain secondary line 保持同一 Y metric；44px action hit target 不缩。
- Query Provider 顺序 Oxford → Collins → Groq → ChatGPT；Collins/Groq 共享可取消 session。
- Query chooser 使用 relation-style 右缘挂接 + 10px 左退、12px viewport inset、13px 纵向 gap。
- 非编辑文本默认不可选；编辑控件恢复原生选择；长按浏览锚点保持 520ms + 350ms grace。

## 9. Home UI / PWA 生命周期

- 安装名称 `Vocabulary Index`。
- Home topbar 使用独立 serif Product Wordmark；Hero 仍为绿色 eyebrow + “词汇索引”。
- Global scope 使用 Domain 同级 heading + Index Rule，不再有完整淡矩形框。
- 4.2.0 使用独立 SW cache generation，Schema/Seed 世代不变。
