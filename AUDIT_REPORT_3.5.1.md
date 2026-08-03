# Vocabulary Index 3.5.1 审计报告

## 审计基线

本版以 `Vocabulary-Index-3.5.0-Full-Source.zip` 为唯一代码基线，重新实施 3.5.0→3.5.1 已确认方案。基线 ZIP SHA-256：`f3352050903c982be172e92000e474b5f39ae785b3ffb3a055f52fde537bc23b`。

## [历史问题] 已撤回的两份 3.5.1

此前先后产生的“3.5.1 截断版”和“3.5.1 修正版”均已撤回：

- 截断版在 `v3-ui.js` 中保留了 `setLetterSectionOpen`、`toggleLetterSectionWithAnchor` 的调用，却删除了函数定义，Seed 初始化后字母标题和字母导航核心链路直接抛出 `ReferenceError`。
- 所谓修正版仍建立在截断源上，不能证明其完整性。
- 两份错版只用于说明交付事故，不得作为后续代码参考或合并来源。

## [当前实现] 清洁重建策略

1. 从 3.5.0 ZIP 全新解压并建立版本快照。
2. 只按已确认的 3.5.1 需求修改 Dialog、模式切换、字母跟随、浏览锚点、一级表项元信息和日历。
3. 保留 3.5.0 的字母分组创建、展开、收起、惰性 Chunk、目标物化和返回栈主体链路。
4. 增加运行时符号检查，禁止“调用仍在、定义被截断”再次通过交付测试。

## 组件审计

### Dialog Shell

- 外层 Dialog 使用视觉视口宽高和偏移，卡片宽度只取 Shell 可用空间。
- 所有内部输入控件 `max-width: 100%` 且使用 `border-box`。
- Header 使用对称三列，不再因关闭按钮造成标题偏移。
- 只有 `.dialog-body` 被认定为可滚动目标；其他滑动被 `preventDefault`。
- Body 固定锁与嵌套弹窗计数配合，最后一个弹窗关闭时恢复原 `scrollY`。

### 模式切换

状态优先级定义为：

```text
返回栈快照 > 搜索/关系/PIN等明确目标 > 手动模式切换的当前Entry > 首页/顶部状态
```

模式切换不读浏览锚点。顶部判断明确检查 Large Title、日期日历和内容区是否真正进入阅读视口；不存在明确 Entry 时使用 `home` 语义。

### 浏览锚点

`setLastPosition()` 在 UI 中只有一个调用点，即长按保存函数。滚动持久化只更新浏览器历史快照，不再更新浏览锚点。锚点读取继续验证具体 Entry 是否仍在当前投影和当前 kind 中；失效锚点不迁移到跨域同形 Entry。

### 字母链路

以下函数均存在且各定义一次：

- `renderAlphabetContent`
- `setLetterSectionOpen`
- `toggleLetterSectionWithAnchor`
- `updateActiveLetter`
- `syncActiveAlphabetHeading`

字母导航按钮、标题点击、搜索／PIN／关系目标物化都连接到同一展开逻辑。折叠时取消 Chunk Observer、清理 Entry→Chunk 映射并做视口锚定补偿。

### 一级表项

- 主 Grid 使用显式 `text / date / actions` 区域，不依赖隐藏元素后的自动放置。
- 序号和 `entry-lexeme-stack` 构成两列；英文、释义在 stack 的同一列，因此释义不会落在序号下方。
- 来源标签为真实 Grid Item，位于第二行右侧；不使用绝对定位。
- 无关系条目使用语义为空的占位节点，不进入 Tab、不可点击。
- 单行和双行高度由 `has-meta-line` 决定，来源和释义不会叠加成第三种高度。

### 日历

新增年跳转按钮只改变月份键 ±12；月跳转继续 ±1。按钮布局在 320、375、390px 合成视口测试中未超出容器。

## Seed 基线一致性

忽略唯一允许变化的 `appVersion` 字段后，当前 `data/seed.json` 与 3.5.0 基线的规范化 SHA-256 均为：

```text
104bda49771eba2d4d8bfe14431d3989332d97ec780aa6bfd9d2dd4b77e37014
```

词域、词表、Entry、Membership、PhraseToken、设置和内置来源内容完全一致。

## 数据与逻辑关联

本版不修改 Schema、Entry、Membership、PhraseToken、PIN、Annotation 或 StudyStamp 数据结构。普通词汇优先级占有、全局具体 Entry 投影、唯一组计数、三态关系跳转及 AI／导入事务继续沿用 3.5.0。

## [待验证]

自动测试不能证明以下真机行为：

- iOS standalone PWA 原生 Dialog Backdrop 是否覆盖所有安全区；
- Safari 惯性滚动下的字母警戒跟随与滞回；
- 长按触觉、移动取消和系统上下文菜单；
- 键盘出现时 Dialog、底部栏与 Visual Viewport 的最终配合；
- 字体渲染差异下的极长词／短语与来源标签。
