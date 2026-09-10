# Vocabulary Index 4.5.0 全相联影响矩阵

| 变更 | 数据世代 | 业务语义 | Navigation | Sticky/Modal | 主要验证 |
|---|---|---|---|---|---|
| Collection-only recursive frame | 无 | 同 Collection 定位/视图不再建页 | 大改 | 无 | Search/Relation/PIN same-Collection 不 PUSH |
| VIX token + UA browserKey 双身份 | 无 | 无 | 大改 | 无 | key-based Back/Home、无 depth 猜测 |
| sync user-activation PUSH | 无 | Home 入口仍 alphabet reset | 大改 | 无 | pushState 早于任何 await/timer |
| Back=`traverseTo(parentKey)` | 无 | destructive POP 不变 | 大改 | 无 | A/B/C 分层返回；half-cancel |
| Home=`traverseTo(rootKey)` | 无 | Home 清 recursive stack | 大改 | 无 | Home 后旧链为 dead Forward；fresh PUSH 截断 |
| one traversal owner | 无 | 无 | 大改 | 无 | Navigation API 与 popstate 不并行 |
| 禁止 runtime live-slot replaceState | 无 | URL不再跟随 presentation state | 大改 | 无 | runtime replaceState 仅 boot 一次 |
| 删除 70ms page timer | 无 | 无 | 中 | 无 | 跨 Collection 无 stale-frame delay |
| 4.4 Sticky/Modal freeze | 无 | 无 | 无 | 冻结 | 回归检查不闪/不遮盖 |
