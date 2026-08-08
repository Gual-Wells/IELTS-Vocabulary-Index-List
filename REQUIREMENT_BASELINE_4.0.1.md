# Vocabulary Index 4.0.1 需求基线

## 定位

4.0.1 是 4.0.0 的 iPhone 真机反馈收口版。只调整 UI/运行时，不改变 Schema 6、DB 5、Seed revision 4、VIX 2、Domain/Entry/Membership/Projection/Search/Relation 的业务语义。

## 冻结需求

1. 字母分组真实标题回归普通文档流；顶部只保留一个独立 Sticky Heading Layer，不再由每个真实标题自身 sticky。
2. active section 采用预计算 section metrics + 二分定位；列表高度变化由 ResizeObserver 触发重测，滚动帧不遍历全部 section。
3. 字母栏、Sticky Heading、跳转继续共享实测顶部 Chrome 几何；禁止恢复固定 `+52px` 推导。
4. 应用级弹窗使用真实 retained modal stack：父层 DOM/滚动/输入状态保留，子层新增独立 backdrop 与 card；关闭子层只 pop 当前层。
5. Settings、Library Manager、Collection action 等管理/操作型卡片使用同一受限高度规格；内容超长只滚 body，卡片四角必须完整可见。
6. 弹窗先建立 backdrop 与 DOM，稳定两帧后一次性 reveal card；无位置动画、无二次可见校准。
7. Settings 删除无必要开发说明文字；保持既有触控尺度，不做过度压缩。
8. `content` 补齐 normal / two-line / extreme 长文本策略；极长文本沿用成熟横向滚动语义。
9. 一级表项繁体释义/独立域来源继续共用 secondary-line Y 规则，同时显著减少中间与上下无效空白。
10. Query chooser 略左移、减小无效上方空白，并在四个图标下显示 Oxford / Collins / Groq / ChatGPT 副字。
11. 仅重绘 Oxford 与 ChatGPT 查询图标，使其线宽/视觉盒与现有 Collins/Groq 协调；其他图标不重绘。
12. 原生 checkbox 仅在“关闭低级词汇关联”等设置中换为产品自绘视觉；原生 input 语义、键盘与可访问性保留。
13. Modal Host 必须延伸覆盖顶部 safe-area，使 modal backdrop 与 App 背景视觉连续；状态栏本身保持 `default`，业务内容继续按 safe-area 避让。
14. 58px 底栏、全局非编辑文本不可选、520ms 长按 + 350ms grace、四态关系、查询 Provider 和 4.0.0 数据世代规则全部保持。
15. VIX Automaton 仍是独立任务，本版不修改。
