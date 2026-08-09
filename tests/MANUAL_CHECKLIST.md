# Vocabulary Index 4.2.0 · iPhone 17 主屏幕 PWA 人工验收清单

> 目标：iPhone 17 标准版 / iOS WebKit / Home Screen standalone。自动测试不等于本清单通过。

## A. 安装与基础数据

- [ ] 页面/设置显示 4.2.0；Home Screen 名称为 `Vocabulary Index`。
- [ ] 4.1.0 → 4.2.0 后 Entry、PIN、StudyStamp、Annotation、Settings、API Key、用户内容均保留。
- [ ] PWA `V` icon、离线启动、进程回收后重开正常。

## B. Home 视觉

- [ ] Topbar `Vocabulary Index` 为独立产品 wordmark，明显区别于普通 Collection 标题，也不复制绿色 uppercase eyebrow。
- [ ] Hero 仍为 `VOCABULARY INDEX` + 大字“词汇索引”。
- [ ] “全局”字号/字重与“通用英语”等 Domain heading 同级。
- [ ] Global 不再有完整淡矩形框；标题和右侧动作之间只有轻量 Index Rule，整体不显空散或突兀。
- [ ] Parallel switch 在“管理”左侧；structured/nonStructured 切换正常。
- [ ] nonStructured 入口名称为“全局非结构总表”。

## C. Back / Root Home

- [ ] Home→A（depth 1）：只显示 Back，不显示 Home。
- [ ] Home→A→B（depth 2+）：左上为 Back + Home，中央标题仍物理居中，长标题省略不压按钮。
- [ ] Back 只回上一页并恢复原页面 mode/scroll/expandedGroups/calendar 等快照。
- [ ] Home 从任意深度一次回首页顶部，不逐层播放返回。
- [ ] Home 后再尝试系统 forward/历史恢复，旧 A/B/C pageSnapshot 不得复活。
- [ ] Home 不清 PIN、Annotation、StudyStamp、Settings、API Key、手动浏览锚点或 Undo/Redo。

## D. Alphabet native Sticky

在全局词汇总表、全局短语总表、域总表、普通词表、普通短语表、非结构 content 表至少各抽一类验证：

- [ ] 字母栏 sticky 到 Top Chrome 后，真实展开字母 heading 吸附在字母栏无缝正下方。
- [ ] 收起的字母 section 不形成持续 Sticky。
- [ ] 展开 section 的内容触底时，Sticky heading 被 section 底部带着向上退场；下一 section 自然接管。
- [ ] Sticky heading 左右边界来自 section side rails，无 4.1.0 mirror 两侧缺线。
- [ ] 点击吸顶的展开字母 heading 收起：真实 collapsed heading 留在字母栏正下方，不跳到后续字母、不闪现、不被 document max-scroll clamp。
- [ ] 点击屏幕内普通真实 heading 收起同样保持原视觉位置。
- [ ] fling / rubber-band / 快速连续展开收起无镂空、无 ghost、无双标题。
- [ ] 字母栏 active 与真实当前 section 同步，横向轨道自动跟随不迟滞。

## E. Alphabet cell 边框回归

- [ ] 每个字母 cell 顶/右/底结构线完整；A/首格左线完整。
- [ ] disabled/empty 字母只灰文字，结构线不灰；重点看 `#`、首尾以及相邻竖线。
- [ ] active fill/下强调线不破坏 cell 边框连续性。

## F. Date 模式

- [ ] 日期/未标注 heading native Sticky 继续吸附、触底退场、收起自然退出。
- [ ] 刷新某 Entry StudyStamp 后保持当前 viewport，不跟随 Entry 新排序位置跳转。
- [ ] 更新前后无二次滚动、overflow-anchor 回弹或闪动。

## G. Query / Relation

- [ ] Query chooser Oxford→Collins→Groq→ChatGPT 顺序不变。
- [ ] Query chooser 从右侧动作区向左展开，位置比 4.1.0 更自然；不故意探出列表右边框，也不过度贴屏幕左/右边缘。
- [ ] Query chooser 底边与一级 Entry 框线之间存在清楚的小空隙；底层框线不穿过浮层。
- [ ] viewport 顶/底空间不足时 above/below fallback 正常。
- [ ] Oxford 新 closed-book icon 与 Collins/Groq/ChatGPT 的视觉尺寸、线宽、留白、重心一致。
- [ ] 四态 relation multi-target 菜单继续保持现有正确视觉与导航。

## H. Entry 密度

- [ ] 无副信息 Entry 不被无意义压矮。
- [ ] 仅繁体、仅来源、繁体+来源同时存在时，secondary line 间距紧凑且左右同 Y。
- [ ] phrase/content two-line/extreme 不遮控件，44px action hit target 保持。

## I. Modal / PWA 顶部

- [ ] 第一层 custom modal：正文和 Topbar 由同一个真实 48% backdrop 自然变暗，Topbar 不再被人工单独染色。
- [ ] 第二层 modal：父 modal + 页面再自然叠 20%，当前子 card 保持正常 surface；父层 DOM/滚动/输入仍真实保留。
- [ ] 关闭子层后父层状态原样恢复；关闭最后一层后页面颜色恢复 `#fafafa`。
- [ ] native Search/Confirm dialog backdrop 同样覆盖完整 Web DOM。
- [ ] iOS 最顶部 system strip 若仍保持白色，记录为 Web viewport 外平台边界；不得把 Web Topbar 再改成错误的人工灰色。

## J. 既有运行时回归

- [ ] 58px bottom toolbar 与 Home Indicator 无冲突。
- [ ] 520ms 保存浏览锚点 + 350ms grace，无系统 Selection/callout/click 泄漏。
- [ ] Oxford/ChatGPT Shortcut 外跳返回正常。
- [ ] Collins real key standalone CORS/外链 fallback 正常。
- [ ] Search fuzzy / Relation exact、四态关系、PIN/Annotation/Undo/Redo 无回归。
