# 迁移到 5.0.0-alpha.10.4

1. 用 `VIX-Bridge-1.0.4.zip` 覆盖 Bridge 仓库并等待 Cloudflare 部署成功。
2. 不删除、不重建、不修改 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY`。
3. 用 `VIX-5.0.0-alpha.10.4-pages.zip` 覆盖 GitHub Pages 仓库并等待 Pages 成功。
4. 打开 PWA，确认版本为 `5.0.0-alpha.10.4`。
5. 打开 Bridge：Groq Key 留空时点击“测试”验证已保存 Key；若要更换 Key，先输入新 Key并测试，确认成功后再点“保存”。
6. 刷新模型目录并完成一次 Groq 查询。

本次不迁移 Durable Object、IndexedDB、Mirror Context 或用户数据，PWA 无需卸载。
