# Vocabulary Index 5.0.0-alpha.10.5

本补丁修复完整 Mirror Context 无法写入 Durable Object 的确定性故障。

- 23,917 词完整 Context 改为不超过 512 KiB 的分片存储。
- 活动 manifest 只在全部分片写入成功后切换，读取端对 VIX Function 透明重组。
- 旧单值 Context 保持只读兼容，下一次同步自动替换。
- `SQLITE_TOOBIG` 不再退化为无信息的统一 500。

Bridge 版本为 1.0.5。Mirror 3 对外协议、Schema、数据库、Seed 与用户数据不变。
