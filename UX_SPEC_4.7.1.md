# Vocabulary Index 4.7.1 UX 规范

## 1. Semantic Motion Gate

运动只有在它传递真实层级、空间连续性或局部来源关系时才存在。表示方式/类别切换不获得人为方向。

- 新 Collection：Push（冻结 4.7.0）。
- Back：Pop（空间反向，感知时序独立）。
- Same-page target：真实纵向 Semantic Scroll。
- Word/Phrase、Alphabet/Date：Buffered State Commit。
- Home：Root Buffer。
- Modal/Relation：Local Surface Reveal / Fast Exit。
- LetterRail：离散 follower，不显示 fractional selection locus。

## 2. Buffered State Commit

### Collection switch

视觉严格按：

`old → fully hidden → neutral/stable shell → new`

禁止 crossfade、scale、translate、View Transition snapshot overlap。Topbar / Bottom Toolbar / shell保持真实可见。

目标切换不回顶部。切换前捕获一次 transient semantic anchor；新 DOM 隐藏状态下 render/materialize/restore 完成后才 reveal。

### Home global switch

只处理 `.global-grid`，其它 Home 区域不动。按钮只使用普通 press feedback。

## 3. Root Home

Home 没有左右/上下空间方向。当前 Collection 约 60ms 快速释放；极短 root-neutral 后 Home topbar/wordmark先稳定，主内容约 88ms 内恢复。不得 scale/translate。

## 4. Back

Push 视觉冻结。Pop 保持几何反向，但约 282ms、减少前半程过快完成；目标页状态仍在 capture 前恢复。

## 5. LetterRail

- 只有唯一 active letter；
- 无连续 52px locus；
- current letter 不变时 rail不应因页面像素级滚动持续漂移；
- active cell在安全区内相机不动；离开才平滑重定位；
- manual drag仍不驱动正文，并保持到下一次页面纵向 motion。

## 6. Modal

普通 modal不使用可见黑色蒙版；backdrop仍负责 click interception / inert boundary。Card open轻量出现，close必须快速释放注意力；连续重复开关不应让眼睛持续追踪退场对象。

## 7. Relation Reveal

关系内容从当前 Entry 内部出现：Panel只做轻 opacity + 2–3px reveal；row height直接落到最终布局，语义锚点校正仍一次完成。

## 8. Reduce Motion

- Push/Pop root VT降为近瞬时；
- JS Semantic Scroll直接提交最终位置；
- LetterRail camera直接定位；
- Modal/Relation/Buffer不保留连续位移；
- 仍保留必要离散状态反馈。
