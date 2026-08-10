# Vocabulary Index 4.7.0 产品手册补充

4.7.0 不改变词库、关系、Provider、导入导出或数据世代；主要改变的是 iPhone standalone 中“页面如何移动和返回”。

## 返回与首页

内部页面不再加入 Safari History。Back 按钮由 Vocabulary Index 自己恢复上一 recursive page；Home 一次清空当前 recursive path 回首页。由于内部页面不再成为 Safari history slots，旧版多层 native Back 的纯背景 preview、冻结 Search history snapshot 与 browser snapshot→live handoff不再属于产品内部返回路径。

## 字母栏

点击字母会真实连续滚动正文，而不是瞬移。页面通过真实字母标题位置计算滚动；即使某个字母展开大量关系、某个字母很短，每个相邻逻辑字母仍占相同索引进度，因此长距离导航的时间分配不会被某个巨大 section 完全支配。

手指横向拖字母栏只是在浏览字母索引，不会带动正文。松手以后轨道停在手指留下的位置；直到正文下一次上下移动，自动跟随才重新接管。点击某个字母则属于明确导航，会立即带正文去目标。

## 页面内跳转

PIN、同页 Search/Relation、浏览锚点、日期 Calendar 目标与返回顶部均使用连续纵向运动。Calendar 只是查询/跳转入口；它不会因为用户上下读日期列表而自动翻月或跟随当前日期。

## 进入其他词表

普通进入新 Collection 使用 App 式 Page Push。若目标是其他 Collection 的某个具体 Entry，会先进入目标页顶部，再连续滚到该 Entry；不会直接闪现到中间位置。

## 词汇/短语、字母/日期切换

Word/Phrase 是同级内容投影，采用浅层横向换面；Alphabet/Date 是组织方式变化，采用 Reindex 过渡。两类普通切换都初始化目标 TOP + 全标题收起，不恢复过去没打开页面的滚动或展开状态。只有 Back 才恢复离开上一页时的完整状态。

## 弹窗

Settings/Search/Confirm 等 retained Modal 使用轻微放缩、透明度和克制弹性打开；关闭更快。背景仍保持原几何和 Sticky 状态并不可交互。
