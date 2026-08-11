# Vocabulary Index 4.7.3 需求基线

## 1. 更新性质

4.7.3 是 4.7.2 的 **Presentation Object Lifecycle / Virtual Resident-Set corrective release**。本版不再把短暂“全透明”当作缓冲效果；目标是让稳定对象保持稳定、状态提交尽量原子化，并补齐 VirtualEntryList 的反向退休生命周期。

唯一目标运行环境继续固定为：**iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone PWA**。

数据世代冻结：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 上位兼容合同

4.7.3 必须继续满足 4.7.2 已恢复的 4.6 switch-action 语义：

- 手动 Word↔Phrase：目标 **TOP + collapsed**；Date 使用目标 view 自身 calendar month；
- 手动 Alphabet↔Date：目标 **TOP + collapsed**；进入 Date 使用目标数据 latest-valid-month；
- same-Collection 精确 target：只允许一个 authoritative Entry landing；
- View/Mode/Collection/Back/Home intent 串行，不静默丢输入；
- 4.7.0 Push、4.7.1 Pop/LetterRail/Modal 继续保持。

`single-slot-vix-v1` 是 4.7.x 已继承的现行导航架构，不是 4.7.3 待决事项；本版不得借 Presentation 修复回滚 Browser History Rail。

## 3. Atomic Visual Commit

无真实运动语义的切换不得再执行 `surface opacity 1→0→1`：

- Word↔Phrase 手动切换：DOM/state + TOP commit 尽量在同一 rendering opportunity 内完成；
- Alphabet↔Date 手动切换：先同步 hydrate runtime state、render、TOP commit；持久层写入不得位于任何全透明窗口；
- Home Global structured↔nonStructured：直接原子替换 `.global-grid` 内容；只允许极弱的 post-commit settle，不得先闪灭；
- Reduce Motion 下直接提交。

硬约束：

- `runBufferedCollectionCommit()` 退役；
- 不得通过把大型文字面变为 `opacity:0` 来伪造 Buffer；
- old/new 不允许作为两个同时可见的 snapshot；
- 稳定 Topbar / Bottom Toolbar 不参与局部状态切换视觉消失。

## 4. Root Home

Home 仍保留独立 root 语义，但不得整 App fade-to-zero。

- 清空 VIX recursive stack 与回根语义不变；
- root state/render/scroll 先提交；
- Home/large-title 仅允许非常轻的非零 post-commit settle；
- 不 scale、不 translate、不出现空白中间帧。

## 5. 一级表项 Relation

Relation 是真实的局部结构展开，必须使用稳定 Row identity：

- `.entry-row` / `.entry-primary-shell` 在展开/收起过程中不得销毁重建；
- Row 永久包含 `.entry-relation-slot`；
- 展开只向 slot 插入 Relation child，收起只关闭并清空 child；
- slot 使用局部 grid-row reveal + opacity，Chevron 同步旋转；
- `toggleEntryRelations()` 不得调用 `replaceWith()`；
- Relation toggle 不启动 root ScrollCoordinator correction；
- Chunk measured height 在 transition 完成后更新缓存。

## 6. VirtualEntryList 双向生命周期

4.6 的 42-row chunk / 960px prewarm 保留，但 materialized chunk 不得永久常驻。

新增生命周期：

`placeholder → materialized → parked → materialized`

Park 约束：

- 只退休远离当前 visual viewport 的 materialized chunk；
- resident window margin = `max(1500px, 2.4 × viewportHeight)`；
- park 前保存真实 measured block size 到 `virtualLayoutCache`；
- park 后清空 Entry-row DOM，保留 chunk placeholder/min-height 与 `entryChunkByEntryId` 定位映射；
- ResizeObserver 解除，IntersectionObserver 重新接管；
- focus、Relation transition、当前 jump-selected chunk 不得被 park；
- programmatic semantic scroll 中约每 72ms允许一次 resident sweep；transaction finish 与 user scrollend 必须再次 sweep；
- expandedLetters / expandedRelations 是产品状态，DOM park 不得修改这些集合。

## 7. A→Z 性能门禁

在全局词汇总表连续 A→Z：

- active letter、展开语义、最终落点必须保持 4.7.2 正确逻辑；
- live `.entry-row` / rendered chunk 不得随已访问字母单调累积到全量；
- 已远离 viewport 的 chunk 应转为 `data-rendered="false" data-parked="true"`；
- 回访 parked chunk 必须按缓存高度稳定 materialize；
- 不允许通过自动关闭旧字母来换性能。

## 8. 冻结范围

4.7.3 不改变：Schema6 / DB5 / Seed4 / VIX2、Priority ownership、Search/Relation 数据语义、PIN/StudyStamp/Annotation/Provider、native Sticky collapse、Single Slot Navigation、Push/Pop、LetterRail categorical active/safe-zone camera、Modal retained geometry。
