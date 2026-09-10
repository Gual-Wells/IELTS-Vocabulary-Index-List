# 迁移到 5.0.0-alpha.10.3

1. 用 `VIX-Bridge-1.0.3.zip` 覆盖私有 Bridge 仓库并等待部署成功。
2. 不要删除或重建 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY`；尤其保持 Master Key 原值。
3. 用 `VIX-5.0.0-alpha.10.3-pages.zip` 覆盖 GitHub Pages 仓库并等待 Pages 成功。
4. 打开 PWA，确认版本为 `5.0.0-alpha.10.3`。
5. 设置 → Bridge：填写现有 URL/Device Token。若曾出现 `Bridge 无法完成请求`，再填写一次 Groq Key，点保存。
6. 保存会一次完成 Groq 模型探测、模型目录更新和 Mirror Context 同步；返回设置页后状态应为“Bridge 与 Groq 已连接”。
7. 打开任意词汇的查询按钮，弹窗应只包住 Oxford、Groq 两项；点 Groq 完成一次真实查询。

数据库 Schema 6、DB 5、Seed revision 7 与个人数据格式均未改变，PWA 不需要卸载。
