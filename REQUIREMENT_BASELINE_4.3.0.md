# Vocabulary Index 4.3.0 需求基线

## 0. 版本定位

4.3.0 是 4.2.0 真机第一轮反馈后的运行时收敛版本。它不改变 Vocabulary Index 4.0 数据世代，集中处理四类已经由源码审计、历史设计意图和 WebKit/标准资料共同确认的问题：

1. Alphabet / Date 原生 Sticky 的收起事务在 iOS WebKit 中存在可见中间帧风险；
2. 同一 Collection 的 word / phrase 被错误赋予各自独立 alphabet/date mode；
3. 4.2.0 Root Home 只让旧浏览器历史状态逻辑失效，没有建立真正的单向 destructive navigation 语义；
4. Query、Relation、Custom Modal、native `<dialog>`、PIN/Review Dock 等历史时期呈现机制割裂，尤其 body-fixed modal scroll lock 与 PIN 整行重建存在明确闪烁风险。

本版保持 Backup Schema 6 / IndexedDB 5 / Built-in Seed revision 4 / VIX 2。除本文件明确覆盖的运行时行为外，4.2.0 需求基线继续有效。

## 1. 实现原则

- 不以猜测替代 Debug。能由源码直接证明的事实、能由标准/官方资料证明的平台行为、只能由目标真机证明的 compositor/gesture 行为必须分级记录。
- 重构前必须读取历史源码、生命周期文档和注释，识别旧实现解决过的问题；新实现必须保护旧设计意图，不得因“代码统一”造成业务语义或 iPhone 行为倒退。
- 不为了技术整洁扩大产品边界；本版只重构运行时 Presentation/Navigation ownership，不触碰 Entry/Domain/Collection/Projection/Search/Relation/Provider 业务模型。
- 自动化 PASS 只证明源码/数据/布局契约，不冒充 iPhone 17 standalone 真机验收。

## 2. Sticky Collapse Transaction

1. Alphabet 与 Date 均继续使用真实 heading 的 native `position: sticky`；不得恢复 4.0.1–4.1.0 mirror。
2. Alphabet 的 Sticky top 继续由真实 Top Chrome + 可见 LetterNav 实测几何决定；Date 没有 LetterNav，因此 `--content-sticky-top` 自然等于基础 Top Chrome。不得用 `+52px` 等 magic number。
3. 4.2.0 的 `body.remove() -> requestAnimationFrame -> getBoundingClientRect -> scrollBy -> requestAnimationFrame` 两阶段补偿退出。
4. Date/Alphabet 共享一个 `collapseNativeStickySection()` 事务算法，但各自保留内容状态层：dateKey / letterKey、expanded set、body 构造均不混合。
5. 事务必须先读取全部几何，再在提交阶段执行 collapse + 最终 scroll；提交后不得再以 layout read 计算补偿量。
6. Collapse 时临时 `overflow-anchor:none`，最终 scroll 完成后恢复，并在最终状态持久化 page snapshot。
7. 收起后的视觉不变量：Date heading 位于基础 Top Chrome 下缘；Alphabet heading 位于 LetterNav 下缘。二者统一表示为当前真实 `--content-sticky-top`，而不是统一固定 Y。
8. 不默认使用遮罩/冻结层掩盖闪烁。只有 reduced test 证明单事务提交在目标 WebKit 仍会暴露中间 compositor surface 时，才允许另立后备视觉冻结方案；不得在没有证据时提前增加 presentation layer。
9. “第一次收起最严重”的 WebKit 内部 compositor 子原因目前未被可靠锁定；文档不得伪称已知。修复只针对已经锁定的有害 transaction pattern。

## 3. Collection-level View Mode

1. `alphabet | date` 是 Collection 的组织模式，不属于 word/phrase/content projection。
2. Store API 固定为 `getViewMode(collectionId)` / `setViewMode(collectionId, mode)`。
3. 同一普通 Collection 在 word/phrase 间切换时必须保持同一 mode。
4. 以下仍按具体 viewKind 独立：scrollY、expandedGroups、calendarMonth、recursive page snapshot、手动浏览锚点。
5. 本版**不兼容迁移**旧 `collectionId:word` / `collectionId:phrase` viewMode 状态；不得根据旧状态猜“哪个更可信”。旧 section-keyed mode 不再作为新模型读取来源。
6. 业务数据、API Key、PIN、StudyStamp、Annotation、Entry 等与该设置重构无关。

