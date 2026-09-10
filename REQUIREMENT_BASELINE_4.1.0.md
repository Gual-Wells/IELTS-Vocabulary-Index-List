# Vocabulary Index 4.1.0 需求基线

## 定位

4.1.0 是 4.0.2 的 iPhone 真机视觉/运行时收敛版本。数据世代保持：Backup Schema 6、IndexedDB 5、Seed revision 4、VIX 2。Domain/Entry/Membership/Projection/Search/Relation/Provider 业务语义不变。

## 冻结需求

1. 保留 4.0.1 起的单一 `sticky-letter-heading` 展示层，不回退到每个真实字母 heading 原生 sticky。
2. 基础顶部 Chrome 的底边必须来自当前 DOM 实测几何；禁止以 `visualViewport.offsetTop + 72` 之类混合坐标的硬下限覆盖真实 topbar rect。
3. 字母栏真正进入 sticky 顶部栈之前，字母 Sticky Heading 不得抢先显示；进入后，Sticky/active 字母/跳转阅读边界统一使用“基础 Chrome + 字母栏实测高度”。日期模式只使用基础 Chrome。
4. 上述逻辑统一覆盖全局总表、域总表、普通 Collection，以及 word/phrase/content。
5. 字母 Sticky 标题继续保持不透明，并补齐与日期标题一致的结构边界；不得出现字母栏与 Sticky 之间的透明/漏内容带。
6. 字母栏采用“按钮单元格拥有结构边框”模型：每个字母按钮拥有 top/right/bottom；A/首按钮额外拥有 left。字母栏 wrapper 不承担这些视觉结构线。
7. disabled/empty 只降低字母前景，不允许对整个 button 使用 opacity 造成结构线灰化；`#` 等禁用时相邻竖线必须保持正常结构色。
8. 日期模式刷新 StudyStamp 保持刷新前当前视口，不跟随 Entry 的新日期排序位置；继续临时关闭 overflow-anchor 并无动画恢复 scrollY。
9. Query chooser 保持 Oxford → Collins → Groq → ChatGPT，使用稳定 viewport edge inset，右侧保留明确呼吸空间。
10. Oxford 图标严格依据用户参考图重绘：表达“合上的书”，保留参考图的封面轮廓、短内横线、下方双层书页/封底线关系；不得把“闭合书本”误解为擅自封口或改变参考造型。仅统一 viewBox、stroke、端点、尺寸和视觉重心。
11. 一级 Entry 中英文主行↔繁体副行、控件主行↔独立域来源副行继续收紧；左右副行必须维持同一 bottom/Y metric，不缩小 44px action hit target。
12. 首页全局区右上控件顺序改为：左侧切换图标、右侧“管理”。切换图标固定为软件工程常见的两条平行反向半箭头：上行向右、下行向左；不得改成刷新/循环/双三角等其他语义。
13. 首页大字主标题继续为“词汇索引”；Home 顶部 topbar 标题改为 `Vocabulary Index`。
14. Home Screen PWA 默认名称统一为 `Vocabulary Index`：Apple web-app title、manifest `name` 与 `short_name` 均一致；版本号不进入安装名称。
15. 运行时展示名“全局非结构内容”改为“全局非结构总表”；稳定 ID、投影类型、Schema/Seed/VIX 不改变。
16. Modal 顶部系统壳不再用 boolean + 固定 `#8f8f8e`。建立 System Shell Surface Controller：以基础 `#fafafa` 与 retained modal stack 的 48% 第一层、20% 后续层实际 alpha 逐层合成，得到 depth 0/1/2… 的最终 shell color。
17. System Shell Surface 同步写入 `theme-color`、root shell surface 和固定 topbar/safe-top surface。Custom modal backdrop 从 topbar 实测底边以下开始，避免 topbar 已合成背景再次被同一 backdrop 二次加深。
18. 每次 retained modal push/pop 都必须同步 depth；不能只在第一层 lock/unlock 时切 boolean。
19. 保持 `apple-mobile-web-app-status-bar-style=default`。若 iOS 26.5.2 Home Screen standalone 仍存在系统绘制且 Web viewport 不可达的顶部带，在上述多信号同步后仍不响应动态 tint，记录为 WebKit 平台边界，不用虚假 DOM 覆盖破坏常态页面。
20. 4.0.1 retained Modal Stack、58px 底栏、520ms+350ms 长按、全局非编辑文本不可选、content 长文本、关系/搜索/Provider 会话语义保持。
21. VIX Automaton 是独立项目，本版不修改。GitHub 不执行任何写操作。
