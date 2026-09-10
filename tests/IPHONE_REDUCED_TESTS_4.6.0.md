# 4.6.0 iPhone 17 Reduced Tests

目标：iPhone 17 标准版 / iOS 26.5.x / Home Screen standalone。每组尽量 kill→重开 Home 后独立执行，避免把一个失败状态带进下一组。

## A. Navigation freeze regression

Home→A→跨 Collection B→跨 Collection C：App Back C→B→A→Home；native half-swipe cancel 不改逻辑 frame；Home 一次回原 root；same-Collection Search/Relation/PIN/view/mode 不建 Back layer；kill→重开 Home。

## B. Semantic Back stress

分别在全局总表 Entry 42、123、354、4995、5322（5322 位于 bottom）建立 source position：A→B→Back A，连续重复至少 20 次，重点目标可扩展到 100 次。

PASS：最终 Entry/relative position 每次一致；4995 不得退化到 4919/4988/4989；5322 必须最终保持 bottom，不得经历 live page 5240/5313 二次 correction。

## C. Letter direct / sequential equivalence

全收起：直接 X，记录最终位置。重新全收起：按 A→B→…→X 顺序点击。

PASS：最终都是 X 的 natural flow target；只允许 document-bottom clamp 差异。不得出现 W141 回拉、卡顿狂跳、字母栏/Sticky 与正文割裂。

## D. Repeated letter positioning

选择多个长分组，分别在 collapsed / expanded / section 深处反复点击同一 LetterNav cell。

PASS：每次都回同一 natural heading target；不得有“有时顶部/有时底部/下偏 3–8 Entry”的状态依赖。

## E. Visual commit

远距离 A→X、W→X、Back 深位置时观察慢动作：正文、Sticky、active LetterNav 不应分别明显后刷新；live VIX 不得发生可辨认二次位置跳。

## F. Native swipe platform boundary

建立 5+ Collection 深链后逐层 native Back。允许较老 preview 因 Safari 私有 bitmap cache 只显示背景；preview 本身可不可交互。PASS 条件是 live VIX 接管后立即正确，不再额外 Search 消失/Sticky 刷新/位置二跳。

## G. Search snapshot hygiene

A 中 Search 跨 Collection 到 B，再 native swipe Back。PASS：Safari 若有 source bitmap，应尽量是干净 A，而不是冻结 closing Search；live A 无第二次 Search 消失。same-Collection Search 仍不新增 history。

## H. Sticky / Modal freeze

Alphabet/Date 长 section 深处 collapse：无白闪、无累计漂移。Sticky 吸顶时打开 Settings/Search/Confirm/nested Modal：背景 Sticky 不消失、不移位，背景不可交互。

## I. First install / update

全新安装 Home Screen PWA：只允许 `V→Home` 一次，不得 `V→Home→V→Home`。后续真正有 waiting update 时点击“立即更新”，允许且只允许一次 reload。
