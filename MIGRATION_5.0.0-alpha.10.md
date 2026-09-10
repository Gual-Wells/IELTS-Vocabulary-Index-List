# 迁移到 5.0.0-alpha.10

1. 正常打开既有 Pages PWA，使用“立即更新”。不删除主屏幕图标，不清除 Safari 网站数据。
2. 在设置的 Bridge 独立页面填写固定 Bridge URL、Device Token，并首次保存 Groq Key。
3. 刷新 Groq 模型并保留需要的前端选择。
4. 安装并配置 VIX Function；把随包个性化指令加入支持本地执行的任务环境。
5. 完成 Pages、Groq、Mirror 的验收后，按 `DEPLOY.md` 删除旧私域部署。

数据库 Schema、Seed revision 与个人状态格式未重置。升级外壳不会自动删除、覆盖或重新初始化既有词库。
