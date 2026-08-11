# Vocabulary Index 4.7.2 审计报告

## 审计结论

4.7.1 的主要缺陷不是 Buffer 本身，而是 **Presentation 修复越权改写了 Semantic Transition Contract**。源码/历史版本核验确认：TOP + collapsed 并非 4.7.0 为动效临时创造，而是至少在 4.6.0 已经存在的手动切换结果。

## 已修问题

1. 删除手动 switch 路径的 `transientModeSwitchAnchor()` / `transientViewSwitchTarget()` 与 nearest-group 映射；
2. Word/Phrase 恢复目标 TOP + collapsed；Date 模式不再把来源 date 映射到目标 view；
3. Alphabet/Date 恢复目标 TOP + collapsed；Alphabet→Date 恢复 latest-valid-month；
4. same-Collection Search/Relation 跨 view 不再先 hidden restore、随后第二次 `jumpToEntry()`；
5. Entry target 复用标准 38% reading-anchor position planner，hidden commit 与普通 `jumpToEntry()` 使用同一定位语义；
6. 删除 busy-time silent return，增加 presentation intent serial queue；
7. View toggle 在执行时计算目标，避免 transition 中重复点击使用陈旧 `nextKind`；
8. Back/Home/Collection navigation 与 View/Mode switch 共用串行队列；
9. Manual view/mode commit 增加失败回滚；
10. Buffer 只阻断 Collection content 与非切换底栏工具，不阻断后续 View/Mode toggle 排队。

## 明确保留的差异

4.7.2 仍使用 `single-slot-vix-v1`。4.6.0 的 `destructive-v3`/Browser History Rail 与 4.7.x Single Slot 是独立架构差异。本版仅把它写回生命周期事实，不在缺少单独产品裁决时借机回滚。

## 风险

- intent queue 保证逻辑串行，不等价于真机 120Hz 下无感延迟；极端连点会按顺序执行多个短 buffer；
- iOS compositor 对 deep virtual layout + opacity buffer 的帧质量仍需真机验证；
- mode/month rollback 属 best-effort，IndexedDB/Store 系统性故障时不能承诺完全恢复；
- Single Slot 与 4.6 Navigation frozen contract 的长期取舍仍待独立审计。

## 交付门槛

- JS/MJS syntax；
- JSON parse；
- `npm run test:all`；
- 4.7.2 runtime contract tests；
- SHA256SUMS；
- ZIP integrity；
- fresh extract + checksum + full tests；
- iPhone reduced/manual tests继续作为发布后最终门禁。
