# Vocabulary Index 4.0.2 需求基线

## 定位

4.0.2 是 4.0.1 的 iPhone 真机几何与交互连续性修订。Schema 6、DB 5、Seed 4、VIX 2，以及 Domain/Entry/Membership/Projection/Search/Relation/Provider 业务语义全部保持不变。

## 冻结需求

1. 字母模式继续使用 4.0.1 的单一 Sticky Heading Layer，不回退也不重建关系/列表模型。
2. 顶部几何只允许一个实测真值：基础 Chrome 底边 + 当前可见字母栏实测高度。不得用字母栏“当前是否已经滚到顶部”的瞬态 rect 作为 Sticky 最终占位高度。
3. 字母栏可见时，所有 alphabet 视图的 Sticky/跳转/阅读边界统一位于字母栏下方；字母栏隐藏的日期模式只使用基础 Chrome 底边。
4. 该规则统一覆盖全局总表、域总表、普通词表、词汇页、短语页和 nonStructured 内容页。
5. 修复字母栏下方镂空与 Sticky 被字母栏 z-index 遮挡的同源几何问题。
6. 日期模式刷新学习日期必须保持当前视口位置，不再把被刷新 Entry 跳到今天的新位置；更新通过无动画 scroll continuity 与临时关闭 overflow-anchor 完成。
7. Query chooser 在 4.0.1 基础上再向左校准，右侧边框必须完整露出。
8. Oxford 查询图标重绘为闭合书本；ChatGPT 形状保留。Oxford/Collins/Groq/ChatGPT 四个 Provider 统一深色描边视觉。
9. 应用 Modal 打开时同步 theme-color/页面底色到第一层蒙版的合成色，作为系统状态区融合的 best-effort 方案。
10. iOS 26.5.2 Home Screen PWA 若仍保留 WebKit/系统绘制、DOM 不可达的顶部状态条区域，不得通过虚构 DOM 覆盖或破坏正常页面状态栏可读性；记录为平台边界。
11. 4.0.1 retained Modal Stack、管理窗口、content 长文本、全局不可选、520ms+350ms 长按、58px 底栏等规则保持。
12. VIX Automaton 仍属独立任务，本版不修改。
