# Vocabulary Index 4.3.0 iPhone PWA 部署与回滚

## 部署

1. 部署完整 4.3.0 文件树，不做局部覆盖。
2. 确认 `index.html` 在 4.2 样式之后最后加载 `css/v4.3.0.css`。
3. 确认 `package.json` / application-version / runtime version 为 4.3.0。
4. 确认 Service Worker cache generation 为 `gual-vocabulary-index-v4.3.0-runtime-convergence-20260809-1`。
5. Safari 打开 Pages URL 并确认新 SW 生效；Home Screen 真机验收使用 `tests/MANUAL_CHECKLIST.md` 与 `tests/IPHONE_REDUCED_TESTS_4.3.0.md`。

## 4.2.0 → 4.3.0

业务数据世代不变：Schema6 / DB5 / Seed4 / VIX2。Entry、PIN、StudyStamp、Annotation、Settings、API Key、用户内容不需要迁移。

4.3.0 有意不恢复两类旧运行时状态：

- 旧 `collection:viewKind` viewMode；
- 4.2 pageSnapshot/history navigation session。

升级后若导航状态不能验证，页面收敛到干净 Home；业务数据库不受影响。

## 回滚

回滚前先导出完整备份。代码级回滚到 4.2.0 不改变业务 schema，但会恢复：

- section-keyed word/phrase mode；
- epoch-only navigation/Forward 残留语义；
- Sticky 跨帧 collapse 补偿；
- body-fixed modal scroll lock、native Search/Confirm split、PIN whole-row rerender。

因此 4.2.0 只可作为诊断回滚，不建议作为本轮问题修复后的长期运行版本。回滚/再升级都需注意 Service Worker cache generation 变化。
