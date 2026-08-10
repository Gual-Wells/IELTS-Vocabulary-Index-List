# Vocabulary Index 4.7.1 技术调研

## 1. View Transition snapshot 与层级

W3C CSS View Transitions Level 1规定：`::view-transition-old()` / `::view-transition-new()`分别代表旧/新状态的visual snapshot；`::view-transition`形成独立view transition layer，并在document其余内容之后绘制。由此可解释4.7.0深位置Reindex/Sibling中old/new文字真实重叠，以及snapshot能够视觉覆盖普通live Bottom Toolbar。

来源：
- https://www.w3.org/TR/css-view-transitions-1/

4.7.1据此将document/named snapshot限制在真正需要空间surface连续性的Page Push/Pop；representation/category switch退出View Transition。

## 2. `@starting-style`

WebKit官方说明Safari 17.5起支持`@starting-style`，用于元素box刚创建/重建时定义transition起始值。因此Modal入场不再依赖“append后下一次rAF移除entering class是否已产生paint”的时序假设。

来源：
- https://webkit.org/blog/15383/webkit-features-in-safari-17-5/

## 3. iOS scrolling/compositor 风险

WebKit Safari 27 beta release notes列出多项与本项目真机症状同型的修复：动态内容后页面blank并跳顶、DOM layout change与同步`window.scrollTo()`时composited layer短暂flash blank、sticky滚动后快速flicker。这不能倒推出4.7.0具体崩溃必由WebKit造成，但证明“动态布局 + 同步滚动 + composited/sticky presentation”是需要避免放大的敏感组合。

来源：
- https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/

## 4. Reduced Motion

Apple Reduced Motion评估标准明确区分纯装饰motion与传递状态/层级意义的motion：前者可停止，后者可替换成较少全屏运动的dissolve/highlight/color shift等。4.7.1因此不再为无空间语义的representation/category switch发明方向，同时让自制scroll/camera在Reduced Motion下直接提交。

来源：
- https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/
- https://developer.apple.com/design/human-interface-guidelines/accessibility

## 5. Virtualization / iOS community evidence

TanStack Virtual公开issue #884报告iOS Safari中window virtualization + dynamic size会干扰momentum scroll；2026-08的#1250进一步报告programmatic scroll与iOS deferred measurement adjustment组合可先paint错误offset、随后snap。它们不是VIX的直接依赖或根因证明，但为“动态测量修正不应与可见运动/用户momentum混成单一反馈环”提供了有价值的社区工程证据。

来源：
- https://github.com/TanStack/virtual/issues/884
- https://github.com/TanStack/virtual/issues/1250

## 6. 4.7.1 工程推论

- Snapshot animation只用于真实surface导航；
- Representation switch使用old→neutral→new，hidden窗口完成render/measure/restore；
- transient semantic anchor保持一次切换中的阅读对象连续，不维护四份隐藏state；
- LetterRail从连续控制系统降维为categorical follower，避免position noise经过derivative放大进入nested scroll camera；
- Modal exit优化目标是attention release，不追求open/close时间镜像。
