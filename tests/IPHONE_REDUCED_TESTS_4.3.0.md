# 4.3.0 iPhone 17 Reduced Tests

> 只针对静态自动化不能证明的 WebKit compositor / system gesture 行为。目标：iPhone 17 标准版、iOS 26.5.2、Home Screen standalone。

## R1 Sticky Collapse

对 Date 和 Alphabet 各找一个足够长、已经处于 Sticky 状态的展开 section：

1. 冷启动后第一次收起，录屏观察 60fps/系统可用最高帧率；不得出现字母栏/正文短暂错页、白帧、标题重影。
2. 同一 section 连续展开/收起 20 次。
3. 长 section 中部、接近 section 尾部、页面接近 document bottom 各一次。
4. Alphabet 验证标题最终紧贴 LetterNav 下缘；Date 验证紧贴 Top Chrome 下缘。
5. fling/rubber-band 刚结束立即收起。

若仍只在第一次明显闪，记录录屏与操作前 scrollY/section/模式；不得直接以 timeout 掩盖。

## R2 Destructive Back / Forward

构造 `Home → A → B → C`：

1. C 左边缘右划 Back 到 B：只出现 Safari 一次连续原生返回动画；B 恢复 snapshot。
2. 完成后从右边缘尝试 Forward：C 不得重新成为可交互/可提交页面；观察是否出现任何 system preview surface。
3. 快速/慢速/半拖取消/快速 fling 各 10 次。
4. Back button C→B 与手势 C→B 的 POP 结果一致。
5. B→A 后再次尝试 Forward；A→Home 后再次尝试 Forward。
6. Home root 左边缘返回 20 次，不得进入无产品语义页面。
7. 任意 POP 后新进入 D，旧 forward branch 不得复活。

若系统仍短暂显示旧 preview 再被阻止，标记为平台 gesture boundary，不能把该现象写成“已解决”。

## R3 Modal Scroll Lock / Flicker

在页面顶部、中部、底部分别：

1. 冷启动第一次打开 Settings、Search、Confirm、nested child；不得出现 body 跳位/白帧/先黑后卡片硬闪。
2. 每类开关 20 次。
3. backdrop/header/footer 上反复上下拖：window scrollY 不变。
4. dialog-body 可正常纵向滚；到顶/到底继续拖，背景不滚。
5. 打开 Search 后调起键盘、收键盘、切换输入；backdrop 仍全屏，card 不跳出 VisualViewport。
6. Parent→Child→close Child：Parent 原 DOM、表单值、内部 scroll 全保留。

## R4 PIN/Review Dock

1. 页面顶部/中部/最底部设置第一个 PIN：Entry row 本身不闪、不重排重建；Dock 柔和出现。
2. 在已有 PIN 间切换/新增 20 次。
3. 取消最后一个 PIN：Dock 先退出再释放 bottom occupancy，不发生 document clamp 跳跃。
4. Review Dock 重复同类验证。

## R5 Presentation Family

- Query 与 Relation 普通开/关都有同类轻浮层 motion；页面滚动时立即消失，不拖尾。
- Modal 与 Popover 不相互继承错误 z-index/focus；Modal 开启期间 edge navigation guard 不抢 modal 手势。
- reduced-motion 开启后动画可消失，但状态和背景锁仍正确。
