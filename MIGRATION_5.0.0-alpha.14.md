# 迁移到 5.0.0-alpha.14

1. 先用 `VIX-Bridge-1.4.0.zip` 完整覆盖 Bridge 仓库并等待 Cloudflare 部署成功。1.4.0 增加懒加载发音接口和加密的 Google TTS Key，不改变现有 Mirror 文件与 Groq Key。
2. 保留现有 `VIX_DEVICE_TOKEN`、`VIX_AGENT_TOKEN`、`VIX_BRIDGE_MASTER_KEY` 与 `VIX_ORIGIN`，不要重新生成 Master Key。
3. 用 `VIX-5.0.0-alpha.14-pages.zip` 完整覆盖 Pages 仓库并等待 GitHub Pages 部署成功。
4. 在 VIX 执行“强制更新”，确认页面版本为 `5.0.0-alpha.14`。
5. 在 iOS 打开“设置 → Bridge”，粘贴现有 Device Token 后直接测试或保存。若系统把 `G:...` 改成 `g:...`，本版会在精确 401 后验证恢复值并保存正确值。
6. 打开“设置 → Bridge”，按需填入 Google Cloud TTS API Key 后测试并保存；不需要发音时可留空。
7. 打开“设置 → Mirror → 选择文件”，确认远程目录与 Windows 看到的文件一致；选中文件后回到首页，用 Mirror 按钮开关当前文件。
8. 首次打开词库会自动把内置 Seed 7 的未修改释义补全为 Seed 8；个人新增、删除、学习状态和手工修改过的释义保持不变。

本次不迁移或覆盖本机词库、学习状态、Groq Key、Mirror 审核记录与远程文件。不同浏览器仍有各自的本机目录快照，但 Bridge 成功响应后都以同一远程目录为准。
