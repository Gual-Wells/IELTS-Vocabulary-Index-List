# Vocabulary Index 4.7.3 审计报告

## 结论

4.7.2 真机反馈暴露两个同源生命周期问题：

1. Word/Phrase、Alphabet/Date、Home Global 以及 Root Home 把“大型稳定对象短暂变透明”当作 Buffer，用户实际只感知到闪烁；
2. VirtualEntryList 只有 materialize 没有 eviction，A→Z 后历史 Entry-row DOM持续常驻，导致 resident set与已访问范围一起增长。

Relation 虽未使用同一个 Buffer函数，但通过 `current.replaceWith(next)` 销毁整个一级表项，再叠加小 Panel 动画，产生相同“结构变化大于动画本体”的闪烁。

## 4.7.3 修复

- `runBufferedCollectionCommit` 退役，改为 `runAtomicCollectionCommit`；
- Manual View/Mode 不再对 `#collection-view` 执行 1→0→1；
- Mode runtime state先同步 hydrate/render/TOP，再执行 durable persistence；
- Home Global原子替换，只保留0.97→1的轻settle；
- Root Home取消整App fade-to-zero，仅对新Home做非零轻settle；
- Relation永久保留 Row shell与 relation slot；toggle不再 `replaceWith()`、不启动root semantic correction；
- 新增 `parkEntryChunk()` / `parkEntryChunksOutsideResidentWindow()`；
- measured height进入layout cache后，远端chunk清空row DOM并重新交由IntersectionObserver；
- semantic scroll运行中周期性rolling sweep，finish/scrollend再次退休远端对象。

## 风险

- DOM park依赖已测量chunk高度作为placeholder几何，真机需验证超长Relation/极端两行词项回访时无明显位置漂移；
- resident sweep会增加少量 `getBoundingClientRect()`，但活跃chunk数应随运行收敛，不能用桌面测试代替iPhone性能门禁；
- Relation grid-row transition在极端长Relation列表下仍需真机确认帧率；
- Atomic switch不再人为隐藏中间状态，因此若WebKit仍在单一commit中暴露异常空帧，应以trace定位浏览器/DOM commit原因，而不是重新加入fade-to-zero。

## 导航生命周期更正

历史4.7.2文档曾把Single Slot写成“待决差异”。4.7.3当前文档更正：`single-slot-vix-v1`是4.7.x已继承并保留的现行架构；本轮无导航决策悬空。
