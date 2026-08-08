# Vocabulary Index 4.1.0 iPhone PWA 部署与回滚

## 部署

1. 部署完整 4.1.0 文件树，不做局部覆盖。
2. 确认 `index.html` 最后加载 `css/v4.1.0.css`。
3. 确认 Apple web-app title、Manifest `name/short_name` 均为 `Vocabulary Index`。
4. 确认 Service Worker cache 为 `gual-vocabulary-index-v4.1.0-iphone-convergence-20260808-1`。
5. Safari 打开 Pages URL 并确认 4.1.0 已更新。
6. 因本版修改 Home Screen 名称和 shell 元数据，正式验收建议先完成本地备份，再删除旧主屏幕 PWA、重新“添加到主屏幕”，冷启动验证名称与顶部系统区。

## 3.5.x → 4.1.0

4.0 是内容世代硬断代；沿用 4.0.x 既有升级规则。4.0.2 → 4.1.0 无 IndexedDB/Seed/VIX 数据迁移。

## 回滚

4.1.0 与 4.0.x 同属 Schema 6 / DB 5 / Seed 4 / VIX 2。代码级回滚到 4.0.2 不应修改业务数据，但 Service Worker/PWA shell 需重新刷新；从 4.x 回退 3.5.x 仍需旧世代备份与站点数据清理。

## 真机重点

- alphabet/date Top Chrome 无漏内容带；
- 字母栏 A 左线、所有 top 线、disabled `#` 结构线；
- global/domain/normal + word/phrase/content Sticky；
- 日期刷新原位；
- Query 右侧留白与 Oxford 图标；
- Home switch 图标左、管理右；PWA 名称；
- 一级表项 secondary gap；
- retained modal depth 1/2 顶部 shell 逐层变暗；
- iOS 26.5.2 system strip 是否接受动态 tint；
- 离线、进程回收、外部 App 返回、Collins/Groq CORS/Abort。
