# 迁移到 5.0.0-alpha.10.1

1. 用新的 Pages 包覆盖公开仓库内容，等待 Pages 部署成功；PWA 无需卸载。
2. 用 `VIX-Bridge-1.0.1.zip` 中的文件覆盖私有 Bridge 仓库并提交，等待 Workers Build 成功。
3. 三个现有 Cloudflare Secret 保持原值，不需要删除、重建或重新填写。
4. 打开 PWA，确认版本为 `5.0.0-alpha.10.1`。进入 Bridge，点击“测试”；成功时应显示 Groq 与 Mirror 状态。
5. 如需保存 Groq Key，在 Bridge 中填写后点“保存”；Mirror Context 只在 Mirror 页面点“同步 Bridge”时上传。

数据库 Schema 6、DB 5、Seed revision 7 与现有个人数据格式均未改变。
