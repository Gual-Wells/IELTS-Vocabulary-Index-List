# Vocabulary Index 4.7.0 需求基线

## 1. 更新性质

4.7.0 是 4.6.0 真机反馈后形成的 **Single-Slot Navigation + Semantic Motion + Continuous LetterRail Presentation Architecture**。本版不改变 Vocabulary Index 的数据世代、关系模型、Provider、PIN/StudyStamp/Annotation 业务语义，也不重新设计 4.4 已通过真机的 native Sticky / retained Modal 几何边界。

目标运行环境唯一固定为：**iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone PWA**。不为普通 Safari 标签页、Android、桌面或其他浏览器保留导航兼容分支。

数据世代冻结：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 4.6.0 真机事实

4.6.0 已明显收敛 Back 最终位置、W141 stale callback、Letter target 与 Virtual Chunk ownership；但真机继续观察到：

- 几乎所有硬切换行为仍有一致轻闪，说明正确状态虽能收敛，但用户仍可看到 Prepare/Render/Scroll 的中间 presentation；
- native Safari Back gesture 仍可能显示冻结 Search/pressed state，深层 history snapshot bitmap 被淘汰后仍可能只显示纯背景；
- A→…→X 的极端路径仍可出现较轻的多次位置求解，但最终位置正确；其根因已从“旧 W callback 抢 viewport”转化为“X 接近 document bottom + W 尾部目标邻域后物化改变真实 geometry”；
- 现有 UI motion 语义过轻：Back/Home/新 Collection、同页跳转、Word/Phrase、Alphabet/Date、Modal 全部缺乏与行为语义对应的连续运动。

## 3. Single Browser Slot

4.7.0 正式撤销 4.5/4.6 的 Safari History Rail。

- 启动期只允许一次 `history.replaceState()` 归一化 root slot；
- VIX 内部 Collection recursion 不得调用 `history.pushState()`；
- App Back/Home 不得调用 `history.back/go/forward()`、Navigation API `traverseTo()`；
- Browser URL 可在整个 standalone runtime 保持 root；
- VIX 自己的 `navigationStack` 是唯一 recursive page stack；
- cold start / kill→reopen 固定从 Home 开始，不跨 process 重建 recursive stack。

该决策的产品目的不是“关闭 iOS 原生手势”，而是让 Safari 没有 VIX 内部可遍历 history entry。由此 Safari 50 MiB history snapshot image cache、stale Search snapshot、snapshot→live handoff 与 UA history scroll restoration 不再属于 VIX 内部 Back 路径。

## 4. Current Page Only State

VIX 不得维护 Word/Phrase × Alphabet/Date 四份长期页面快照。

- 当前页面只有一份 live presentation state；
- 仅当跨 Collection 递归进入下一页时，离开页的完整当前状态进入 Back Frame；
- Back 恢复该离开页：Collection / viewKind / mode / calendarMonth（如适用）/ semantic position / expanded groups / expanded relations / active section；
- 普通 Word↔Phrase：目标 view **TOP + 全标题收起**；不得恢复该 target view 过去的隐藏状态；
- 普通 Alphabet↔Date：目标 mode **TOP + 全标题收起**；Date 初始 calendar month 重新按目标当前数据计算，不恢复未打开页面旧月；
- 普通首次进入页面：TOP + collapsed；
- Search/Relation/PIN/Annotation/浏览锚点等显式目标跳转例外：目标页面按目标语义初始化目标分组，并连续移动到精确目标。

## 5. Motion Semantics

运动是产品语义，不是通用淡入淡出：

- 同页 Letter/Entry/PIN/Date/Return Top：真实连续 root vertical scroll；
- 新 Collection：Page Push；
- Back：Page Pop，空间路径与 Push 对称反向；
- Home：独立 Hierarchy Reset，不模拟 Back×N；
- Cross-Collection target：Page Push 到目标页 TOP，完成后再做连续 Semantic Scroll；
- Word↔Phrase：Sibling Projection Swap，只移动 Collection 内容 plane，不伪装成层级 push；
- Alphabet↔Date：Reindex Morph，只移动 Collection 内容 plane，不逐帧拉伸 live Sticky geometry；
- Modal open：scale + fade + restrained spring；close 更快、弱弹性/无 overshoot；
- Sticky handoff：继续由真实 scroll + native Sticky 自然驱动，不额外伪造 fade。

所有 motion 使用非线性 acceleration/deceleration curve；不允许 `transition: all 200ms ease` 成为统一答案。

## 6. Alphabet Semantic Axis

Alphabet 模式建立连续语义坐标：

- 每个真实 `.section-flow-anchor` 提供 letter heading 的 natural physical Y；
- A…Z/# 映射到固定 logical ordinal；
- 任意相邻逻辑字母之间的 semantic distance 固定为 1，不受展开关系、Entry 数量或 Chunk 高度影响；
- 程序性长距离跳转推进 semantic coordinate，再由当前真实 anchor geometry 反映射为 physical Y；
- 因此 A→B 与 B→C 即使物理高度差几十倍，也占相同逻辑进度；整体 A→X 仍只使用一次自然加速—减速 envelope，不对每个字母重新 ease；
- 缺失字母按 ordinal gap 保留逻辑距离，但不创建虚假 DOM heading。

## 7. LetterNav 单向同步

LetterNav 不是页面控制器的反向滚动器。

- 页面纵向 motion → LetterNav 实时平滑跟随；
- 用户横向拖 LetterNav → **不得改变 page scrollY**；
- 用户松手后 LetterNav 保持人工位置，不 timer snap、不 pointerup retarget；
- 只有页面发生下一次真实纵向运动时，manual override 才解除，LetterNav 从当前人工位置平滑重新跟随；
- 点击 Letter cell 属显式导航，可立即释放 manual override 并启动页面 Semantic Scroll；
- 3.5.x 的 `instant nearest / first-second guard` 规则被 4.7.0 正式覆盖；保留“最小必要 camera displacement”思想，但实现为 continuous semantic camera。

## 8. Date Calendar 边界

Date Calendar 只是查询 / 跳转工具：

- Calendar action 可以展开/定位目标 date group；
- 页面自然滚动不得反向更新 calendar month/selection；
- Calendar 不具有 LetterNav 的 active locus、semantic camera 或实时 scroll-follow 职能；
- Date section Sticky 继续是正文自身行为。

## 9. Geometry / Virtual Layout

4.6 基础继续冻结：

- `ENTRY_CHUNK_SIZE = 42`；
- IntersectionObserver prefetch `960px`；
- 首 Chunk 立即 materialize，显式目标 Entry 强制 materialize；
- frame-local measured chunk cache 保留；
- VirtualEntryList 不得直接 root scroll；
- ScrollCoordinator 仍是唯一 root-scroll owner；
- 4.4 Sticky collapse 仍通过 coordinator lease。

新增 **Target Geometry Prewarm**：可见运动开始前先准备目标 viewport 邻域、测量关键 Chunk、刷新真实 letter anchors，并建立稳定 motion geometry；不允许用动画掩盖“边算边纠正”。

## 10. 真机边界

自动测试可以证明 state machine、motion math、single-slot 静态约束、virtual ownership、CSS layout contract；不能证明 iOS 26.5 compositor 帧质量。4.7.0 是否真正消除可见闪烁、X 极端路径二次求解、View Transition + native Sticky 组合问题，仍以 iPhone 17 standalone 真机为最终门禁。
