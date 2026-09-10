# Vocabulary Index 4.7.1 产品手册

## 首页

首页“全局”区的结构化/非结构化按钮只切换全局卡片区域；其余Home内容保持稳定。切换使用短缓冲，不表示左右空间关系。

## Collection

### 进入下一 Collection

保持4.7.0 Page Push。若Search/Relation目标位于其它Collection，先Push到目标Collection，再进行精确semantic定位。

### Back / Home

Back恢复上一递归页完整离页状态，并使用较清楚的Pop。Home一次返回根并清递归栈，但视觉不再缩放页面，而使用短Root Buffer。

### Word / Phrase

切换时不再回页面顶部。系统从当前阅读位置建立一次semantic anchor，在新类别隐藏渲染完成后尽量落到同字母/日期邻域，再显示新内容。

### Alphabet / Date

同样不回顶部，不显示旧/新页面重叠动画。Date Calendar继续只是查询/跳转工具。

## LetterRail

字母栏只显示唯一当前字母；不再出现跨两个字母移动的绿色连续选中框。页面在同一个字母段内滚动时，字母轨道应保持稳定；只有当前字母离开轨道安全区才横向重定位。

## Modal

普通弹窗不再把整页明显变暗。背景仍不可操作，Card本身轻量出现；关闭明显更快。

## Relation

展开关系时关系Panel从当前词项内部轻量出现/消失；Entry高度直接完成布局，不使用慢height动画。

## Reduce Motion

开启系统“减弱动态效果”后，页面Push/Pop、长距离semantic scroll、LetterRail camera与Modal动效均显著减少或直接提交最终状态。
