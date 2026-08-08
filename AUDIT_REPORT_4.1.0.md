# Vocabulary Index 4.1.0 审计报告

## 1. Sticky/镂空根因

4.0.2 已正确把字母栏高度纳入最终内容边界，但 `topChromeBottom()` 仍保留 `Math.max(bottom, viewportTop + 72)`。iPhone standalone 中 `getBoundingClientRect()` 与 VisualViewport 属于不同几何语境；这个人为下限可大于真实 fixed topbar bottom，从而同时把日期 Sticky 与字母栏整体向下推，造成 topbar 下方漏出上一条内容。4.1.0 删除该硬下限，只在 DOM top surface 完全不可测时回退到 topbar rect/64px。

同时，4.0.2 的字母 Sticky 可在字母栏尚未真正吸顶时提前 engaged。4.1.0 新增 `alphabetNavAttached()`，只有 nav rect 已贴到基础 Chrome 时才展示 sticky mirror；active-section 边界在吸顶前用基础 Chrome，吸顶后用完整 Chrome+nav。

## 2. 字母栏边框所有权

历史 CSS 为：wrapper 画 bottom，button 只画 right，首按钮没有 left，top 无 owner，empty 直接 `opacity:.25`。因此 A 左线/全栏顶线天然不存在，且 `#` disabled 会连同 right border 一起变灰。4.1.0 将结构边框统一归 button cell：top/right/bottom + first-child left；empty/disabled 保持 opacity 1，只改变前景色。

## 3. Oxford 参考图

用户参考图表现的是正面“合上的书”：竖向封面轮廓、上部短横线、封面底边/书页线以及更低的一条延伸底线。4.1.0 以该几何关系重新绘制 SVG；不直接嵌入 PNG，不把“closed book”误实现为随意封闭 path，也不改 Collins/Groq/ChatGPT 的既有造型。

## 4. PWA 顶部为什么常态能同色而 Modal 反复失败

普通状态下 `theme-color`、manifest background/theme、html/body、fixed `.topbar`、`.topbar::before` 全部指向同一 `#fafafa`，WebKit 无论从哪一信号推导顶部 tint 都得到同色。

4.0.2 Modal 只做 `active:boolean`：把 meta/root 固定改成第一层合成色 `#8f8f8e`，但 fixed topbar 仍是 `#fafafa`；同时 retained 子层没有把 depth 2 的 20% backdrop 纳入 system shell。Safari 26 的 WebKit 公开 bug 说明，靠近 viewport edge 的 fixed/sticky opaque surface 会参与顶栏颜色扩展，且 theme-color 并非总是优先。因此 4.0.2 自己向 WebKit 提供了冲突颜色信号。

4.1.0 改为累计合成控制器：基础 RGB 250/250/250，第一层叠加 rgb(28,27,25)/48% 得 `#8f8f8e`；第二层再叠 20% 得约 `#787877`，后续同理。每次 custom modal push/pop 同步 meta/root/topbar。为避免 topbar 已经是最终合成色又被实际 backdrop 再蒙一次，custom backdrop 从实测 topbar bottom 以下开始。

## 5. WebKit 调研边界

- WebKit Bug 305546：Safari 26/Home Screen App 中，顶部 fixed 元素的不透明背景会用于状态栏/顶栏颜色延伸；报告者同时指出 theme-color workaround 不一定生效。
- WebKit Bug 301756：WebKit 工程师解释 viewport-constrained fixed/sticky surface 贴近被遮挡 inset 时会触发 solid color extension。
- WebKit Bug 301994：iOS 26.5.2 有用户报告 Home Screen standalone 出现 `screen.height=874`、Web viewport=812 的 62px system strip，DOM 不可达，且某些底部颜色只在 relaunch 更新。
- WebKit Safari 15 文档确认 `theme-color` 本身支持影响 iOS Safari status/overscroll surface；因此不能把它理解为“只能赋一次的常量”。

结论：4.1.0 应同步所有可控信号，但真实 iPhone 26.5.2 若命中 viewport 外 system strip，Web 页面没有 UIKit `setNeedsStatusBarAppearanceUpdate` 等原生 API，最终动态 tint 仍可能受平台回归限制。

参考：
- https://bugs.webkit.org/show_bug.cgi?id=305546
- https://bugs.webkit.org/show_bug.cgi?id=301756
- https://bugs.webkit.org/show_bug.cgi?id=301994
- https://webkit.org/blog/11989/new-webkit-features-in-safari-15/

## 6. 数据/业务审计

Seed、关系组件、优先级占有、搜索、VIX/Backup 均不变化。`全局非结构总表` 只是 virtual collection display name 更新，稳定 ID `__global_all_content` 不变。
