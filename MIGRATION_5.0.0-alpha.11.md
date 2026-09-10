# 迁移到 5.0.0-alpha.11

1. 用 `VIX-Bridge-1.1.0.zip` 完整覆盖 Bridge 仓库并等待 Cloudflare 部署成功。保留现有三个 Secret，不要重新生成或更换。
2. 用 `VIX-5.0.0-alpha.11-pages.zip` 完整覆盖 GitHub Pages 仓库并等待 Pages 成功。
3. 打开 VIX，执行“强制更新”，确认版本为 `5.0.0-alpha.11`。
4. 在“设置 → Bridge”测试连接并同步一次 Mirror Context。此后新运行使用 Mirror 4。
5. 从 Bridge 页重新下载 VIX Function，或用完整包内新版 `VIX-Function.ps1` 再执行一次 `-Action Configure`。已安装旧脚本不会自动替换。

词库、学习状态、Groq Key 与已保存的 Bridge 地址不需要重新导入。已有 Mirror 3 待审核结果仍可处理；Bridge 1.1.0 会保留已确认结果供恢复。
