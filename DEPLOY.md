# Vocabulary Index 4.2.0 iPhone PWA 部署与回滚

## 部署

1. 部署完整 4.2.0 文件树，不做局部覆盖。
2. 确认 `index.html` 最后加载 `css/v4.2.0.css`。
3. 确认 `package.json` / application-version / runtime version 为 4.2.0。
4. 确认 Service Worker cache 为 `gual-vocabulary-index-v4.2.0-native-sticky-navigation-20260809-1`。
5. Safari 打开 Pages URL 并确认 4.2.0 更新；真机 Home Screen 验收使用 `tests/MANUAL_CHECKLIST.md`。

## 4.1.0 → 4.2.0

无 IndexedDB/Seed/VIX 数据迁移。更新前仍建议按既有流程下载完整备份，尤其当主屏幕 PWA 需要删除/重新添加以排查缓存时。

## 回滚

4.2.0 与 4.0.x/4.1.0 同属 Schema 6 / DB 5 / Seed 4 / VIX 2。代码级回滚到 4.1.0 不应修改业务数据，但会恢复旧 Alphabet mirror/System Shell 实验，不建议作为长期运行方案。Service Worker/PWA shell 需重新刷新。

从 4.x 回退 3.5.x 仍属于内容世代回退，必须使用对应旧世代备份与站点数据处理流程。
