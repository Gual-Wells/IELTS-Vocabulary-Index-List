# Vocabulary Index 4.4.0 全相联影响矩阵

| 变更 | Data/Seed | Projection/Search/Relation | Navigation/State | UI/PWA | Import/Backup | 主要回归 |
|---|---|---|---|---|---|---|
| Sticky flow anchor | 无 | 无 | final snapshot 时序 | 消除父 border 假设和累计漂移 | 无 | Alphabet/Date、border/padding、bottom clamp |
| Sticky rendering suppression | 无 | 无 | collapse transaction | 长位移 scroll 与 DOM shrink 分离 | 无 | 100/500/1500/3000px delta、fling |
| destructive-v2 identity | 无 | 无 | token/generation 为身份；depth 降级 | Back/Forward/Home transport 重构 | 无 | A→B→C→Back、wrong depth、dead token |
| sync runtime hydration | Settings 持久格式不变 | 无 | Back 不再等 DB 后才 render | 原生 Back 只恢复一次 UI | 无 | mode/calendar/expanded/snapshot |
| UA traversal scroll | 无 | 无 | legal Navigation API Back 让 UA after-transition restore | 减少 DOM rebuild + app scrollTo 耦合 | 无 | swipe/Back button/process recovery |
| Home new generation root | 无 | 无 | 不再 history.go(-depth) | root 左缘 protection | 无 | Home 后旧 generation |
| remove permanent underlay | 无 | 无 | 无 | html/body 成永久 canvas；去 whole-app stacking context | 无 | legal Back visual surface |
| Modal geometry isolation | 无 | 无 | 无 | root overflow/Sticky vars不随 modal 改变 | 无 | Settings/Search/Confirm/nested/keyboard |
| Pure runtime behavior tests | 无 | 无 | classifier 可执行 | 无 | 无 | Sticky math + navigation classifier |

## 明确不受影响

Schema6、DB5、Seed4、VIX2；Entry identity；Membership/priority projection；system totals；fuzzy Search / exact Relation；Raw/Effective graph；relation four-state；Provider session/context；Collection-level mode；PIN/Review Dock；58px toolbar；520ms+350ms longpress；业务 Undo/Redo。
