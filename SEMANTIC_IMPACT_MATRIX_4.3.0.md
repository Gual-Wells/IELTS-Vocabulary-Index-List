# Vocabulary Index 4.3.0 全相联影响矩阵

| 变更 | Data/Seed | Projection/Search/Relation | Navigation/State | UI/PWA | Import/Backup | 主要回归 |
|---|---|---|---|---|---|---|
| Sticky collapse transaction | 无 | 无 | final snapshot 时序变化 | 收起不再 two-phase 补偿 | 无 | Date/Alphabet、LetterNav/no-LetterNav、首次/连续 |
| Collection-level mode | 无 | 无 | mode 从 viewKind 提升到 Collection | word/phrase 模式同步 | 无业务迁移 | switch word/phrase、calendar 独立 |
| Destructive stack | 无 | 无 | VIX owns frames；POP destroys；Home clears | iOS Back/Forward guard、permanent underlay | 无 | Back button/gesture/Home/Forward |
| Manual scroll restoration | 无 | 无 | VIX 单一 scroll owner | 避免 UA+App 双恢复 | 无 | recursive snapshot |
| Modal Engine convergence | 无 | 无 | parent retained/inert | Search/Confirm 迁入 custom stack；no body-fixed | 无 | nested/keyboard/scroll lock |
| Popover lifecycle | 无 | 无 | 无 | Query/Relation 共用 motion | 无 | anchor/scroll close |
| PIN/Review persistent Dock | PIN 数据语义无变化 | 无 | 无 | no whole-row rerender；persistent box | 无 | first PIN/last unpin/bottom scroll |
| 4.2 保留项 | 无 | 无 | 无 | Query geometry/Oxford/Home visual/native sticky | 无 | 全量 regression |

## 明确不受影响

Schema6、DB5、Seed4、VIX2；Entry identity；Membership/priority projection；system totals；fuzzy Search / exact Relation；Raw/Effective graph；relation four-state；Provider session/context；58px toolbar；520ms+350ms longpress；业务 Undo/Redo。
