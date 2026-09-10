# Vocabulary Index 5.0.0-alpha.13

本版收口 iOS Bridge 认证差异与远程 Mirror 文件缺失问题。Device Token 输入不再使用容易被 Password AutoFill 接管的密码字段语义；PWA 通过 Bearer 与专用头双路传递凭据，Bridge 在私有日志中仅记录脱敏指纹。页面不显示 debug 信息。

Bridge 1.3.0 直接从 Durable Object 实际 run 记录生成文件目录，可在旧索引丢失时恢复文件，并不再因达到 200 份而静默删除旧文件。VIX 文件选择器改为远程文件夹式目录，使用本机目录快照立即打开。

提醒与 toast 现在位于所有弹窗层之上，多条提醒以叠层表达并逐条确认。设置页中 Bridge/Mirror 位于词库/数据之后；VIX 函数和个性化指令作为独立集成资源呈现。个性化指令对普通 Chat 实行能力检查：无本地 PowerShell 和文件权限时不伪报 Mirror 自动提交。

发布顺序：先 Bridge 1.3.0，后 Pages 5.0.0-alpha.13。
