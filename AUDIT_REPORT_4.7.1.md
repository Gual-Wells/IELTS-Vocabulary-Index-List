# Vocabulary Index 4.7.1 审计报告

## 审计结论

4.7.1 是对4.7.0动效体系的收敛修订，不是导航/数据重构。源码审计确认4.7.0的主要真机问题共享同一根因：**把状态变化过度映射成空间动画，并在长/动态页面上把 snapshot、DOM rebuild、scroll reset、virtual geometry放进同一 presentation transaction。**

## 已修根因

- **Representation switch snapshot overlap**：active UI不再为Word/Phrase、Alphabet/Date启动named View Transition；
- **forced TOP**：普通mode/view switch取消`*-switch-top` reset，改一次性semantic anchor；
- **LetterRail derivative feedback**：active UI不再从相邻帧semantic差分产生camera focus；
- **continuous locus semantic conflict**：不再生成52px locus；
- **Modal linger**：close可见时间和几何幅度显著收缩；
- **Backdrop flash**：普通modal不再使用可见dim，入场初态改为`@starting-style`；
- **Token leakage**：Dock/Popover恢复140ms；
- **Relation navigation overlap**：目标导航前immediate hide target popover；
- **Reduce Motion gap**：自制semantic scroll/camera加入直接提交路径。

## 风险仍需真机验证

1. 4.7.0曾报告深位置mode/view switch出现boot screen/Home；源码未找到正常reload路径，4.7.1通过移除高风险VT+TOP-reset链降低故障域，但不能在无WebContent诊断日志情况下宣称根因已百分百证实。
2. Programmatic semantic landing仍与iOS WebKit动态测量/scroll anchoring机制交互；4.7.1保留prewarm + settle，最终以真机首次可见帧为门禁。
3. Pop 282ms为工程第一版感知调参，需真机录屏/重复操作确认不过慢。

## 交付门槛

- JS/MJS syntax；
- JSON parse；
- `npm run test:all`；
- SHA256SUMS；
- ZIP integrity；
- fresh extract + checksum + full tests；
- iPhone reduced/manual tests作为发布后最终视觉门禁。
