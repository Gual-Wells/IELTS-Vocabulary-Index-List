# Vocabulary Index 4.7.0 本地架构

## Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与 runtime navigation/motion/scroll/virtual state 分离。

## Single-Slot Navigation

4.7 `single-slot-vix-v1`：Browser session history 在 standalone runtime 中只保留一个 VIX root slot。启动期唯一 `history.replaceState()` 归一 root URL；内部页面不得 `pushState` / browser traversal。

`navigationStack` 只保存 live recursive Collection frames。Frame 保存当前离页 snapshot 与 frame-local measured virtual layout cache。Back 直接 POP；Home 直接 clear。kill/reopen 从 Home 开始。

4.5/4.6 的 browserKey/rootBrowserKey/deadBrowserKeys/Navigation API `traverseTo()`/UA history scroll restore 已从 active runtime 退出。`v3-navigation-runtime.js` 只作为历史源码保留。

## Current Page State

不存在 Word/Phrase × Alphabet/Date 四份自动隐藏页面缓存。只有 current presentation 是 live state；跨 Collection 离页时 current state 才被写入 frame snapshot。

普通 sibling/mode switch 清 transient expanded state并创建 TOP+collapsed target；Date target calendar month按当前数据重新初始化。Back hydrate 原 frame snapshot，是唯一旧页恢复路径。

## ScrollCoordinator

`js/v3-scroll-runtime.js` 持有 monotonically increasing epoch / owner / phase / target。`rootScrollToY/rootScrollByY` 是 active UI 唯一 root viewport adapter；stale epoch write被拒绝。

Programmatic owner 包括 semantic Letter/Entry jump、Back restore、Sticky collapse、virtual materialize、study-date refresh、return-top 等。用户自然 touch/momentum仍可取消 app transaction并优先拥有 viewport。

## Semantic Motion Runtime

`js/v3-motion-runtime.js` 纯函数负责：

- cubic Bézier timing；
- A–Z/# ordinal；
- piecewise semantic axis；
- `semanticAtPhysical` / `physicalAtSemantic`；
- semantic/physical duration；
- LetterRail dynamic camera target / exponential approach。

`MotionCoordinator` 当前由 `v3-ui.js` 的 transaction/motion函数承载；motion只消费确定的导航/位置目标，不决定业务状态。

## Alphabet Semantic Axis

每个 `.section-flow-anchor` 提供 natural document Y；A…Z/# ordinal 提供 semantic coordinate。相邻 letter gap固定 1 semantic unit，展开关系/Entry 数量只改变该段 physical slope。

Programmatic letter motion推进 semantic progress，再实时逆映射到 physical Y；整体只有一次 easing envelope。LetterRail locus消费同一个 semantic progress。

## LetterRail

离散 active cell保留ARIA/identity；`.letter-nav-locus` 提供连续视觉位置。camera依据 semantic locus + velocity连续求最小必要横向位移，不再依赖 first/second edge guard。

Manual drag：`manualLocked=true`，pointerup不解锁。只有 `window.scrollY` 相对锁定点发生真实变化，自动 camera才重新接管。LetterRail事件不调用 root scroll。

## Date Calendar

Calendar 只查询/跳转：用户点击日期调用 Date section定位；页面纵向滚动没有回调去修改 Calendar month/active state。Date Sticky与正文独立工作。

## VirtualEntryList / Target Prewarm

42 Entry / 960px prefetch继续冻结。Chunk descriptor保留 estimated/measured size；frame `virtualLayoutCache` 复用真实高度。

可见 motion 前 `prepareSemanticPositionGeometry()` / `materializeChunksAroundScrollY()` 预物化目标 viewport邻域并刷新 anchors。Virtualizer不得直接root scroll。

## Presentation Surfaces

- Push/Pop/Home：root View Transition；
- Word/Phrase、Alphabet/Date：`#collection-view` named `vix-content-plane`，product chrome稳定；
- same-page positioning：不使用View Transition，是真实root scroll；
- Modal：retained DOM transform/opacity spring-like motion；
- Sticky collapse：4.4无动画 rendering-suppression transaction继续冻结。
