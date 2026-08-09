# Vocabulary Index 4.4.0 iPhone PWA 部署与回滚

## 部署

1. 先保留当前完整备份和上一版完整源码 ZIP。
2. 全量部署 4.4.0 文件树，不做局部覆盖。
3. 确认 `index.html` 最后加载 `css/v4.4.0.css`，且 4.3 历史层仍在其前。
4. 确认 package/application/runtime version 均为 4.4.0。
5. 确认 Service Worker cache generation：`gual-vocabulary-index-v4.4.0-runtime-correctness-20260810-1`。
6. 等待新 SW 安装/激活后重新打开 Home Screen PWA；必要时重新添加到主屏幕做最终 shell 验收。
7. 执行 `tests/MANUAL_CHECKLIST.md` 与 `tests/IPHONE_REDUCED_TESTS_4.4.0.md`。

## 4.3.0 → 4.4.0

无业务数据库迁移。Schema6 / DB5 / Seed4 / VIX2 全部不变。

有意重置：4.3 `destructive-v1` navigation session/token 不迁移，4.4 首次运行建立 `destructive-v2` 新 root generation。业务数据不受影响。

## 回滚

代码层可回滚到完整 4.3.0 包；业务数据库世代相同。但 4.4 的 runtime navigation session 不应期待由 4.3 恢复。回滚前仍建议导出完整备份。
