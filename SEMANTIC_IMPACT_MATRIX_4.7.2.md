# Vocabulary Index 4.7.2 语义影响矩阵

| 区域 | 4.7.1 | 4.7.2 | 语义影响 |
|---|---|---|---|
| Word↔Phrase | buffered + transient letter/date neighborhood | buffered + **TOP + collapsed** | 恢复 4.6 手动切换合同 |
| Word↔Phrase / Date | 来源日期映射到目标邻域 | 使用目标 view 自身 calendar month | 恢复 4.6 独立目标状态 |
| Alphabet↔Date | buffered + current Entry/group anchor | buffered + **TOP + collapsed** | 恢复 4.6 手动切换合同 |
| Alphabet→Date month | anchor Entry 月份优先 | 目标 section 最新有效月份 | 恢复 4.6 规则 |
| Same-Collection target跨view | hidden semantic restore + 再次 `jumpToEntry()` | hidden阶段唯一 Entry landing | 消除双 semantic commit |
| Buffer busy 输入 | `return` / toolbar inert，可能丢意图 | serial intent queue；toggle执行时求值 | 不再静默丢切换/导航动作 |
| Buffer shell | Bottom Toolbar整体 inert | 仅非切换工具暂时 inert；两个切换按钮可排队 | 输入事务修正 |
| View/Mode失败 | 状态可能部分提交 | previous frame / mode/month best-effort rollback | 可靠性修正 |
| Home / Push / Pop | 4.7.1 | 保持 | 无 |
| LetterRail / Modal / Relation | 4.7.1 | 保持 | 无 |
| Navigation model | `single-slot-vix-v1` | **保持，但明确为4.6独立差异** | 本版不裁决 |
| Schema / DB / Seed / VIX | 6 / 5 / 4 / 2 | 不变 | 无迁移 |

## 4.6 兼容 Oracle

本版直接核对 GitHub commit `4e6714062520e199806dae1893b2395312814c7b`（4.6.0）中的 `js/v3-ui.js`：

- `switchCollectionView()`：目标 `scrollY:0`、`position:top`、`expandedGroups:[]`；Date calendar 使用目标 view 的 `getCalendarMonth()`；
- `switchCollectionMode()`：进入 Date 时按目标数据取最新月份，fresh snapshot 为 TOP + collapsed；
- same-Collection target：只通过一个 pending target 进入渲染后的定位链。

4.7.2 只恢复这些切换/目标约束；不把 4.6 Browser History Rail 一并移植回来。
