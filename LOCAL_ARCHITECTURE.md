# Vocabulary Index 4.7.1 本地架构

## Data

Schema6 / IndexedDB5 / Seed4 / VIX2。业务数据与runtime navigation/presentation/scroll/virtual state分离。

## Single-Slot Navigation

继续使用4.7 `single-slot-vix-v1`。Browser session history只保留一个VIX root slot；内部页面不得`pushState`/browser traversal。`navigationStack`保存live recursive Collection frames；Back直接POP，Home直接clear；kill/reopen从Home开始。

## ScrollCoordinator

`js/v3-scroll-runtime.js`继续是唯一root-scroll ownership。Programmatic semantic target、Back restore、Sticky collapse、virtual materialize等都经coordinator/adapter提交；stale epoch write被拒绝。

## Semantic Motion Gate

4.7.1不再把所有状态切换定义为motion family：

- Spatial Motion：新Collection Push、Back Pop；
- Semantic Scroll：同页Letter/Entry/PIN/Date/Return Top；
- Local Reveal：Modal/Relation；
- Buffered State Commit：Word/Phrase、Alphabet/Date、Home global mode；
- Root Buffer：Home；
- Discrete Follower：LetterRail。

## Buffered State Commit

`runBufferedCollectionCommit()`只隐藏Collection content plane；Topbar/Bottom Toolbar保持live。隐藏窗口内执行render、virtual materialize、geometry prepare、transient semantic restore；新内容稳定后才reveal。old/new内容不同时可见，也不调用document View Transition。

`runRootBufferedCommit()`用于Home：旧root context释放，更新Home，topbar/wordmark与main内容在稳定DOM上恢复，无scale/translate。

## Transient Semantic Anchor

普通View/Mode切换不维护四份隐藏历史，也不再强制TOP。切换前一次性捕获当前semantic position/visible entry/group；目标状态隐藏render后映射到同entry、同/近letter或同/近date，restore完成即丢弃anchor。

## Alphabet Semantic Axis

`js/v3-motion-runtime.js`保留A–Z/# ordinal、piecewise physical↔semantic映射与duration/easing。它继续服务programmatic letter motion和semantic position，不再直接生成连续LetterRail选中框。

## LetterRail

UI只有离散active cell。`cameraTargetForActiveCell()`以当前scrollLeft为基准检查38%–62%safe zone并加入3px hysteresis；active cell仍在区域内时camera target保持不动，越界才朝中心重定位。Manual drag lock规则保留。UI active path不再使用raw semanticVelocity。

## Modal / Relation

Modal retained DOM、inert、geometry、focus restoration继续冻结。Backdrop DOM存在但普通视觉透明；Card利用`@starting-style`入场并快速退出。Relation layout直接提交最终高度，只动画relation panel本身，不动画row height。

## VirtualEntryList / Target Prewarm

42 Entry / 960px prefetch冻结。Chunk descriptor与frame-local measured cache保留。可见semantic motion或hidden buffered restore前仍使用`prepareSemanticPositionGeometry()` / materialize helpers；Virtualizer不得直接拥有root scroll。

## Presentation CSS

`css/v4.7.0.css`保留历史基础规则；`css/v4.7.1.css`最后加载，覆盖Pop timing、Letter active、Modal/backdrop、Reduce Motion corrective contract。4.7.0 sibling/reindex/home keyframes可存在于历史CSS，但active UI不再调用对应presentation kind。
