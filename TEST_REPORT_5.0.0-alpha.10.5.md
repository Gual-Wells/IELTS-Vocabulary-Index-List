# 5.0.0-alpha.10.5 测试报告

## 根因回归

- 完整 Seed 构建 23,917 条、6,579,469 字节的 Mirror Context。
- Bridge 测试使用 2 MiB 单值限制模拟 Durable Object，确认 Context 被拆成多个不超过 512 KiB 的值。
- Device 上传后，Agent 创建 run 可重组相同 revision 和全部 23,917 条 corpus。
- 本地 Cloudflare `workerd` 实测 `PUT /v1/context` 返回 200，随后 `POST /v1/runs` 返回 201；修复前同一 Context 返回 `SQLITE_TOOBIG`/500。

## 兼容边界

Bridge 为 1.0.5。旧单值 Context 可读；Mirror 3 对外协议、Schema 6、DB 5、Seed revision 7 与 IndexedDB 数据不变。
