# Vocabulary Index 4.0.1 审计报告

## 结论

本版变更保持在 UI/运行时边界，没有重新打开 4.0.0 的数据/关系语义。源码审计未发现 Schema、Seed、VIX、Membership/Projection 或 Raw Relation Graph 被本轮 UI 改动改变。

## 真机反馈对应根因

- 字母栏镂空/Sticky 延迟：4.0.0 仍让真实 heading 承担 sticky，并在滚动帧扫描 section rect。4.0.1 改为普通 heading + 单一展示层 + metrics 二分。
- nonStructured 超长：`entryLayoutKind()` 对 `content` 回落到 `word-normal`，没有迁移 phrase 的长文本分级。4.0.1 补齐三档。
- Settings/管理词库近全屏：通用 card `max-height` 允许逼近 VisualViewport。4.0.1 给 management/action variant 独立受限高度。
- 嵌套弹窗跳变：旧 `dialogStack` 实际保存 childNodes 后 `replaceChildren`，不是视觉 stack。4.0.1 父层常驻并 inert，子层是真实 DOM layer。
- 弹窗闪现：4.0.0 已取消位置二次校准，但 card 仍在构建帧直接可见。4.0.1 先 backdrop，card hidden，稳定两帧后 reveal。
- 设置原生勾号：仅 appearance 不一致，本版用 CSS 自绘且不替换真实 checkbox。

## 风险边界

自动化可证明源码结构、布局合同与模型回归，但不能证明 iOS WebKit 的真实 fling、Dynamic Island、状态栏合成、Selection/callout、视觉闪现和多层触控体感；这些保留在真机清单中。
