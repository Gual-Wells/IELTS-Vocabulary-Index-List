# Vocabulary Index 4.7.1 语义影响矩阵

| 区域 | 4.7.0 | 4.7.1 | 数据/业务语义影响 |
|---|---|---|---|
| 新 Collection | Page Push | **保持原样** | 无 |
| Back | 252ms、与 Push 同 easing | 独立 282ms Pop timing | 无 |
| Home | 双 surface scale Hierarchy Reset | Root Buffered Commit | 无；仍清 recursive stack |
| Word↔Phrase | named VT sibling swap + TOP | 非重叠 buffered commit + transient semantic anchor | 不恢复隐藏历史，只保持本次阅读邻域 |
| Alphabet↔Date | named VT reindex + TOP | 非重叠 buffered commit + transient semantic anchor | 同上 |
| Home global mode | full `renderHome()` 硬切 | `.global-grid` local buffer | 无 |
| LetterRail | continuous 52px locus + velocity camera | 离散 active + safe-zone camera | Alphabet Semantic Axis 内部算法保留 |
| Same-page target | semantic rAF scroll | 保留；Reduce Motion 直接提交 | 无 |
| Modal backdrop | 48% 可见 dim | 透明 interaction backdrop | retained/inert 语义不变 |
| Modal close | 145/165ms 前慢后快 | 86/102ms attention release | 无 |
| Relation expansion | row replace 硬切 | local reveal；无 height animation | 关系数据不变 |
| Relation target popover | 关闭与导航可重叠 | 导航前 immediate hide | 无 |
| Dock/Popover token | 被 240/170ms 连带覆盖 | 恢复 140ms | 无 |
| Reduce Motion | 覆盖不完整 | JS/CSS 同步降级 | Accessibility 修正 |
| Schema / DB / Seed / VIX | 6 / 5 / 4 / 2 | **不变** | 无迁移 |

## 冻结边界

- Search / Relation / Priority ownership / PIN / StudyStamp / Annotation / Provider session 业务规则不变；
- `ENTRY_CHUNK_SIZE=42`、960px prefetch、measured virtual cache不变；
- 4.4 native Sticky 与 collapse rendering-suppression transaction不改；
- Single Browser Slot 与 VIX recursive stack不改；
- 4.7.0 Push CSS/JS 不改。
