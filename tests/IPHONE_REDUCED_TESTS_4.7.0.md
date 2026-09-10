# 4.7.0 iPhone 17 Reduced Tests

目标唯一：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。建议每大组 kill→重开 Home 独立执行。

## A. Single-slot navigation

Home→A→跨 Collection B→C→D→E，至少建立 5 层 VIX recursive path。

PASS：App Back E→D→C→B→A→Home 全部正确；Home 一次清栈；整个过程中不得出现旧 Safari native-history preview / 第 4 层纯色作为 VIX 内部返回画面；kill→重开 Home。

## B. Back exact restore

在 source page 分别建立 42 / 123 / 354 / 4995 / 5322(bottom) 阅读位置并进入下一 Collection，再 App Back，循环至少 20 次。

PASS：目标页在 Page Pop 第一次 live appearance 就处于离开时 semantic position；不得先 TOP 再跳；4995 不落 4989；5322 保持 bottom。

## C. Letter semantic motion / X extreme

全局词汇总表全收起 direct X；重新进入后依次 A→B→…→X；再测试 W 深展开/关系展开后 W→X、X→A。

PASS：正文真实连续滚动；X 最终是合法 bottom-clamped natural target；不出现 W→Y→X 可辨认二次收敛；LetterRail locus/Sticky 与正文同步。

## D. Equal logical-rate observation

选择一个特别长字母 section 与相邻很短 section，执行跨多字母程序跳转。

PASS：长 section 在物理像素上经过更快、短 section 更慢，但 LetterRail 逻辑 A→B、B→C 等相邻间隔占一致 semantic progress；整体 motion只有一次加速/减速，不逐字母脉冲。

## E. Manual LetterNav contract

在页面停住时横向拖 LetterNav 到远离当前字母的位置并松手，等待 5–10 秒。

PASS：正文不移动；LetterNav 不复原。随后轻微上下滚正文：自动跟随才重新接管并从人工位置平滑追到当前 semantic locus。点击 Letter cell 可立即导航。

## F. Same-page navigation

依次测试 Letter、PIN、同页 Search、同页 Relation、Browse Anchor、Calendar date target、Return Top。

PASS：全部是连续 vertical motion；不得使用 page fade/硬切；Sticky 真实自然 handoff。Calendar 页面滚动本身不得自动翻月/改变 Calendar selection。

## G. Cross-page target sequence

Search/Relation 从 A 指定 B 中间/尾部 Entry。

PASS：先完整 Page Push 到 B@TOP，再从 TOP 连续滚到目标；两种 motion 不同时叠播；目标 highlight 只在定位后出现。

## H. Word ↔ Phrase

普通 Collection 在任意深位置/展开状态执行 Word→Phrase→Word。

PASS：只 Collection content plane 做浅横向 sibling swap；每次目标均 TOP+collapsed；切回 Word 不恢复刚才 Word 深位置（除非该 Word 页是 recursive Back target，而不是普通切换）。

## I. Alphabet ↔ Date

任意深位置 Alphabet→Date→Alphabet；Date 内翻 Calendar 到非默认月后再切走/切回。

PASS：Reindex motion 与 sibling/page push 明显语义不同；每次目标 TOP+collapsed；切回 Date 不恢复未打开页面旧滚动/展开/calendar month。Calendar 不随正文自然滚动动态变化。

## J. Page Push / Pop / Home motion

观察新 Collection forward、Back、Home。

PASS：Push/Pop 空间反向对称；Home 是独立 root reset，不像多次 Back；无硬切/统一 crossfade；过渡结束后无第二次位置 correction。

## K. Modal motion / frozen geometry

Settings/Search/Confirm/nested Modal 开关，且背景处于 Sticky 深位置。

PASS：open scale+fade+轻弹性，close 更快且无明显 bounce；背景 Sticky/scroll geometry 不动且不可交互；关闭后背景立即保持原位置。

## L. Long-list performance

全局词汇总表 5322 unique-number path，快速自然滚、A→X、连续字母点击、关系展开、Search/PIN target。

PASS：42 Chunk lazy behavior仍存在；无明显长时间输入阻塞/页面假死；motion 不因 prewarm 恢复全量 DOM。

## M. Install/update

全新安装：只允许 `V→Home` 一次。后续 waiting update 明确点“立即更新”：只 reload 一次。
