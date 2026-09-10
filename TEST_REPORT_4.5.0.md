# Vocabulary Index 4.5.0 测试报告

## 自动化门禁

交付前执行：

```text
npm run test:all
```

覆盖：Seed/Relation、静态契约、runtime symbols、runtime behavior、stress、integrations、performance、402×874 layout。

## 4.5 新增 Navigation 行为断言

- key classifier：root / back / same / forward / dead / foreign；
- parent key：C→B、B→A、A→root；
- POP 后旧 key 必须 dead；
- Home clear 后旧 frame keys 全部 dead；
- runtime `replaceState()` 只能出现一次 boot root 初始化；
- `navigateCollection` 真 PUSH 在任何 executable `await` 前；
- Search result navigation 不得等待 Modal exit timer；
- 不允许 `NavigationDestination.getState()` / `navigationApiHandledTokens` 旧实现回归；
- Navigation API 与 popstate 只能二选一 owner。

## 继承回归

4.4 Sticky target math、flow-anchor、View Transition path、Modal geometry、PIN row identity继续由原测试覆盖。

## 真机未由自动化证明

- Safari `currentEntry.key` 在 standalone PUSH 后的同步更新；
- `traverseTo(key)` 的 interactive Back surface；
- half-cancel；
- UA after-transition scroll restore；
-不可取消 Forward preview 边界。

这些项目见 `tests/IPHONE_REDUCED_TESTS_4.5.0.md`。

## 本次构建实测

2026-08-10 本地工作树：

- `run-tests`: OK — 6176 seed entries / 1240 relation components
- `static-tests`: OK — 32 precache resources
- `runtime-symbol-tests`: OK
- `runtime-behavior-tests`: OK
- `stress-tests`: OK — 125 entries / 158 memberships / 31 relation components
- `integration-tests`: OK — max Shortcut URL 8042 chars
- `performance-tests`: OK — 29.7ms / 25 searches；3.6ms relations；3004.1ms VIX preflight（运行环境时序仅作回归信号）
- `layout-contract-check`: OK — 402×874
