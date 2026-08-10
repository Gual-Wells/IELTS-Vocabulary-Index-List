# Vocabulary Index 4.5.0 安全与数据边界

4.5.0 不改变 4.0 数据安全边界。

- Seed / VIX / Full Backup 不保存 Groq、Collins 等 API Key。
- API Key 继续仅保存在浏览器本地设置存储。
- CSP 保持 local-first，只允许现有直接 Provider 域。
- 导入仍按 Schema6 / VIX2 校验，不因 Navigation 更新放宽。
- Navigation `token/browserKey/deadBrowserKeys` 仅是 runtime presentation/transport state，不进入业务备份。
- destructive Home/Back 只销毁页面递归状态，不清词库、PIN、StudyStamp、Annotation、Undo/Redo 或设置。
- dead Forward 即使被 Safari 系统 gesture 暂时 preview，也不得重新成为 live VIX frame。