## 4. Destructive Navigation Stack

### 4.1 产品语义

- `PUSH`：进入新的递归 Collection/Entry 页面。
- `POP`：Back 按钮或 iOS 合法返回手势成功返回上一递归位置后，刚离开的 frame/snapshot 立即销毁。
- 不允许“撤回返回”：被 POP 的页面不得通过 Forward 再恢复。
- 任意路径进入 Home 都满足硬不变量：`current === Home => recursiveStack.length === 0`。
- Home 清的是 Navigation state，不清 PIN、StudyStamp、Annotation、Entry/Domain/Collection、Settings/API Key、手动浏览锚点、数据 Undo/Redo。

### 4.2 Ownership

1. Safari session history 仅作为同文档手势/URL traversal 轨道；VIX 自己的 `navigationStack` 才拥有递归 frame/snapshot。
2. browser history state 只存最小 `{vix, navModel, depth, epoch, navToken}`，不得再存完整 `pageSnapshot`。
3. VIX frame/snapshot 写入 session-scoped navigation state；返回成功后 destructive pop，dead token 加入 discarded set。
4. `history.scrollRestoration='manual'` 在 UI 初始化前尽早设置，避免 UA 和 VIX 同时恢复 scroll。
5. Fresh PUSH 从当前 browser position 建新 history entry；根据 History 语义，新的 push 会截断当前 forward branch，VIX 同步清理已失效 forward bookkeeping。
6. Home 按钮仍一次 traversal 回根；commit 后统一进入 `enterHomeRoot()`，清空 VIX recursive stack 与临时展开/jump state。
7. 旧 4.2 navigation state 不迁移；无法验证的旧 navigation session 直接收敛到干净 Home，不影响业务数据库。
8. Home 不变量不只由按钮/Back 触发：若同文档 hash/外部路由把 URL 直接带回 root，而 VIX recursive stack 仍非空，`renderApp()` 必须先 `enterHomeRoot()` destructive clear，再允许 Home render；不得出现“视觉已是首页但递归 frame 仍存活”。

### 4.3 iPhone 手势防护

1. 合法 Back 尽可能交给 Safari 原生 interactive history gesture；应用不得在该 traversal 上再叠自己的 page transition，避免 double animation。
2. 已 POP 的 Forward 是非法方向。第一层使用启动时预注册的 non-passive edge touch guard，尽可能在 Safari forward gesture 启动前阻止；第二层 Navigation API `navigate` 拒绝 forward/stale destination；第三层 dead-token state guard 保证旧页面数据不能复活。
3. `overscroll-behavior` 不能作为唯一防护，因为 WebKit 仍有 history-navigation 相关未解决行为。
4. 应用启动即存在永久 `navigation-underlay`，颜色与 `var(--bg)` 一致。它不是 history entry、不是按需 render、没有数据和 scroll，只是恒定视觉基底。
5. 禁止在每个 stack depth 前后插 dummy/blank history entry；不依赖 JavaScript synthetic sentinel 作为安全屏障。
6. 非法 edge gesture 的可见反馈只能由常驻轻量 fixed feedback surface 完成；不得临时渲染旧页或空白“页面”。
7. Home root 的 left edge 同样属于非法后退方向；若系统手势可拦截，保持当前 Home/底色连续，不允许退入产品无语义的更早 history。
8. Edge guard 是否能在 iOS 26.5.2 standalone **100% 早于系统 preview surface** 接管，必须真机 reduced test；源码/规范不能冒充该结论。

## 5. Presentation Layer 有边界重构

### 5.1 三种 Surface family

运行时呈现机制只允许收敛为：

- **Popover**：Query、Relation Target；fixed，不锁背景，不改变 document geometry；共用 enter/exit lifecycle，定位算法可不同。
- **Modal**：Settings、Management、Entry Actions、Provider Result、Search、Confirm、Data Exchange 等阻塞式任务；统一 retained custom modal stack。
- **Dock**：PIN、Review；持久 DOM 的上下文停靠栏，不伪装成 Modal。

