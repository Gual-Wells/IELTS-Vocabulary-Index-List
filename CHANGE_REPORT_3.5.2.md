# Vocabulary Index 3.5.2 变更报告

## 版本定位

3.5.2 是基于 3.5.1 Clean Rebuild 的真机运行时与布局收口版本。

- App version：3.5.2
- Backup Schema：5（不变）
- IndexedDB version：4（不变）
- Seed revision：3（不变）
- VIX version：1（不变）
- Seed 实体、Membership、PhraseToken 和个人状态不迁移。

## 一级表项

- 删除“来源存在时生成隐藏繁体释义占位”的旧实现；
- 表项内部改为序号、词汇信息栈、控件信息栈；
- 繁体释义和独立域来源使用相同字号与行高；
- 左右任一侧存在次级信息时，只扩展并居中本侧内容栈；
- 未变化一侧独立保持纵向居中；
- 序号始终独立纵向居中；
- 来源单行右对齐并省略，不允许无界换行扩张。

## 顶部与字母轨道

- 删除 sticky 小标题相对顶部栏主动保留的 2px 缝隙；
- sticky、活动标题探针、跳转定位和菜单避让共用顶部边界计算；
- Overlay 几何更新合并为每帧最多一次；
- 字母轨道横滑后进入人工锁定，不再以固定 180/205ms 自动接管；页面顶部 A 与页面底部 # 使用同一锁定规则；
- 只有标题真实进入 sticky 边界并发生有效纵向变化时才恢复自动跟随；
- 用户点击字母时显式解除人工锁定。

## 浏览状态

- 词汇/短语视图切换：目标页顶部、全部分组收起；
- 字母/日期模式切换：目标模式顶部、全部分组收起；
- 删除模式间 Entry 映射和目标视图旧快照缓存；
- 递归返回快照增加 mode、calendarMonth 和统一 expandedGroups；
- 搜索、关系、PIN、手动锚点等明确目标跳转继续只展开目标组。

## 日期模式

- 每个具体日期与“未标注”标题可展开/收起；
- 年和月继续作为不可折叠结构标题；
- 日历跳转和目标 Entry 跳转会展开对应日期组；
- 收起时使用可取消事务保持标题阅读锚点。

## 长按浏览锚点

- 达到 520ms 后先执行保存，但不立即弹出提示；
- 在 pointerup 后显示结果 Toast；
- pointercancel 保留已完成保存，但不显示成功提示；
- Toast 禁止文本选择、Touch Callout 和指针命中；
- 抬手时清除残余 Selection。

## 底部停靠区

- 工具栏改为固定 58px 试验高度，取消额外 `safe-area-inset-bottom` 白带；
- 正文、PIN 和标注栏统一按真实 58px 停靠；
- 禁用按钮容器保持不透明，只灰化图标；
- 分隔线不再随按钮禁用而变淡。

该高度需由 iPhone 17 standalone PWA 验收；若 Home 手势区发生真实冲突，再改为最小包含式高度，而不恢复独立白带。

## 弹窗

- native `<dialog>` 根层固定覆盖完整 Layout Viewport；
- 仅内部卡片使用 VisualViewport 中心和可用高度；
- 打开前同步写入首次 VisualViewport 变量；
- 所有弹窗使用统一 `showModalStable()`；
- 关系菜单和查询菜单在 VisualViewport 变化时共同重定位并避让底部停靠栏。

## 缓存与视觉元数据

- Service Worker Cache：`v3.5.2-runtime-stabilization-20260804-1`；
- Manifest 启动背景和主题色统一为 `#fafafa`；
- 最新样式层由 `v3.5.2.css` 替换 `v3.5.1.css`，不同时加载两层。
