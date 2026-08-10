# Vocabulary Index 4.7.0 数据格式

> 4.7.0 runtime note：Backup Schema 6 / IndexedDB 5 / Seed revision 4 / VIX 2 与 4.6.0 完全相同。Single-Slot Navigation、Semantic Motion、LetterRail 与 target-prewarm 都是 runtime presentation 更新，无数据 migration。

## 版本

- Backup Schema：6
- IndexedDB：5
- Built-in Seed revision：4
- VIX JSON：2

`schemaVersion` 必须为 6。同 Schema6 Full Backup 继续直接读取；不同数据世代不做隐式迁移。

## Runtime state 不进入数据格式

以下均不属于 Seed / Full Backup / VIX：

- VIX recursive navigation token/frame；
- ScrollCoordinator epoch/owner/phase；
- semantic position；
- measured `virtualLayoutCache`；
- motion progress/easing/geometry snapshot；
- Alphabet semantic axis / LetterRail locus/manual lock；
- View Transition presentation state；
- Modal presentation stack。

4.5/4.6 的 browserKey/deadBrowserKeys 已不再是 active runtime state。PWA runtime restart仍从 Home开始，不恢复 recursive navigation 或 motion state。
