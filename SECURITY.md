# Vocabulary Index 4.7.0 安全与数据边界

4.7.0 不改变 4.0 数据安全边界。

- Seed / VIX / Full Backup 不保存 Groq、Collins 等 API Key；Key继续仅保存在本地设置存储。
- CSP保持 local-first，只允许既有Provider域。
- 导入继续按 Schema6 / VIX2校验，不因 motion/navigation runtime 更新放宽。
- VIX recursive frames、semantic position、ScrollCoordinator、measured virtual layout、motion/LetterRail状态都是 runtime presentation state，不进入业务备份。
- Single-slot Navigation只删除 Safari 内部递归 transport，不扩大任何Web权限，也不读取/修改用户其他Safari历史。
- destructive Home/Back只销毁runtime递归状态，不清词库、PIN、StudyStamp、Annotation、Undo/Redo、Provider设置或手动浏览锚点。
- Modal retained/inert/focus边界保持；motion不允许通过动画期间临时解除背景 inert。
- Search关闭等待完整 modal lifecycle 后再进入 page motion，只影响transient presentation顺序，不改变Provider数据/权限。
