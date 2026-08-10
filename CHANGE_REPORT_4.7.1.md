# Vocabulary Index 4.7.1 变更报告

## 核心变更

1. 新增 `css/v4.7.1.css` corrective presentation layer；4.7.0 CSS作为历史/基础层继续加载。
2. Push完全冻结；Pop拆出 `282ms + cubic-bezier(.40,.45,.25,1)`。
3. Home从 root View Transition scale 改为 `runRootBufferedCommit()`。
4. Word/Phrase、Alphabet/Date取消 Sibling/Reindex document View Transition和TOP reset，改为 `runBufferedCollectionCommit()`。
5. 新增 transient semantic anchor mapping，在隐藏提交阶段恢复当前阅读邻域。
6. Home global structured/non-structured改为 `.global-grid` local buffer，不再 full Home rerender。
7. LetterRail 删除 `.letter-nav-locus`，取消 UI raw semanticVelocity camera bias，新增 `cameraTargetForActiveCell()` safe-zone算法。
8. Semantic Scroll与LetterRail camera补齐 Reduce Motion直接提交路径。
9. Modal backdrop视觉透明；open使用 `@starting-style`；close缩短为86/102ms；JS retained layer生命周期同步为108ms。
10. Entry relation增加 local reveal，relation target popover在页面导航前 immediate hide。
11. Dock/Popover presentation时长恢复140ms，隔离4.7.0 token泄漏。
12. App/package/SW更新到4.7.1；Service Worker cache generation改为 `v4.7.1-semantic-motion-gate-20260811-1`。

## 未变更

- Schema6 / IndexedDB5 / Seed4 / VIX2；
- Single Browser Slot / navigationStack；
- 42 Entry / 960px virtualization；
- native Sticky；
- Search/Relation/Provider/PIN/StudyStamp/Annotation业务规则；
- 新 Collection Push。
