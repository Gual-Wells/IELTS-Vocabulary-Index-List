# Vocabulary Index 4.6.0 需求基线

## 1. 更新性质

4.6.0 是 4.5.0 真机验收后形成的 **Scroll / Position / Virtual Layout / Visual Commit Architecture Correction**。本版不重新设计产品，不重新设计已经基本通过真机的 `destructive-v3` Navigation Automaton，也不重做 4.4 已通过的 Sticky/Modal。冻结数据世代：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2。

## 2. 4.5.0 真机事实

4.5.0 已确认 Navigation page identity、Back/Home destructive semantics、same-Collection non-page、cross-Collection page、half-swipe cancel 与 restart→Home 基本正确；但真机继续暴露：

- Back 的最终滚动位置在重复 traversal 后可能从正确 Entry 突然退化到顶部或较早 Entry；4995 可稳定错误收敛到 4989，5322 底部可经历 5240→5313→5322；
- LetterNav 的目标有时落在字母标题下 3–8 个 Entry，有时在已展开 section 顶/底之间漂移；
- 全收起后顺序 A→B→…→X 会出现明显闪烁、位置割裂、卡顿和反向狂跳，并可失败回 W 的后段；直接 X 正常；
- LetterNav、native Sticky heading 与正文的可见更新不是同一 visual commit，存在明显晚一帧/多帧刷新；
- native Back 的近期 history preview 是冻结截图；更深 history 可只显示纯背景，再切入 live VIX；
- Search 跨 Collection 后 native Back preview 可冻结带 Search 的旧画面；
- 首次安装 PWA 可出现 V→Home→V→Home 双启动。

## 3. 4.6 四条硬约束

### One Root Scroll Owner

应用代码只有 `ScrollCoordinator` adapter 可以修改 root viewport。Virtual Chunk、LetterNav、Back restore、Entry/PIN/Relation/Search positioning 不得各自拥有根滚动写权限。

### One Geometry Truth

`ContentTop = base Chrome bottom + measured LetterNav height` 是唯一语义坐标。CSS Sticky、LetterNav、active-letter、Entry jump、Back restore 与 semantic position 共用它。`alphabetNavAttached()` 不得再改变 ContentTop 真值。

### One Semantic Position

Frame 的阅读位置权威从单独 `scrollY` 升级为 semantic position：Entry/Section identity + 相对 ContentTop offset，或 Bottom gap；`scrollY` 只保留 fallback。

### DOM 可以虚拟，位置不能虚拟

42-row lazy materialization 保留为性能手段；VirtualEntryList 可以 materialize/measure/report geometry change，但不得自行恢复 viewport。

## 4. 冻结边界

- Navigation：`destructive-v3`、Collection=recursive frame、browserKey/`traverseTo()`、Home/dead Forward、same-Collection nonrecursive 全部冻结。
- Sticky：4.4 flow-anchor + long-displacement collapse transaction 冻结；只允许通过 ScrollCoordinator lease 取得根滚动权。
- Modal：4.4 retained Modal、背景 inert、Modal/Page viewport geometry 分离冻结。
- whole-app stacking-context removal 冻结。
- PIN/Review、Relation business semantics、Provider、数据模型不变。

## 5. 性能约束

4.6 首版保持 `ENTRY_CHUNK_SIZE = 42`、IntersectionObserver `960px` 预取、首块立即生成、目标 Entry 强制生成；42 是 tuning parameter，不是产品/数据协议。不得以位置正确性为由恢复 5k+ Entry 全量 DOM；不得同时引入完整 DOM recycling 或以 `content-visibility` 替代当前虚拟化。

## 6. 视觉验收边界

应用可控 surface 的二次闪帧、错误 Sticky、active letter 晚刷新、反向 correction、错误 live position 均为缺陷，不再以“轻度可接受”关闭。

Safari 私有 native swipe snapshot bitmap 被淘汰后显示纯背景属于平台 visual boundary；但 Safari 交回 live VIX 后，第一份可交互状态必须是正确 presentation + semantic position，不得再由 VIX 自身闪/跳一次。