Toast/task status 仍属 transient surface，但不得自行获得 document scroll ownership。

### 5.2 Modal 必须保护的历史设计意图

1. 4.0.1 retained stack 意图保留：parent modal 是真实 DOM，child 打开时 parent 仅 inert/aria-hidden，不 snapshot/replace；child 关闭后原 parent DOM、输入和滚动位置继续存在。
2. 每层真实 backdrop 保留：depth 1 为 48%，后续 child 为 20%；Topmost card 保持正常 surface。
3. 4.2.0 full-Web backdrop 决策保留：backdrop `inset:0` 覆盖全部 Web drawable viewport；不得恢复 4.1.0 System Shell tint controller。
4. iOS viewport 外 system strip 继续作为平台边界，不用错误 Topbar/theme-color 染色伪造同步。
5. VisualViewport 仍拥有 modal card 可视几何；键盘只改变 card positioning/height，不改变 backdrop ownership。
6. Search/Confirm 不再维护 native `<dialog>` 的第二套 lifecycle，迁入 retained Modal Engine；choiceRequired 仅是 dismiss policy，不另立 Dialog 引擎。
7. 4.0.1 的 `modal-card-pending + double rAF hard reveal` 退出。完整 backdrop+card 一次插入，使用 opacity/transform 进行统一 140ms enter/exit；关闭后等 exit 完成再 remove。
8. 删除 body-fixed scroll lock：Modal 期间不得写 `body.style.position='fixed'`、负 `top` 或 close 时 `window.scrollTo` 恢复。
9. 背景锁定改由：App `inert` + 启动时预注册 `{passive:false,capture:true}` 的 touch guard + backdrop/header/footer `touch-action:none` + `.dialog-body` `pan-y` 与边界阻断共同承担。
10. 不在本轮把整个 App 改成 dedicated scroll container；只有 iOS 26.5.2 reduced test 证明现方案仍漏背景滚动时才升级该架构。

### 5.3 Popover

- Query 和 Relation Target 共用 show/hide、closing、reduced-motion lifecycle。
- Query 继续保留 4.2.0 的 relation-style anchor geometry、12px edge inset、13px vertical gap、Provider 顺序与 Oxford 视觉。
- Relation Target 保留自己的 right-edge anchor 语义。
- 页面滚动时允许立即关闭 popover，避免 trailing surface；普通 close/outside/Escape 使用统一 exit motion。

### 5.4 PIN / Review Dock

1. PIN 状态切换不得 `replaceWith(renderEntryRow(...))` 重建一级 Entry；按钮原位 optimistic update，Store 成功后只更新 Dock。
2. PIN/Review DOM 从启动时即存在，隐藏态用 opacity/visibility/transform/pointer-events，不用 `display:none -> grid` 冷建 box。
3. 第一个 Dock 出现前先准备内容和最终 bottom occupancy，再 reveal；最后一个 Dock 退出后待 exit 完成再释放 occupancy。
4. 44px action hit target、58px bottom toolbar、Home Indicator 语义均保持。

## 6. 保留不变的 4.2/4.0 语义

- Schema6 / DB5 / Seed4 / VIX2；3 Domain / 17 Collection / 6176 Entry / 7574 Membership / 1240 RelationComponent。
- structured/nonStructured、word/phrase/content、priority ownership、系统总表投影、Search fuzzy / Relation exact、Raw/Effective graph、关系四态、Provider order/session、ChatGPT context v2。
- Home wordmark / Global Index Rule / parallel switch / `全局非结构总表`。
- native alphabet/date Sticky containing-block 行为、字母 cell-owned borders、Entry secondary line、日期 StudyStamp 原位刷新。
- 58px bottom toolbar、520ms+350ms longpress、普通文本不可选、编辑控件可选。
- VIX Automaton 不修改；GitHub 不执行写操作。

## 7. 数据版本

- Backup Schema: 6
- IndexedDB: 5
- Seed revision: 4
- VIX: 2
- 4.2.0 → 4.3.0：无业务数据 schema migration；旧 navigation session 和 section-keyed view mode 不做兼容迁移。
