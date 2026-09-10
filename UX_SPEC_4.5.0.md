# Vocabulary Index 4.5.0 UX 规格

## Navigation

- 首页：无 Back/Home。
- 第一层 Collection：显示 Back，不显示 Home。
- 第二层及以上：显示 Back + Home。
- Back：返回逻辑父 Collection；第一层返回原 Home。
- Home：一次回原 Home 并清 recursive stack。
- word/phrase、alphabet/date、同 Collection Search/Relation/PIN/Annotation 定位不产生新 Back 层。
- 半拖取消必须留在当前页且不修改栈。
- 合法 iOS swipe Back 只使用 Safari 原生 interactive visual transition；VIX 不叠加 page animation。
- dead Forward 不提供产品撤销语义；右边缘尽早 guard，但 Safari 是否短暂展示系统 preview 不作为 Web App 可证明承诺。

## Home

Home 按钮返回时 structured global mode + top。普通 Back 从第一层回 Home 时允许 UA 恢复原 Home history scroll。

## Sticky / Modal

完全沿用 4.4 真机通过行为：Sticky collapse 无明显闪白/累计漂移；Modal 打开关闭不改变背景 Sticky 生命周期。

## Visual

4.5 不做视觉重设计。4.4 去 whole-app stacking context 后的现有绘制质感保持。
