# Vocabulary Index 4.7.1 测试报告

## 自动测试范围

4.7.1更新测试契约以避免继续把4.7.0已撤销的设计假设当成PASS条件：

- 版本/Service Worker/precache/lifecycle docs静态完整性；
- Buffered State Commit与Root Buffer symbol contract；
- mode/view switch不再包含`view-switch-top`/`mode-switch-top`；
- UI不再包含`.letter-nav-locus`和active-path `semanticVelocity`；
- `cameraTargetForActiveCell()` safe-zone行为；
- Push/Pop仍走View Transition，Home/sibling/reindex不再走旧presentation kind；
- Modal `@starting-style`与transparent interaction backdrop；
- 402×874布局合同继续包含4.7.1覆盖层；
- 原有seed/relation/stress/integration/performance测试继续运行。

## 真机未可自动证明

- 282ms Pop感知速度；
- Buffered Cut是否在iOS 26.5每一帧都无旧新文字重叠；
- 深位置重复切换是否完全消除boot/restart；
- LetterRail camera是否达到无感抖动；
- 透明backdrop下Modal视觉层级是否足够；
- Relation reveal与semantic anchor在120Hz真机上的组合质量。

## 发布要求

最终交付必须记录`npm run test:all`、fresh-extract checksum、fresh-extract full test与ZIP integrity实测结果；未运行的真机项目必须明确标记为待验收，不能被自动测试替代。

## 2026-08-11 工作树正式测试

`npm run test:all`：PASS。

- run-tests：PASS（6176 seed entries；1240 relation components）
- static-tests：PASS（36 precache resources）
- runtime-symbol-tests + TypeScript checkJs：PASS
- runtime-behavior-tests：PASS
- stress-tests：PASS（125 entries；158 memberships；31 relation components）
- integration-tests：PASS（max Shortcut URL 8042 chars @ data）
- performance-tests：PASS（本轮工作树约34.7ms / 25 searches；4.1ms relations；2633.1ms VIX preflight；该数值仅用于回归门禁，不作为真机性能指标）
- layout-contract-check：PASS（402×874）

Fresh-extract checksum / ZIP integrity / fresh-extract full tests 在正式封装阶段补录到交付摘要；iPhone standalone项目仍为待真机。
