# 迁移到 5.0.0-alpha.10.5

1. 用 `VIX-Bridge-1.0.5.zip` 覆盖 Bridge 仓库并等待 Cloudflare 部署成功。
2. 不删除、不重建、不修改 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY` 或 Durable Object。
3. 用 `VIX-5.0.0-alpha.10.5-pages.zip` 覆盖 GitHub Pages 仓库并等待 Pages 成功。
4. 打开 PWA，确认版本为 `5.0.0-alpha.10.5`。
5. 打开 Mirror，点击“同步 Bridge”；成功后 Bridge 状态应显示 Mirror 已同步。

本次没有手工数据迁移。旧 Context 会在第 5 步自动替换为分片存储，Groq Key 与个人数据保持原状。
