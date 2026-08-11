# Vocabulary Index 4.7.3 语义影响矩阵

| 区域 | 4.7.2 | 4.7.3 | 语义影响 |
|---|---|---|---|
| Word↔Phrase | TOP+collapsed + opacity buffer | TOP+collapsed + atomic visual commit | 完成态不变；删除闪屏实现 |
| Alphabet↔Date | TOP+collapsed + opacity buffer；IDB写在隐藏窗口 | TOP+collapsed + runtime同步commit；IDB在可见commit之后 | 完成态不变；I/O移出视觉窗口 |
| Home Global | grid 1→0 / replace / 0→1 | atomic replace + 0.97→1 settle | 状态不变；删除局部blink |
| Root Home | App整体fade-to-zero Root Buffer | root atomic commit + 非零轻settle | Home语义不变；不再全屏闪灭 |
| Relation | Row `replaceWith()` + 小Panel动画 | Stable Row Shell + child slot reveal | Relation数据/展开状态不变；DOM identity修复 |
| Virtual Chunk | false→true 单向materialize | placeholder↔materialized/parked 双向 | 产品展开状态不变；DOM resident set受控 |
| A→Z | 已访问chunk持续常驻 | rolling/post-scroll resident sweep | Letter跳转逻辑不变；局部性能修复 |
| Navigation | `single-slot-vix-v1` | 保持 | 已继承现行架构，非待决项 |
| Schema/DB/Seed/VIX | 6/5/4/2 | 不变 | 无迁移 |
