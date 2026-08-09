# Vocabulary Index 4.3.0 变更报告

4.3.0 从 4.2.0 完整源码建立独立工作快照，不改变 Schema6 / DB5 / Seed4 / VIX2。

## 主要变更

- **Sticky collapse transaction**：删除 Date/Alphabet 旧的 `remove → rAF → measure → scrollBy → rAF` 补偿器；两种模式统一进入 `collapseNativeStickySection()`。所有 geometry 在 mutation 前读取，collapse 与最终 `scrollTo` 在同一提交阶段完成，提交后不再做 layout read；LetterNav 差异继续由 `--content-sticky-top` 实测体系表达。
- **Collection view mode**：`getViewMode/setViewMode` 提升为 Collection-level。word/phrase 共用 alphabet/date；calendarMonth/scroll/expanded/snapshot 继续 viewKind 独立。旧 section-keyed mode 不做推断迁移。
- **Destructive navigation**：新增 VIX-owned `navigationStack`、token、discarded set 与 session-scoped snapshot store。browser history state 只保留最小导航元数据；Back commit destructive pop，Home hard-clear recursive state；`history.scrollRestoration='manual'` 提前接管滚动恢复。
- **Home root invariant**：除 Back/Home 按钮外，同文档 hash/外部 root 路由在 `renderApp()` 入口也先检查 recursive stack；只要目标是 Home 且仍有 live frame，就先 destructive clear，禁止“首页已显示但递归栈仍活着”。
- **Navigation edge safety**：Navigation API 拒绝 Forward/stale traversal；standalone PWA 启动时常驻 non-passive edge touch guard；永久 `navigation-underlay` 与轻量 guard feedback 不属于 History、不按需生成。Fresh PUSH 同步截断已失效 forward branch bookkeeping。
- **Presentation convergence**：Query/Relation 进入统一 Popover lifecycle；阻塞任务统一 retained Modal Engine；Search/Confirm 迁出 native `<dialog>`；PIN/Review 继续 Dock family。
- **Modal lifecycle**：保留 4.0.1 retained parent/child DOM、48%/20% backdrop 和 4.2.0 full-Web backdrop/VisualViewport；删除 `modal-card-pending`/双 RAF hard reveal；新增同步 opacity/transform enter/exit。
- **Modal scroll lock**：删除 `body.position=fixed + top=-scrollY + close scrollTo` workaround。背景锁定由 app inert、预注册 non-passive touch guard、touch-action 与 dialog-body boundary handling 负责。
- **PIN**：删除 PIN mutation 后的整条 Entry `replaceWith(renderEntryRow())`；按钮保持原 DOM optimistic update，Store 完成后只重绘 Pin Dock。PIN/Review DOM 常驻，hidden state 不再 `display:none`。
- **测试**：静态契约升级到 4.3.0，覆盖 collection mode、destructive stack、manual scroll restoration、常驻 underlay、single Modal Engine、无 body-fixed/showModal/double-RAF、PIN no-row-rerender、Popover family；402×874 layout fixture 改为 retained Search/Confirm layer + persistent Pin Dock。

## 明确没有改变

- Entry/Domain/Collection/Membership/Projection/Relation/Search/Provider 数据和业务语义；
- Query 具体位置/Oxford 4.2.0 视觉；
- Home wordmark/Global Index Rule/parallel switch；
- native Sticky containing-block/push-off；
- 58px toolbar、长按、Selection、StudyStamp 等既有规则。
