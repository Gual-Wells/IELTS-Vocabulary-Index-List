# Vocabulary Index 4.6.0 全相联影响矩阵

| 变更 | 数据世代 | 产品语义 | 运行时影响 | 回归门 |
|---|---|---|---|---|
| ScrollCoordinator 单一 root owner | 无 | 用户位置语义不变 | 根滚动写入集中 | stale epoch 不得移动 viewport |
| ContentTop 单一几何 | 无 | Sticky/Letter 坐标一致 | 删除 attached/not-attached 语义分叉 | Letter/Sticky/active 同步 |
| SemanticPosition snapshot | 无 | 返回必须回原阅读位置 | `scrollY` 降级 fallback | 42/123/354/4995/5322 循环 |
| 42 Chunk 去滚动副作用 | 无 | 无 | Virtualizer 只 DOM/measure | W→X 不得被旧 chunk 拉回 |
| measured chunk-size cache | 无 | 无 | live frame 复用真实 placeholder 高度 | Back provisional geometry 更稳定 |
| Letter target 改 flow anchor | 无 | 字母跳转回 natural heading | 不读 Sticky visual rect | direct X == A…X（仅 bottom clamp 可差） |
| Back `manual + event.scroll + semantic verify` | 无 | destructive Back 不变 | UA 只作 first pass | UA 错位后 VIX 纠正到语义真值 |
| transaction 后持久化 | 无 | 当前 frame 状态保持 | 中间位置不得污染 snapshot | transaction active 时禁止 authoritative write |
| Search snapshot hygiene | 无 | Search 页面边界不变 | cross-Collection hard-close 后 presentation fence 再 PUSH | native Back 不应冻结 closing Search |
| SW first claim 不 reload | 无 | 首装只启动一次 | controllerchange 仅显式更新 armed 时 reload | 首装 V→Home 一次 |
| Sticky/Modal/Nav freeze | 无 | 保持 | 只做 ownership 接线 | 原真机通过项必须不回归 |
