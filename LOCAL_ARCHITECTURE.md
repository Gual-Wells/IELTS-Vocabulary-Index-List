# Vocabulary Index 4.3.0 本地架构

## 1. 架构目标

单设备、local-first、iPhone standalone PWA。优先保证数据身份、投影一致性、单向可恢复递归浏览、稳定 WebKit 几何与低摩擦查询；不为桌面、多端同步或服务端增加额外复杂度。

## 2. 模块

- `js/v3-model.js`：Schema 6 实体、规范化、投影、精确关系组件、搜索、校验。
- `js/v3-db.js`：IndexedDB 5、Seed 4、完整备份、硬断代内容世代替换。
- `js/v3-store.js`：内存状态、Projection、Raw/Effective Relation Graph、事务操作、Collection-level viewMode。
- `js/v3-ui.js`：Home/Collection shell、VIX destructive navigation、Top Chrome/native Sticky、Presentation families、longpress、Search/Provider UI。
- `js/v3-exchange.js`：VIX v2 导入/导出与预检。
- `js/v3-import.js`：文本/CSV/JSON 输入；拒绝旧世代 Full Backup。
- `js/v3-ai.js`：Groq 模型发现、批量 AI 核查、临时词汇查询。
- `js/v3-integrations.js`：Oxford、Collins、ChatGPT 紧凑上下文。
- `js/v3-upgrade.js`：4.x cache bridge；尽早设置 manual history scroll restoration。
- `sw.js`：离线外壳与版本化缓存。

## 3. 数据身份与投影

`Domain → Collection ← Membership → Entry` 是内容事实链。所有 Entry kind 都执行普通 Collection 优先级占有。系统总表为虚拟投影；global 包括全局词汇、全局短语、**全局非结构总表**。稳定全局 content ID 为 `__global_all_content`。

## 4. 关系层

`RelationComponent → Raw Graph → Effective Graph`。Search fuzzy 与 Relation exact 完全分离；Domain `relationExcluded` 与低级词汇开关只做 Effective projection。

## 5. View ownership

- `alphabet/date` 属于 Collection：`viewModes[collectionId]`。
- word/phrase/content 是 projection/viewKind，不各自拥有排序模式。
- `calendarMonth`、expandedGroups、scrollY、browse anchor、recursive snapshot 仍属于具体 Collection + viewKind。
- 旧 `collectionId:viewKind` mode 不参与 4.3 新状态恢复。

## 6. Destructive Navigation

### 6.1 两层 ownership

Safari same-document history 仅保留手势/URL traversal rail；VIX runtime `navigationStack` 才保存递归 frame 与 page snapshot。

Browser history state 只允许：

```text
vix / navModel / depth / epoch / navToken
```

完整 `collectionId/viewKind/mode/calendarMonth/scroll/expanded...` snapshot 保存在 VIX navigation session，而不是 `history.state`。

### 6.2 PUSH / POP / HOME

- Fresh target：先保存当前 frame，创建新 token/frame，`pushState` 最小 browser state。
- Back commit：目标 frame 仍 live 才恢复；离开位置对应 frame destructive pop，token discarded。
- Forward：产品语义一律禁止；Navigation API/edge guard 拒绝，dead token 不可恢复。
- Home：任意路径进入都调用统一 root invariant，清空 recursive stack/expanded/jump state，不清业务数据。
- `renderApp()` 本身也是 root invariant 门禁：同文档 hash/外部 route 直接落到 root 时，只要 recursive frame 仍存在，就先 `enterHomeRoot()` destructive clear，再允许 Home render。
- `history.scrollRestoration='manual'`，VIX 是唯一 page snapshot scroll owner。

### 6.3 Edge safety

- `#navigation-underlay` 从启动即 fixed 常驻 `var(--bg)`，不是 route/history entry。
- standalone 下预注册 non-passive capture edge touch listeners；Home 左边缘和存在 discarded forward 时的右边缘属于 guard 区。
- `navigation.navigate` event 是第二层 traverse guard；dead token 是第三层 state guard。
- 合法 Safari Back traversal 不调用 VIX 自定义 `performPageTransition`，避免系统 swipe 与 App page animation 叠加。

## 7. Top Chrome / Sticky

- 基础 Top Chrome 从 `.topbar/.update-banner/.home-annotation-banner` 连续 DOM rect 实测，不使用 VisualViewport + 固定 72px 混合地板。
- `--sticky-base-top` = 基础 Chrome 底边；alphabet `--content-sticky-top` = base + LetterNav 实测高度；date = base。
- `.letter-heading`、`.date-day-title`、`.date-unmarked-heading` 都是真实 native sticky heading。
- Alphabet metrics + ResizeObserver + 二分查找只负责 active letter；CSS Sticky engine 负责 containing-block push-off/collapsed 生命周期。
- Date/Alphabet collapse 都进入 `collapseNativeStickySection()`：pre-read geometry → single write transaction collapse+final scroll → final snapshot；不再 mutation 后下一帧 measure/scroll compensate。
- 字母栏结构边框属于 button cell；disabled 只改变 glyph color。

## 8. Presentation Architecture

### 8.1 Popover

Query 与 Relation Target 共用 `showPopoverSurface/hidePopoverSurface` 的 140ms enter/exit/reduced-motion lifecycle；各自 anchor geometry 独立。Popover 不锁背景、不改变 document geometry。

### 8.2 Modal

所有阻塞式任务统一 retained custom Modal Stack。第一层 48% backdrop，child 20%；parent layer 真实 DOM 保留并 inert，child close 后恢复原 parent。

Search/Confirm 已迁入该 stack，不再维护 native `<dialog>` lifecycle。完整 layer 一次 append，CSS opacity/transform enter/exit；不再 `modal-card-pending` 双 rAF hard reveal。

Backdrop `inset:0` 覆盖整个 Web drawable viewport；Card 使用 `--visual-*` VisualViewport 几何。`theme-color/#fafafa/default` 保持静态，viewport 外 iOS system strip 不由 DOM 伪同步。

Modal 不写 body fixed/top/restore scroll。背景 lock 由：

- `#app.inert`；
- 启动时预注册 `{passive:false,capture:true}` touch guard；
- backdrop/header/footer `touch-action:none`；
- `.dialog-body { touch-action:pan-y }` + top/bottom boundary preventDefault。

若目标 iOS reduced test 证明仍漏背景滚动，再评估 dedicated app scroll container；当前不改变全局坐标系。

### 8.3 Dock

PIN/Review 是 persistent context dock。DOM 常驻；可见性由 `.dock-visible` 的 opacity/visibility/transform/pointer-events 控制。PIN mutation 只原位更新按钮和 Pin Dock，不重新 render 整个 Entry row。

## 9. Entry / Provider / Input

- Traditional gloss 与 source-domain secondary line 保持同一 Y metric；44px action hit target 不缩。
- Query Provider 顺序 Oxford → Collins → Groq → ChatGPT；Collins/Groq 共享可取消 session。
- Query chooser 使用 relation-style 右缘挂接 + 10px 左退、12px viewport inset、13px 纵向 gap。
- 非编辑文本默认不可选；编辑控件恢复原生选择；长按浏览锚点保持 520ms + 350ms grace。

## 10. Home UI / PWA 生命周期

- 安装名称 `Vocabulary Index`。
- Home topbar 使用独立 serif Product Wordmark；Hero 仍为绿色 eyebrow + “词汇索引”。
- Global scope 使用 Domain 同级 heading + Index Rule。
- 4.3.0 使用独立 SW cache generation；Schema/Seed/VIX 数据世代不变。
