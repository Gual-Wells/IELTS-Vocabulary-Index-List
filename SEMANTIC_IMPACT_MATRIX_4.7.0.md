# Vocabulary Index 4.7.0 全相联影响矩阵

| 变更 | 数据世代 | 产品语义 | 运行时影响 | 关键回归门 |
|---|---|---|---|---|
| Safari History Rail → Single Slot | 无 | VIX Back/Home 语义不变 | 删除内部 push/traverse/UA restore | 10+ 层递归仍只用 App Back；无 deep pure-color VIX history |
| VIX Back/Page Push motion | 无 | hierarchy 可视化 | View Transition root surface | Push/Pop 空间反向、无二次 scroll |
| Home Hierarchy Reset | 无 | Root reset 独立于 Back | 独立 motion token | 一次清栈，不播 Back×N |
| Word↔Phrase Sibling Swap | 无 | 同 Collection 同级投影 | named content-plane VT | Target TOP+collapsed，Chrome 不整页横移 |
| Alphabet↔Date Reindex Morph | 无 | 同内容重建组织坐标 | named content-plane VT | Target TOP+collapsed；Sticky 几何只最终切一次 |
| Alphabet semantic axis | 无 | 相邻逻辑字母等权 | flow-anchor physical↔ordinal logical mapping | 高度极不均匀时相邻字母 semantic gap 仍=1 |
| Continuous LetterRail locus/camera | 无 | 页面→字母栏单向实时跟随 | 动态 locus + camera | 无 first/second guard hard snap |
| Persistent manual LetterRail | 无 | 横滑字母栏不动正文 | manual lock until page Y changes | pointerup 后不复原；下一次 page motion 才接管 |
| Target Geometry Prewarm | 无 | 到达语义不变 | motion 前目标 Chunk/anchor 准备 | A→…→X 无 W/Y 二次重求解 |
| Same-page Semantic Scroll | 无 | 同一空间连续移动 | rAF semantic/physical animator | 不用 crossfade/瞬移，Sticky 自然经过 |
| Cross-page target sequence | 无 | 先进入页，再去目标 | Push → Scroll 两阶段 | B 必先以 TOP 进入，再连续到目标 |
| Modal spring motion | 无 | 临时 context surface | retained modal transform/opacity | 背景几何不变、open 有克制弹性、close 更快 |
| Date Calendar query-only | 无 | Calendar 不跟随正文 | 无动态 calendar camera | 页面滚动不翻月/改 calendar selection |
| Current-page-only state | 无 | 无隐藏四页缓存 | 普通切换清 source/target transient state | 切回 view/mode 仍 TOP+collapsed；Back 唯一恢复旧页 |
| 42/960 virtual tuning freeze | 无 | 无 | 继续 4.6 virtualizer | 长总表性能不显著回归 |
