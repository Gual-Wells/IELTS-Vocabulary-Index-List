# Vocabulary Index 4.6.0 产品手册补充

4.6.0 不改变词库、词域、关系、Provider 或导入导出使用方式；用户可见改变集中在长列表定位和返回连续性。

## 字母栏

点击字母会展开目标分组并定位到该字母 natural heading；靠近列表末尾时，如页面剩余高度不足以把标题推到顶栏下方，会正常触底，而不是制造额外空白。重复点击、先访问其他字母后再点击同一字母，最终定位应一致。

## 返回

跨 Collection Back 恢复 source frame 的 view/mode/calendar/expanded state，并以 semantic reading position 为最终目标。浏览器原生 swipe 可能先显示一张不可交互的系统历史截图；更深历史在 iOS 上可能只显示页面背景。该预览由 Safari 管理，真正进入页面后 VIX 应恢复正确可交互状态。

## 长列表性能

全局总表继续使用 42-entry lazy chunks，避免 5k+ Entry 一次生成。42 是内部性能参数；Search/PIN/Relation 目标会强制 materialize 所在 chunk，用户不需要理解该机制。

## 首次安装与更新

首次安装不再因 Service Worker 第一次 `clients.claim()` 自动 reload。只有出现更新提示并明确点击“立即更新”时，新的 Service Worker 接管后才执行一次 reload。
