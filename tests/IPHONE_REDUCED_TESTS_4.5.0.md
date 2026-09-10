# 4.5.0 iPhone 17 Reduced Tests

目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。

## A. 最小 Back

1. kill PWA → 重开 Home。
2. Home → A，不滚动。
3. 左上 Back：必须立即回 Home，不得无反应/数秒后 snap-back。
4. 重复，用左边缘 swipe：成功则进入 Home；半拖取消则停在 A，A 的 stack 状态不变。

## B. 三层递归

Home → A → 跨 Collection B → 跨 Collection C。

- 左上 Back：C→B→A→Home。
- 慢 swipe / 快 swipe 分别做 C→B。
- half-cancel 后仍是 C，再按 Back 必须只到 B。
- 每次 commit 后 Home 按钮显示必须与真实 depth 一致。

## C. destructive Forward

C→Back→B 后右边缘 Forward：C 不得恢复为 live VIX page。

随后 B→新 D：旧 C branch 应被 fresh PUSH 截断；Back D→B 正常。

## D. Home

Home→A→B→C，在 C 点击 Home：

- 一次到原 Home；
- 无 snap-back；
- 左边缘不可退出 PWA root；
- 右边缘不得恢复 A/B/C 为 live page；
- 从 Home 新开 D 后 Back 只回 Home，不得回旧 C/B/A。

## E. Same-Collection Non-Page

在 A：

- word↔phrase；
- alphabet↔date；
- Search 命中当前 Collection（包括目标不在当前视觉范围）；
- Relation/PIN/Annotation 命中当前 Collection。

操作任意组合后 Back 都应直接离开 A，而不是逐项撤销。

## F. Cross-Collection Search/Relation

A 中点击跨 Collection Search/Relation 到 B：必须新建一层，Back 回 A。

观察 PUSH 时不应再出现固定约 70/140ms 后的整页旧帧闪现。

## G. Scroll Restore

A 滚深 → B → Back A：首个 live A DOM 建立后由 Safari 恢复原 scroll；不得先到顶部再明显二次跳。

## H. Sticky/Modal 冻结回归

在长 Alphabet / Date section 深处 collapse：无 4.3/4.4 前的白闪或累计漂移。

在 Sticky 已吸顶时打开 Settings/Search/Confirm：背景 Sticky 不消失、不改位置。
