# 迁移到 5.0.0-alpha.10.2

1. 用新的 Pages 包覆盖公开仓库内容，等待 Pages 部署成功；PWA 无需卸载。
2. 用 `VIX-Bridge-1.0.2.zip` 的四个文件覆盖私有 Bridge 仓库并提交。
3. 三个 Cloudflare Secret 保持原值。
4. 打开 PWA，确认版本为 `5.0.0-alpha.10.2`。
5. 进入 Bridge 点击“测试”。如果 Groq Key 曾由另一条 Master Key 加密，现在会明确提示重新保存；重新填写 Groq Key 并保存即可。
6. 设置页刷新模型，确认不再出现笼统的“Bridge 无法完成请求”。
7. 打开 Mirror，确认设置页底栏不会露在 Mirror 下方；Mirror 同步仍在 Mirror 页面显式执行。

数据库 Schema 6、DB 5、Seed revision 7 与个人数据格式均未改变。
