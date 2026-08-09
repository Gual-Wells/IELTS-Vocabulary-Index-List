# 4.4.0 iPhone 17 Reduced Tests

> 目标：iPhone 17 标准版 / iOS 26.5.2 / Home Screen standalone。只验证自动化无法证明的 WebKit compositor / system gesture / PWA behavior。

## R1 Sticky displacement matrix

Alphabet 与 Date 各选一个足够长 section。每次展开后主动滚到目标 displacement，再 collapse：

- 0–1px；
- 约 100px；
- 约 500px；
- 约 1500px；
- 约 3000px。

每档至少 5 次。记录 collapse 前 `scrollY / flowAnchor.top / heading.top / targetY / delta`。

关键判据：

1. 不出现整页 blank/white flash、标题重影或错误 section surface；
2. 展开→收起重复 100 次累计 drift < 可见 1px；
3. 第一次大 delta 后，再展开并**重新滚深**，第二次大 delta 仍必须稳定；
4. document bottom / section tail / fling结束后同样稳定；
5. Alphabet 落在 LetterNav 下缘，Date 落在 Top Chrome 下缘。

若仅大 delta 失败而小 delta 稳定，保留日志，不回到“首次预热”解释。

## R2 Destructive-v2 Back / Forward

构造 `Home → A → B → C`：

1. C→B：Back button、慢 swipe、快 swipe、半拖取消分别测试；commit 后 B 首帧 mode/calendar/expanded/scroll 正确，只出现 Safari 一套动画。
2. C 被 POP 后右缘 Forward：C 不得成为可交互页面；记录是否仍存在 UA preview surface。
3. B→A 后重复 Forward。
4. 在 B/A 任一 POP 后 fresh PUSH D：旧 forward branch 不复活。
5. 人工造成 scroll/persist，再 Back：browser entry token 不得改变。
6. Home：在深层直接 Home，应立刻回新 root；随后左缘不能返回旧 generation VIX page。

## R3 Legal Back visual surface

专门观察删除 4.3 permanent underlay / whole-app stacking context 后：

- 慢速 interactive Back 拉出 20%/50%/80%；
- 半拖取消；
- 完成 commit。

如果在任何 JS navigation handler 可运行前仍露纯色/blank，记录为 Safari UA visual-history boundary；不得添加 retained duplicate page 伪修复后直接宣称通过。

## R4 Modal background geometry

在已经吸顶的 Alphabet heading 和 Date heading 上分别打开 Settings/Search/Confirm/nested：

1. 打开前/中/关闭后比较 `scrollY` 和 heading visual top；应保持不变。
2. backdrop/header/footer 拖动不移动正文。
3. dialog-body 可滚，到顶/底继续拖不链给背景。
4. Search 键盘开/关只移动 modal card，不让背景 Sticky 重新定位/消失。
5. Parent→Child→close Child 保留 parent DOM/值/scroll。

若仅在 `#app.inert=true` 时仍发生 Sticky paint 缺失，进入 B 分支：去 root app inert、启用 custom modality，再重复本矩阵。

## R5 Regression

PIN/Review Dock、Query/Relation Popover、Home wordmark/Global Index Rule、StudyStamp、58px toolbar、longpress、Provider、离线/SW 全量回归。
