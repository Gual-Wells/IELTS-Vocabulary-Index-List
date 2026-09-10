# 迁移到 5.0.0-alpha.13

1. 用 `VIX-Bridge-1.3.0.zip` 完整覆盖 Bridge 仓库并等待 Cloudflare 部署成功。
2. 保留原有 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY` 和 `VIX_ORIGIN`；不重新生成 Master Key。
3. 用 `VIX-5.0.0-alpha.13-pages.zip` 完整覆盖 Pages 仓库并等待 GitHub Pages 部署成功。
4. 在 VIX 执行“强制更新”，确认页面版本为 `5.0.0-alpha.13`。
5. 分别在 Windows 和 iOS 用同一 Bridge URL/Device Token 测试，再打开“设置 → Mirror → 选择文件”比对远程目录。

本版不迁移或重置词库、学习状态、Groq Key、Mirror 协议或本机审核记录。Bridge 首次读取文件目录时会从实际 run 记录自动恢复目录，无需手工导入。
