# Vocabulary Index 4.6.0 安全与数据边界

4.6.0 不改变 4.0 数据安全边界。

- Seed / VIX / Full Backup 不保存 Groq、Collins 等 API Key；Key 继续只保存在浏览器本地设置存储。
- CSP 保持 local-first，只允许既有直接 Provider 域。
- 导入继续按 Schema6 / VIX2 校验，不因 runtime scroll/navigation 更新放宽。
- Navigation token/browserKey/dead keys、ScrollCoordinator epoch、semantic position、measured virtual-layout cache 均是 runtime presentation state，不进入业务备份。
- destructive Home/Back 只销毁页面递归状态，不清词库、PIN、StudyStamp、Annotation、Undo/Redo 或设置。
- Safari dead/old history preview 即使显示，也不得重新激活已死亡的 VIX frame。
- Search snapshot hygiene 只改变 transient UI 清理时序，不改变 Provider 数据或权限边界。
