# 迁移到 5.0.0-alpha.12

1. 用 `VIX-Bridge-1.2.0.zip` 完整覆盖 Bridge 仓库，保留现有 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY` 与 `VIX_ORIGIN`，等待 Cloudflare 部署成功。
2. 用 `VIX-5.0.0-alpha.12-pages.zip` 完整覆盖 GitHub Pages 仓库，等待 Pages 部署成功。
3. 打开 VIX，执行“强制更新”，确认版本为 `5.0.0-alpha.12`。
4. 在设置 → Bridge 点击测试，再进入设置 → Mirror，确认远程文件列表可读取。

本次不迁移词库、学习状态或 Groq Key。旧版已经审核并保存在本机的 Mirror 记录仍会读取；Bridge 1.2 把 Mirror 产品界面收敛为远程文件库，不再提供下载请求、手动导入、排队、归档或恢复入口。

