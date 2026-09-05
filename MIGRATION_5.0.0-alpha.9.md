# Vocabulary Index 5.0.0-alpha.9 迁移说明

- 覆盖仓库文件并等待 `vix-private` 自动部署成功。
- Cloudflare 控制台 Build command 保持空白、Deploy command 保持 `npx wrangler deploy`；仓库配置会自动构建 `dist/`。
- 不删除或重建 Worker、Access 应用、Durable Objects、Secret。
- 不需要重新安装 PWA；打开私域网址后刷新，版本应更新为 `5.0.0-alpha.9`。
- 登录后访问 `/api/health`，确认版本与状态，再执行一次 Collins 查词。
- 若仍失败，把界面中 `诊断 上游状态/类型/次数/策略` 的一行发回即可；诊断不包含 Collins Key、查询词或词条正文。
