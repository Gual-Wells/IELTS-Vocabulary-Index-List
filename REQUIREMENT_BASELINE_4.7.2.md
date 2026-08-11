# Vocabulary Index 4.7.2 需求基线

## 1. 更新性质

4.7.2 是 4.7.1 的 **Switch Contract Repair / Buffered Semantic Commit corrective release**。本版修复 4.7.1 在引入 Buffered State Commit 时对既有切换动作语义的越界重写：Presentation 可以变化，但手动 Word/Phrase、Alphabet/Date 切换完成后的产品状态必须重新服从 4.6.0 已实现合同。

唯一目标运行环境继续固定为：**iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone PWA**。

数据世代冻结：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 兼容性基线

本版对切换动作采用以下优先级：

1. 4.6.0 已实现的切换后状态语义；
2. 4.7.1 已验证的“old/new 不重叠”Buffered presentation；
3. 4.7.1 LetterRail / Modal / Relation / Pop / Reduce Motion 修订。

4.7.2 **不处理** 4.7.0 引入的 `single-slot-vix-v1` 与 4.6.0 `destructive-v3` 导航模型差异。Single Browser Slot 在本版保持现状并作为独立架构决策项记录，禁止借本次切换修复暗中回滚或继续宣称其与 4.6 导航合同等价。

## 3. 手动 Word ↔ Phrase

普通用户点击底栏 Word/Phrase 切换时：

- 不创建新的 recursive page / Safari history slot；
- 目标 view 从 **TOP** 开始；
- 目标 view 的 letter/date group 与 relation expansion 全部为 **collapsed**；
- 不捕获当前阅读 Entry / letter / date 作为目标邻域；
- Date 模式下沿用目标 view 自己已有的 calendar month 状态，不把来源 view 当前日期映射过去；
- 不维护 Word/Phrase × Alphabet/Date 四份隐藏浏览快照。

4.7.1 的 `transientViewSwitchTarget()` / nearest-letter / nearest-date 映射不得重新进入手动切换路径。

## 4. 手动 Alphabet ↔ Date

普通用户点击排序模式切换时：

- 目标模式从 **TOP** 开始；
- 当前 section 的展开 group 与 relation expansion 全部收起；
- Alphabet → Date 初始月份由目标 section 数据中的**最新有效月份**决定；无有效日期时回退当前年月；
- Date → Alphabet 不恢复原 Alphabet 深位置；
- 不以当前 Entry/日期为 transient anchor。

4.7.1 的 `transientModeSwitchAnchor()` 不再属于现行合同。

## 5. Buffered State Commit

4.7.1 的视觉原则保留：

`OLD visible → OLD fully hidden → semantic state/render/position commit while hidden → NEW reveal`

硬约束：

- old/new 文本零帧重叠；
- 手动 switch 的最终 semantic target 由本文件第 3/4 节决定，Buffer 不得改变结果；
- manual switch 只允许一个 root semantic position transaction，目标为 TOP；
- same-Collection Search/Relation 等精确 Entry target 只允许一个 authoritative Entry position transaction；
- 不显示 spinner，不制造 loading 语义；
- Reduce Motion 下直接 hidden commit / visible。

## 6. Same-Collection 精确目标

Search / Relation / Annotation / PIN / Last 等动作若目标 Entry 位于当前 Collection 的另一 Word/Phrase view：

- 允许在隐藏窗口切换 view 并展开目标 group；
- 目标位置为该 Entry 的标准阅读锚点；
- 必须在隐藏提交阶段完成**唯一一次** semantic landing；
- Buffer 完成后不得再次调用第二次 `jumpToEntry()` 重新求解 viewport；
- 最终 frame snapshot 在 commit 后由当前真实状态持久化。

## 7. 输入串行化

4.7.1 的 `if (bufferedStateCommitInProgress) return` 会静默丢弃切换/导航意图，本版禁止该模式。

- View toggle、Mode toggle、Collection navigation、Back、Home 进入同一 presentation intent queue；
- View/Mode toggle 的目标在**实际执行时**根据当前状态计算，避免 transition 中重复点击使用陈旧 `nextKind`；
- Buffer 期间 Collection 内容保持 inert；Bottom Toolbar 中浏览锚点/回顶/搜索暂时 inert；Word/Phrase 与 Alphabet/Date 两个切换按钮保持可接收后续 toggle intent；
- queued intent 必须串行完成，不并发改写 current frame。

## 8. 失败回滚

- 手动 View switch 在 buffered update 失败时恢复 previous view/frame snapshot 并重绘；
- Mode switch 持久层写入失败时对 view mode / calendar month 做 best-effort rollback，再恢复 previous frame snapshot；
- 原始异常保持 authoritative，回滚失败不得覆盖原异常。

## 9. 冻结范围

4.7.2 不改变：

- Schema 6 / DB 5 / Seed 4 / VIX 2；
- Search / Relation 数据规则、Priority ownership、PIN、StudyStamp、Annotation、Provider session；
- 42 Entry / 960px virtualization；
- 4.4 native Sticky 与 collapse transaction；
- 4.7.1 Pop、Root Home Buffer、Discrete LetterRail、Modal、Relation Local Reveal；
- 4.7.0 新 Collection Push；
- 当前 `single-slot-vix-v1` 导航实现（仅记录为独立待决差异）。

## 10. 真机 P1 门禁

- 深位置手动 Word↔Phrase：第一次可见必须是目标 view TOP + collapsed，且无 old/new overlap；
- 深位置手动 Alphabet↔Date：第一次可见必须 TOP + collapsed；Alphabet→Date 月份必须为目标数据最新有效月份；
- Date 下 Word↔Phrase 不得把来源当前日期映射到目标 view；
- same-Collection Search/Relation 跨 Word/Phrase target 只落位一次，不出现隐藏 landing 后再次滚动；
- 快速连续点击 View/Mode toggle 不静默丢输入、不并发、不出现 boot/Home/白屏；
- Push/Pop/Home/LetterRail/Modal/Relation 保持 4.7.1 手感与行为。
