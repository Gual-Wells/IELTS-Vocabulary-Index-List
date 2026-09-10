# Vocabulary Index 4.7.1 需求基线

## 1. 更新性质

4.7.1 是 4.7.0 真机动效审计后的 **Semantic Motion Gate / Buffered State Commit corrective release**。本版不改变 Vocabulary Index 的数据世代、Collection/Entry/Relation/Provider/PIN/StudyStamp/Annotation 业务语义，也不回退 4.7.0 已验证良好的 Single Browser Slot、ScrollCoordinator、Alphabet Semantic Axis、Target Geometry Prewarm 与新 Collection Push。

唯一目标运行环境继续固定为：**iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone PWA**。

数据世代冻结：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 4.7.0 真机事实

4.7.0 的新 Collection Push 用户体验通过；但进一步真机检查确认以下 Presentation 缺陷：

- Back 与 Push 共享 252ms + 极前置 easing，感知上 Back 明显过快；
- Home 双 surface scale 虽流畅，但不符合“结束分支、回到根”的语义；
- Word↔Phrase、Alphabet↔Date 被强行赋予 sibling/reindex 空间运动，并把目标强制为 TOP+collapsed；深页面切换会出现 old/new snapshot 重叠、工具栏被 View Transition layer 覆盖、明显粗糙闪烁，并存在少量“重新出现 boot page → Home”的高风险真机反馈；
- LetterRail continuous locus 与离散字母格的语义冲突，且 raw semantic derivative 驱动 camera bias 会放大微小测量噪声；
- Modal close 前半程视觉存在感过强，可见 backdrop 又抢夺注意力；
- Entry Relation 内容硬展开/硬收起，反而缺少真正具有局部来源语义的运动；
- Home global structured/non-structured switch 仍是硬切；
- Reduce Motion、presentation token 作用域与浮层退出 barrier 存在实现缺口。

## 3. Semantic Motion Gate

4.7.1 不再规定“每一种状态变化都拥有一种 motion family”。任何可见运动先通过语义门：

1. **真实空间/层级关系**：允许 Spatial Motion；
2. **真实对象沿页面移动**：允许 Semantic Scroll；
3. **局部附属 surface 从父对象出现/消失**：允许 Local Reveal；
4. **仅改变表示方式、类别或 root state**：不得虚构方向，使用 Buffered State Commit / Root Buffer；
5. **离散索引状态**：只表达离散 active，不把 fractional semantic progress 直接可视化为选中框。

## 4. Spatial Motion

### 新 Collection Push

4.7.0 Push 视觉与时序冻结，不修改。

### Back Pop

保留 Push 的空间反向关系，但不再与 Push 共用 perceptual timing：

- 目标约 282ms；
- 减少 4.7.0 前半程过快完成的 easing；
- Back restore 仍必须在 new surface capture 前完成，禁止 TOP→restore 二跳。

### Same-page Semantic Scroll

Letter / Entry / PIN / Date / Return Top / relation target 等继续由 ScrollCoordinator 驱动真实 root vertical scroll。`prefers-reduced-motion: reduce` 时禁止自制长距离 rAF motion，直接以准备后的最终 semantic position 提交。

## 5. Buffered State Commit

Word↔Phrase、Alphabet↔Date、Home Global structured↔non-structured 均不得使用 document View Transition old/new snapshot 互相覆盖。

标准合同：

`OLD visible → OLD fully hidden → render/measure/restore while hidden → NEW reveal`

硬约束：

- old/new 文字 **零帧重叠**；
- Bottom Toolbar / Topbar 等稳定 shell 不参与 collection buffered switch；
- 不为视觉效果强制 target `scrollY = 0`；
- DOM/Chunk/geometry/semantic anchor restore 必须发生在内容不可见窗口；
- 不显示 spinner，不制造 loading 语义；
- Reduce Motion 下直接 hidden commit / visible，无额外时长。

## 6. Transient Semantic Anchor

4.7.1 继续禁止 Word/Phrase × Alphabet/Date 四份长期隐藏页面状态，但撤销 4.7.0 “普通切换必定 TOP”的规则。

切换时只创建一次性 transient anchor：

- Alphabet↔Date：优先保持当前可见 Entry；否则保持当前 group 的代表 Entry；
- Word↔Phrase + Alphabet：保持同字母或最近存在字母；
- Word↔Phrase + Date：保持同 date/month 邻域或最近存在日期；
- top/bottom 保持 top/bottom；
- commit 后立即丢弃 transient anchor，不形成目标 view 的长期历史状态。

这属于一次 state transformation 内的阅读对象连续性，不属于 hidden page restoration。

## 7. Root Home Buffer

Home 不再使用 4.7.0 Hierarchy Reset 双 surface scale。Home 仍是独立 root operation，但视觉采用 Root Buffer：

- 当前 Collection context 快速释放；
- 中间只允许极短 root-neutral frame；
- Home shell/wordmark 与 Home content 在稳定 DOM 上恢复；
- 无 translate / scale / old-new snapshot overlap；
- recursive stack 仍一次 clear，不模拟 Back×N。

## 8. LetterRail

LetterRail 是 categorical index，不是 progress bar：

- 删除可见 `.letter-nav-locus`；
- Alphabet Semantic Axis 继续作为内部滚动与定位数学模型；
- UI 只显示唯一离散 active letter cell；
- 同一 current letter 内页面纵向滚动不得持续 chase camera；
- active cell 仍位于 38%–62% safe zone（含小 hysteresis）时 camera 保持当前位置；
- active cell 离开 safe zone 后才计算一次新 camera target，并用已有 exponential approach 平滑移动；
- 用户横拖仍不得改变页面，manual lock 保持到下一次真实页面纵向 motion；
- 手动页面滚动不再使用 raw frame-to-frame semanticVelocity 影响 camera focus。

## 9. Modal / Local Reveal

### Modal

- retained Modal DOM/inert/geometry invariant 保留；
- 普通 backdrop 视觉透明，但交互拦截层保留；
- open 使用 `@starting-style` 建立可靠初态；
- close 约 86ms opacity / 102ms tiny transform，目标是快速释放注意力；
- JS lifecycle 与 CSS exit 时序约束同步，Reduce Motion 不得保留不可见 180ms lock。

### Entry Relation

Relation Panel 具有清晰的“来自当前 Entry”局部来源语义，因此增加 Local Reveal：布局直接提交最终高度，不动画 row height，只让 relation panel/chevron 做极轻出现/退出。

## 10. Token / Surface Exit / Reduce Motion

- 4.7.0 对旧 presentation token 的 240/170ms 泄漏撤销，Dock/Popover 恢复 140ms；
- Page Push、Page Pop、buffer、modal、popover/dock 不再依赖一个泛化 token；
- Relation multi-target 导航前 popover immediate hide，禁止半关闭浮层被 outgoing page snapshot 捕获；
- Reduce Motion 统一覆盖 root View Transition、Modal、JS semantic scroll 与 LetterRail camera。

## 11. 真机 P1 门禁

自动测试无法证明 iOS 26.5 compositor 帧质量。4.7.1 必须特别验证：

- 深位置连续 Alphabet↔Date / Word↔Phrase 不出现旧新文字重叠、Bottom Toolbar 覆盖、boot/restart；
- transient semantic anchor 第一次可见即位于正确邻域，无 TOP→target 二段式；
- LetterRail 长时间手动滚动无肉眼可见横向反向抖动；
- Modal 连续开关 20–30 次不存在残影式注意力拖尾；
- Push 手感保持 4.7.0；Pop 更清晰但不过慢；Home Root Buffer 不被感知为 loading。
