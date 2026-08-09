# Vocabulary Index 4.2.0 审计报告

## 1. 为什么放弃 Alphabet Sticky Mirror

4.1.0 真机已经证明 mirror 的 top 几何可以正确工作，但随后连续暴露四个并非独立的缺口：左右边框丢失、collapsed heading 仍可持续 Sticky、所属 section 触底后不能自然退场、点击 mirror 收起时因为 anchor 仍指向屏幕外真实 heading 而跳到其他位置。

源码根因是 4.0.1 把 `.letter-heading` 强制改成 `position:relative`，新增全局 `sticky-letter-heading` 只复制了“顶部显示当前标题”。它没有继承原生 CSS Sticky 的 containing-block contract：真实 heading 与所属 section 同一 DOM，浏览器天然限制 Sticky 不得越出 section，因此 collapsed section 因高度不足无法持续 Sticky，expanded section 在底部到来时会 push-off；点击的可见标题本身也是收起锚点。

日期模式从未离开这套 native 模型，并在目标 iPhone 上持续正确。因此 4.2.0 删除 mirror DOM/renderer，把真实 `.letter-heading` 恢复到 `position:sticky; top:var(--content-sticky-top)`。`alphabetSectionMetrics`、ResizeObserver 和二分查找保留，但只负责字母栏 active 同步。

## 2. Sticky 点击收起为什么重新正确

`toggleDateSectionWithAnchor()` 与 `toggleLetterSectionWithAnchor()` 都在收起前记录真实 heading 的 `getBoundingClientRect().top`，临时关闭 `overflow-anchor`，删除 body 后在下一帧按 heading 位移做 `scrollBy` 补偿。mirror 时用户点击的可见 DOM 与传入的 real heading 不是同一个位置，导致 delta 近似 0 而 document 高度已骤减。4.2.0 恢复 native 后，可见 Sticky 就是 real heading，因此重新与日期模式使用同一 anchor 语义。

## 3. Query menu 定位

4.1.0 使用“source center - menu center - 16px”再配 22px viewport inset，造成宽菜单整体左移过量。关系四态 multi-target 菜单则以 `sourceRect.right - menuRect.width` 从右侧动作源向左展开，真机视觉更稳定。

4.2.0 Query menu 改为该挂接模型并额外左退 10px，viewport side inset 收敛到 12px。垂直 gap 9→13px，使浮层底边与一级 Entry 框线同时保持完整，不让底层结构线穿过弹窗。

## 4. Oxford optical bounds

4.1.0 虽然 CSS 同为 17×17，但 Oxford 内部 SVG 几乎占满 24×24 viewBox（旧 y≈2.5→21），而 Collins/Groq/ChatGPT 的有效图形更集中，因此真机显得明显更大、更笨重。4.2.0 放弃参考图几何忠实约束，只保留“合上的书”语义，把有效轮廓收回约 x6→18.8、y5.2→19 的共同 optical envelope，线宽/端点继续继承统一 icon renderer。

## 5. PWA 顶部实验为什么撤销

4.1.0 的 System Shell Surface Controller 会按 48%/20% modal depth 人工计算灰色，并强制写入 root/topbar/theme-color，同时把真实 backdrop 从 topbar 底部以下开始。真机结果是 iOS system strip 仍白，但 Topbar 被人工染灰，造成标题栏被污染。

这说明“可控 DOM”与“系统绘制区域”应重新分离。4.2.0 删除 runtime shell tint controller，`theme-color` 常态保持 `#fafafa`；custom/native dialog backdrop 都恢复覆盖完整 Web viewport。于是正文、Topbar、父弹窗的灰度完全由真实 alpha compositing 产生，当前最上层 modal card 独立正常显色。若 iOS 26.5.2 顶部 system strip 不在 Web viewport，接受其静态颜色，不再破坏 Web UI 尝试伪同步。

## 6. Home 导航缺口

现有 `back-button` 实际调用 `history.back()`，但 HTML 旧 aria-label 曾写“返回首页”，暴露 Back 与 Home 语义混用。现有 `goHome()` 又只是 `replaceState` 当前 entry，无法从 `Home→A→B→C` 真正销毁 A/B/C 的递归语义。

4.2.0 新增 Root Home：depth>=2 才显示。点击后一次 `history.go(-appNavigationDepth)` 回 root；`navigationEpoch` 同时递增，所有旧 history state（包括升级前无 epoch 的旧 VIX state）都被视为失效，无法通过 forward/popstate 恢复旧 pageSnapshot。清理范围只限 Navigation History/临时展开状态，不触碰业务数据或 Undo/Redo。

## 7. Home visual hierarchy

源码历史显示 `.global-scope` 在 3.x 是有淡背景和边框的完整 Box；4.0 flat hierarchy 删除背景/阴影/rail，却保留了 border，形成当前孤立的淡矩形残片。同时 `.global-scope .scope-heading h3` 仍被单独压到 12px + .10em，而 Domain heading 已是 15px/740。

4.2.0 移除 Global 完整边框，改为标题与动作之间的细 Index Rule；“全局”恢复 Domain 同级字形。Home topbar 产品名不再复用普通 Collection 标题 sans，而采用独立系统 serif/New York 方向 wordmark；Hero eyebrow 与大标题不变，形成“产品名 → 页面身份 → scope → collection”的清晰层级。

## 8. 数据/语义边界

Seed、Schema、DB、VIX、Relation、Search、Priority ownership、Provider session 均未变化。4.2.0 仅改变运行时导航、Sticky、浮层和 Home 视觉。
