# Vocabulary Index 4.3.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 目标：iPhone 17 标准版 / iOS 26.5.2 WebKit / Home Screen standalone。自动测试不等于本清单通过；帧级/手势 reduced cases 另见 `IPHONE_REDUCED_TESTS_4.3.0.md`。

## A. 安装与数据边界

- [ ] 页面/设置显示 4.3.0；Home Screen 名称为 `Vocabulary Index`。
- [ ] Entry、PIN、StudyStamp、Annotation、Settings、API Key、用户内容均保留。
- [ ] 旧 4.2 页面导航状态不被复活；进入干净 Home 不影响业务数据。
- [ ] PWA `V` icon、离线启动、进程回收后重开正常。

## B. Collection mode

- [ ] 普通 Collection 词汇页切 Date → 切短语仍是 Date。
- [ ] 短语页切 Alphabet → 切词汇仍是 Alphabet。
- [ ] 两页各自 scroll/展开字母或日期组不被强行同步。
- [ ] Date calendarMonth 在 word/phrase 间仍可独立。

## C. Native Sticky / Collapse

在全局词汇、全局短语、域总表、普通词表/短语、nonStructured content 中抽样：

- [ ] Alphabet heading Sticky 在 LetterNav 正下方；Date heading 在 Top Chrome 正下方。
- [ ] collapsed section 不持续 Sticky；expanded section 到 parent bottom 自然 push-off。
- [ ] 第一次收起 Sticky 不出现字母栏/页面闪现、错误内容一帧、白帧或标题重影。
- [ ] 后续连续展开/收起 20 次同样稳定。
- [ ] 靠近 section 尾部/document bottom、fling/rubber-band 后立即收起仍稳定。
- [ ] Alphabet active letter/横向轨道仍正确。
- [ ] 字母 cell top/right/bottom + first left border 保留；disabled 只灰 glyph。

## D. Destructive Back / Home

构造 Home→A→B→C：

- [ ] Back 按钮 C→B：B snapshot 恢复；C 状态销毁。
- [ ] iPhone 左边缘 Back C→B：只有一次 Safari 原生连续动画，没有 App 第二次 page transition。
- [ ] 从 B 尝试右边缘 Forward：C 不得重新成为可交互/可提交页面。
- [ ] Back B→A 后 B 同样不可 Forward 恢复。
- [ ] A→Home（按钮或手势）后 recursive stack 清空。
- [ ] C 点 Home 一次回首页顶部，不逐层播放。
- [ ] Home 后 PIN/Annotation/StudyStamp/Settings/API Key/浏览锚点/UndoRedo 不变。
- [ ] Home root 左边缘手势不进入产品无语义的更早页面。
- [ ] 在递归页直接把同文档 hash 改回 root（或等效外部 root 路由）后，必须先清空 recursive stack 再显示 Home；随后旧页不得成为有效 VIX 返回目标。
- [ ] POP 后 fresh 进入新页面会截断旧 forward branch 语义。

## E. Navigation visual safety

- [ ] 非法 edge gesture 时没有临时创建的白页/旧页；背景只可能露出常驻 `#fafafa` underlay/轻量 edge feedback。
- [ ] 快速/慢速/半拖取消/连续 edge gesture 不出现跳跃、旧 route 闪现或 URL/页面语义错位。
- [ ] 若仍能看到系统旧 history preview surface，必须记录为目标机平台边界，不得误报为通过。

## F. Popover

- [ ] Query Oxford→Collins→Groq→ChatGPT 顺序、4.2 位置、12px edge inset、13px Entry gap 保留。
- [ ] Relation multi-target 位置不被 Query 统一几何破坏。
- [ ] Query/Relation 打开/普通关闭具有同类轻柔 enter/exit。
- [ ] 页面滚动时浮层立即消失，无 trailing menu。
- [ ] Oxford closed-book 视觉继续与 Collins/Groq/ChatGPT 对齐。

## G. Retained Modal Engine

依次测试 Settings、Manager、Entry Action、Provider Result、Search、Confirm、nested child：

- [ ] 冷启动第一次打开不出现整页闪、白帧、先黑两帧再硬出 card。
- [ ] backdrop 与 card 同步柔和进入；close 动画结束后才移除。
- [ ] 第一层 48% full-Web backdrop；child 再 20%；top card 正常 surface。
- [ ] 父层在 child 下是真实 DOM；关闭 child 后输入值、内部 scroll、状态原样恢复。
- [ ] Search/Confirm 与其他 Modal 使用同一 backdrop/focus/close 语义，不再表现为另一套 native dialog。
- [ ] backdrop/header/footer 上拖动背景不滚；dialog body 可滚且顶/底不向背景链式传递。
- [ ] 打开/关闭 modal 前后页面 scrollY 不跳；body 不出现 fixed/top 复位视觉。
- [ ] Search 键盘打开/关闭时 card 留在 VisualViewport 内，backdrop 仍覆盖完整 Web viewport。
- [ ] iOS system strip 若不随 Web backdrop 变暗，只记录平台边界，Topbar 不人工染灰。

## H. PIN / Review Dock

- [ ] 第一个 PIN：Entry row 无闪/无 whole-row rebuild；PIN button 原位更新。
- [ ] Pin Dock 柔和出现；已有 PIN 间切换/新增连续操作稳定。
- [ ] 页面底部设置/取消最后一个 PIN 不发生 scroll clamp 跳跃。
- [ ] Review Dock 同样为常驻 DOM reveal/exit，不 hard display 闪现。
- [ ] keyboard-visible 时 Dock 隐藏逻辑正确。

## I. 4.2/4.0 既有回归

- [ ] Home wordmark、Hero、“全局”Index Rule、parallel switch+管理、`全局非结构总表`保持。
- [ ] 日期 StudyStamp 刷新保持当前 viewport。
- [ ] Entry Traditional gloss/source secondary line 同 Y；phrase/content two-line/extreme 无破坏。
- [ ] 58px bottom toolbar/Home Indicator 正常。
- [ ] 520ms browse-anchor + 350ms grace 无 selection/callout/click 泄漏。
- [ ] Search fuzzy / Relation exact / 四态关系 / Provider abort/stale protection 正常。
- [ ] 数据交换、备份、Undo/Redo、Seed reset 无回归。
